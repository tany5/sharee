/**
 * Stage 2 — AI Virtual Try-On ("saree draped on a model").
 *
 * Provider: IDM-VTON on Hugging Face Spaces (free ZeroGPU tier) — verified
 * live against `yisol/IDM-VTON` (endpoint /tryon: human photo, garment photo,
 * description, auto-mask, crop, denoise steps, seed). Any other Space with a
 * tryon-style endpoint can be swapped in via the `tryon_space_id` secret.
 *
 * Protocol (raw HTTP, verified against Gradio 4.x and compatible with 5.x):
 *   1. multipart POST /upload            → file paths
 *   2. POST /call/{endpoint}             → { event_id }
 *   3. GET  /call/{endpoint}/{event_id}  → SSE (heartbeat… complete|error)
 *   4. download the output image URL
 *
 * TRYON_MOCK=1 forces the deterministic local mock render (dev/CI).
 */
import type { AdvanceContext } from "@/lib/marketing/types";
import { productPhoto } from "@/lib/photos";

export type TryOnProviderId = "idm-vton" | "custom-space" | "mock";

export interface TryOnResult {
  bytes: Buffer;
  contentType: string;
  provider: TryOnProviderId;
}

/** Default Space: IDM-VTON (yisol) — live, ZeroGPU, API enabled. */
export const TRYON_SPACES = {
  idmVton: "yisol/IDM-VTON",
} as const;

const CALL_TIMEOUT_MS = 300_000;

interface GradioFileData {
  path?: string;
  url?: string;
}

function spaceBase(space: string): string {
  return `https://${space.replaceAll("/", "-").toLowerCase()}.hf.space`;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(CALL_TIMEOUT_MS) });
}

/** Find a callable endpoint name from the Space's API info (gradio 4/5 paths). */
async function discoverEndpoint(base: string): Promise<string> {
  for (const infoPath of ["/gradio_api/info", "/info"]) {
    try {
      const res = await fetchWithTimeout(`${base}${infoPath}`);
      if (!res.ok) continue;
      const json = (await res.json()) as {
        named_endpoints?: Record<string, unknown>;
      };
      const names = Object.keys(json.named_endpoints ?? {});
      if (names.length === 0) continue;
      const preferred =
        names.find((n) => /tryon|try_on|virtual/i.test(n)) ?? names[0];
      return preferred.replace(/^\//, "");
    } catch {
      /* try next path */
    }
  }
  return "tryon"; // sensible default for IDM-VTON-style spaces
}

/** Upload an image; returns the server-side path reference. */
async function uploadImage(base: string, bytes: Buffer, name: string): Promise<string> {
  const form = new FormData();
  form.append(
    "files",
    new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }),
    name,
  );
  for (const uploadPath of ["/gradio_api/upload", "/upload"]) {
    try {
      const res = await fetchWithTimeout(`${base}${uploadPath}`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) continue;
      const paths = (await res.json()) as string[];
      if (Array.isArray(paths) && paths.length > 0) return paths[0];
    } catch {
      /* try next path */
    }
  }
  throw new Error("Space image upload failed");
}

/** Read an SSE event stream until complete/error; returns the last data JSON.
 * ZeroGPU Spaces queue behind other users, so this is intentionally patient. */
async function readSseResult(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(480_000) });
  if (!res.ok) throw new Error(`Event stream failed (HTTP ${res.status})`);
  const text = await res.text();
  let sawError: string | null = null;
  let lastData: string | null = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("event:")) {
      const name = line.slice(6).trim();
      if (name === "error") {
        sawError =
          "Space reported an error (usually ZeroGPU quota exhausted for anonymous users — retry later or set tryon_space_id)";
      }
    } else if (line.startsWith("data:")) {
      lastData = line.slice(5).trim();
    }
  }
  if (lastData) {
    try {
      const parsed = JSON.parse(lastData) as unknown;
      // data: null paired with an error event is a definitive Space failure.
      if (parsed !== null && parsed !== undefined) return parsed;
      throw new Error(sawError ?? "Space returned null");
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes("Space") || err.message.includes("ZeroGPU"))
      ) {
        throw err;
      }
      /* genuine JSON parse failure — fall through to the generic error */
    }
  }
  throw new Error(sawError ?? "Space returned no result");
}

/** Extract and download the first image output from a result payload. */
async function downloadOutput(
  base: string,
  result: unknown,
): Promise<Buffer> {
  const outputs = Array.isArray(result) ? result : [result];
  for (const out of outputs) {
    const ref = out as GradioFileData;
    if (ref && typeof ref === "object" && (ref.url || ref.path)) {
      const fileUrl =
        ref.url ??
        `${base}/gradio_api/file=${ref.path}`.replace("/gradio_api/file=", "/file=");
      const fileRes = await fetch(fileUrl, { signal: AbortSignal.timeout(60_000) });
      if (!fileRes.ok) continue;
      const bytes = Buffer.from(await fileRes.arrayBuffer());
      if (bytes.length > 5_000) return bytes;
    }
  }
  throw new Error("Space returned no image output");
}

/**
 * Call an IDM-VTON-style Space. Verified live against yisol/IDM-VTON
 * (gradio 4.24, legacy routes; new-route fallbacks included).
 */
async function callIdmVton(
  space: string,
  modelBytes: Buffer,
  garmentBytes: Buffer,
): Promise<Buffer> {
  const base = spaceBase(space);
  const endpoint = await discoverEndpoint(base);

  const humanPath = await uploadImage(base, modelBytes, "model.jpg");
  const garmPath = await uploadImage(base, garmentBytes, "saree.jpg");

  // Param 0 is an ImageEditor dict (background image + empty layers);
  // param 1 the garment FileData; then description, auto-mask, crop, steps, seed.
  const submitBody = {
    data: [
      {
        background: { path: humanPath, meta: { _type: "gradio.FileData" } },
        layers: [],
        composite: null,
      },
      { path: garmPath, meta: { _type: "gradio.FileData" } },
      "saree draped elegantly",
      true, // auto-mask the human
      false, // no auto-crop
      30, // denoise steps
      42, // seed (deterministic)
    ],
  };

  let eventId: string | undefined;
  for (const callPath of [`/gradio_api/call/${endpoint}`, `/call/${endpoint}`]) {
    try {
      const res = await fetchWithTimeout(`${base}${callPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitBody),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { event_id?: string };
      if (json.event_id) {
        eventId = json.event_id;
        break;
      }
    } catch {
      /* try next path */
    }
  }
  if (!eventId) throw new Error("Space submit failed (no event id)");

  let result: unknown = null;
  let streamError: string | null = null;
  for (const streamPath of [
    `/gradio_api/call/${endpoint}/${eventId}`,
    `/call/${endpoint}/${eventId}`,
  ]) {
    try {
      result = await readSseResult(`${base}${streamPath}`);
      break;
    } catch (err) {
      // Keep the FIRST error — it is the meaningful one; the fallback path
      // (legacy route on gradio 4.x) usually just 404s.
      if (!streamError) streamError = (err as Error).message;
    }
  }
  if (result === null) {
    throw new Error(streamError ?? "Space event stream failed");
  }

  return downloadOutput(base, result);
}

/**
 * Deterministic mock render — a locally composited "model card" PNG so the
 * full pipeline is testable without any network. Uses sharp to stamp the
 * garment over a plain canvas with the product name.
 */
async function mockRender(
  garmentBytes: Buffer,
  productName: string,
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const width = 768;
  const height = 1024;
  // Fixed-size canvas first, so every overlay is guaranteed to fit.
  const canvas = await sharp(garmentBytes)
    .resize(width, height, { fit: "cover" })
    .png()
    .toBuffer();
  const garment = await sharp(garmentBytes)
    .resize(width - 96, height - 260, { fit: "contain", background: { r: 246, g: 235, b: 225, alpha: 1 } })
    .png()
    .toBuffer();
  const label = Buffer.from(
    `<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f6ebe1"/><text x="50%" y="920" text-anchor="middle" font-family="Georgia" font-size="34" fill="#5d350e">${productName.slice(0, 34)}</text><text x="50%" y="964" text-anchor="middle" font-family="Georgia" font-size="24" fill="#886644">AI try-on placeholder (mock)</text></svg>`,
  );
  return sharp(canvas)
    .composite([
      { input: garment, top: 60, left: 48 },
      { input: label, top: 0, left: 0 },
    ])
    .png()
    .toBuffer();
}

export interface TryOnInput {
  /** Raw saree/garment photo (first product image). */
  garmentUrl: string;
  /** Base model avatar photo. */
  modelUrl: string;
  productName: string;
  secrets: { tryOnSpace?: string };
}

/**
 * Run the try-on: IDM-VTON (or a custom Space from secrets) → mock. Returns
 * image bytes of the model wearing the saree; provider recorded on the row.
 */
export async function runTryOn(input: TryOnInput): Promise<TryOnResult> {
  const [model, garment] = await Promise.all([
    fetch(input.modelUrl).then((r) => {
      if (!r.ok) throw new Error(`Model image HTTP ${r.status}`);
      return r.arrayBuffer();
    }),
    fetch(input.garmentUrl).then((r) => {
      if (!r.ok) throw new Error(`Garment image HTTP ${r.status}`);
      return r.arrayBuffer();
    }),
  ]);
  const modelBytes = Buffer.from(model);
  const garmentBytes = Buffer.from(garment);

  if (process.env.TRYON_MOCK === "1") {
    return {
      bytes: await mockRender(garmentBytes, input.productName),
      contentType: "image/png",
      provider: "mock",
    };
  }

  const errors: string[] = [];
  const space = input.secrets.tryOnSpace?.trim() || TRYON_SPACES.idmVton;
  const provider: TryOnProviderId = input.secrets.tryOnSpace?.trim()
    ? "custom-space"
    : "idm-vton";
  try {
    const bytes = await callIdmVton(space, modelBytes, garmentBytes);
    return { bytes, contentType: "image/jpeg", provider };
  } catch (err) {
    errors.push(`${space}: ${(err as Error).message}`);
  }

  // Mock fallback keeps the pipeline flowing in dev/demo/CI.
  try {
    const bytes = await mockRender(garmentBytes, input.productName);
    return { bytes, contentType: "image/png", provider: "mock" };
  } catch (mockErr) {
    errors.push(`mock: ${(mockErr as Error).message}`);
  }
  throw new Error(`All try-on providers failed — ${errors.join(" | ")}`);
}

/** Pick the base model for a product (deterministic per product id). */
export function pickBaseModel(
  models: { id: string; imageUrl: string }[],
  productId: string,
): { id: string; imageUrl: string } | undefined {
  if (models.length === 0) return undefined;
  let hash = 0;
  for (const ch of productId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return models[hash % models.length];
}

/** Convenience for the orchestrator. */
export function tryOnFromContext(
  ctx: AdvanceContext,
  models: { id: string; imageUrl: string }[],
  secrets: { tryOnSpace?: string },
): TryOnInput & { modelId: string } {
  const model = pickBaseModel(models, ctx.product.id);
  if (!model) throw new Error("No base models uploaded — add one in Admin → Marketing Studio");
  // Prefer the admin-uploaded photo; fall back to the product's editorial
  // photography (the same "worn" shot the storefront shows).
  const garment = ctx.product.images[0] ?? productPhoto(ctx.product.slug);
  if (!garment) {
    throw new Error(
      "Product has no photo — upload one in Admin → Products first",
    );
  }
  return {
    garmentUrl: garment,
    modelUrl: model.imageUrl,
    productName: ctx.product.name,
    secrets,
    modelId: model.id,
  };
}
