/**
 * Stage 2 — AI Virtual Try-On ("saree draped on a model").
 *
 * Provider: CatVTON on Hugging Face Spaces first, then IDM-VTON as fallback.
 * CatVTON's `overall` garment mode is a better fit for full saree drapes.
 * Any supported Space can be swapped in via the `tryon_space_id` secret.
 *
 * Protocol (raw HTTP, verified against Gradio 4.x and compatible with 5.x):
 *   1. multipart POST /upload            → file paths
 *   2. POST /call/{endpoint}             → { event_id }
 *   3. GET  /call/{endpoint}/{event_id}  → SSE (heartbeat… complete|error)
 *   4. download the output image URL
 *
 * Input photos are preprocessed with sharp before upload: admin photos are
 * often small flat-lay shots with background clutter — an attention crop to a
 * clean 768×1024 portrait lifts render quality noticeably.
 *
 * TRYON_MOCK=1 forces the deterministic local mock render (dev/CI).
 */
import type { AdvanceContext } from "@/lib/marketing/types";
import { productPhoto } from "@/lib/photos";
import { randomInt } from "node:crypto";

export type TryOnProviderId = "catvton" | "idm-vton" | "custom-space" | "mock";
export type TryOnPose = "front" | "side" | "back";

export interface TryOnResult {
  bytes: Buffer;
  contentType: string;
  provider: TryOnProviderId;
}

/** Default Spaces: free Hugging Face demos, tried in quality-first order. */
export const TRYON_SPACES = {
  catVton: "zhengchong/CatVTON",
  idmVton: "yisol/IDM-VTON",
} as const;

/**
 * Background-removal Space used to build the full-body draping mask.
 * IDM-VTON's built-in auto-mask is hardcoded to "upper_body" — which is why
 * renders came out as a blouse+skirt. We generate a full-body mask from the
 * person silhouette (head cropped off so fabric never paints the face) and
 * submit it as the ImageEditor layer with auto-masking disabled.
 */
const MASK_SPACE = "not-lain/background-removal";

const CALL_TIMEOUT_MS = 300_000;

interface GradioFileData {
  path?: string;
  url?: string;
}

const EXT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Normalise the person/model photo: full-body portrait, max 1024px tall,
 * JPEG. `fit: "inside"` keeps the whole body visible (VTON needs it).
 */
async function prepPersonImage(bytes: Buffer): Promise<Buffer> {
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(bytes)
      .rotate()
      .resize({ height: 1024, width: 1024, fit: "inside", withoutEnlargement: false })
      .jpeg({ quality: 92 })
      .toBuffer();
  } catch {
    return bytes;
  }
}

/**
 * Normalise the saree photo: fit the WHOLE saree in frame on a soft neutral
 * background. Seeing the complete garment (borders, pallu, pleat lines) is
 * what tells the try-on model to drape it full-body — an aggressive crop
 * makes it render as an upper-body garment instead.
 */
async function prepGarmentImage(bytes: Buffer): Promise<Buffer> {
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(bytes)
      .rotate()
      .resize(768, 1024, {
        fit: "contain",
        position: "center",
        background: { r: 244, g: 240, b: 233, alpha: 1 },
      })
      .modulate({ brightness: 1.04, saturation: 1.06 })
      .jpeg({ quality: 92 })
      .toBuffer();
  } catch {
    return bytes;
  }
}

/** Deterministic per-product seed so re-runs are reproducible but varied. */
function seedFor(slug: string, pose?: TryOnPose): number {
  let hash = 0;
  for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const poseOffset = pose === "side" ? 3777 : pose === "back" ? 7333 : 0;
  return (hash + poseOffset) % 10_001; // Spaces cap seed at 10000
}

/**
 * Fetch the person silhouette (background-removed RGBA image) from the free
 * BRIA Space. Returns null on ANY failure — the caller then falls back to
 * IDM-VTON's own (upper-body) auto-mask.
 */
async function fetchSilhouette(person: Buffer, hfToken?: string): Promise<Buffer | null> {
  try {
    const base = spaceBase(MASK_SPACE);
    const path = await uploadImage(base, person, "person.png", hfToken);
    const body = { data: [{ path, meta: { _type: "gradio.FileData" } }] };
    let eventId: string | undefined;
    for (const callPath of ["/gradio_api/call/image", "/call/image"]) {
      try {
        const res = await fetchWithTimeout(`${base}${callPath}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }, hfToken);
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
    if (!eventId) return null;
    let result: unknown = null;
    for (const streamPath of [
      `/gradio_api/call/image/${eventId}`,
      `/call/image/${eventId}`,
    ]) {
      try {
        result = await readSseResult(`${base}${streamPath}`, hfToken);
        break;
      } catch {
        /* try next path */
      }
    }
    if (!result) return null;
    return await downloadOutput(base, result, hfToken);
  } catch {
    return null;
  }
}

/**
 * Convert a background-removed RGBA image into the full-body saree mask:
 * white where fabric may be painted, black elsewhere.
 *
 * The head is cropped off (fabric must never paint the face) — detected as
 * the narrow region above the shoulders: the first row from the top whose
 * width reaches ~68% of the widest row. Feet are trimmed slightly so floor
 * contact pixels don't smear fabric past the ankles.
 */
export async function silhouetteToBodyMask(silhouette: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const image = sharp(silhouette).ensureAlpha();
  const meta = await image.metadata();
  const width = meta.width ?? 768;
  const height = meta.height ?? 1024;
  const raw = await image.raw().toBuffer(); // RGBA, channels=4

  const on = (row: number, col: number) => raw[(row * width + col) * 4 + 3] > 40;
  let top = -1;
  let bottom = -1;
  const rowWidth = new Array<number>(height).fill(0);
  for (let r = 0; r < height; r++) {
    let count = 0;
    for (let c = 0; c < width; c++) if (on(r, c)) count++;
    rowWidth[r] = count;
    if (count > 0) {
      if (top === -1) top = r;
      bottom = r;
    }
  }
  if (top === -1) throw new Error("Empty person silhouette");

  let maxRowWidth = 0;
  for (let r = top; r <= bottom; r++) maxRowWidth = Math.max(maxRowWidth, rowWidth[r]);
  const shoulderThreshold = maxRowWidth * 0.68;
  let headCut = top;
  while (headCut <= bottom && rowWidth[headCut] < shoulderThreshold) headCut++;
  if (headCut > bottom) headCut = top; // degenerate silhouette — keep all

  const footCut = Math.min(bottom, bottom - Math.round(height * 0.02));

  const mask = Buffer.alloc(width * height * 3, 0); // black RGB
  for (let r = headCut; r <= footCut; r++) {
    for (let c = 0; c < width; c++) {
      if (on(r, c)) {
        const o = (r * width + c) * 3;
        mask[o] = 255;
        mask[o + 1] = 255;
        mask[o + 2] = 255;
      }
    }
  }
  return sharp(mask, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

function spaceBase(space: string): string {
  return `https://${space.replaceAll("/", "-").toLowerCase()}.hf.space`;
}

function hfHeaders(token?: string, headers?: HeadersInit): HeadersInit {
  const hfToken = token ?? process.env.HF_TOKEN ?? process.env.HUGGINGFACE_TOKEN;
  return hfToken ? { ...headers, Authorization: `Bearer ${hfToken}` } : (headers ?? {});
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  hfToken?: string,
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: hfHeaders(hfToken, init?.headers),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
}

async function fetchImageInput(url: string): Promise<{ bytes: Buffer; contentType: string }> {
  if (url.startsWith("/")) {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const clean = url.split("?")[0] ?? url;
    const file = path.basename(clean.replace("/api/media/", ""));
    const root = clean.startsWith("/api/media/")
      ? path.resolve(process.cwd(), ".demo-data", "uploads")
      : path.resolve(process.cwd(), "public");
    const abs = clean.startsWith("/api/media/")
      ? path.resolve(root, file)
      : path.resolve(root, clean.replace(/^\/+/, ""));
    if (abs !== root && !abs.startsWith(`${root}${path.sep}`)) {
      throw new Error(`Stored asset path is not allowed: ${clean}`);
    }
    if (!fs.existsSync(abs)) throw new Error(`Stored asset not found on disk: ${clean}`);
    const ext = file.split(".").pop()?.toLowerCase() ?? "jpg";
    return { bytes: fs.readFileSync(abs), contentType: EXT_TYPES[ext] ?? "image/jpeg" };
  }
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Image HTTP ${res.status}: ${url}`);
  const type = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  return { bytes: Buffer.from(await res.arrayBuffer()), contentType: type };
}

/** Find a callable endpoint name from the Space's API info (gradio 4/5 paths). */
async function discoverEndpoint(base: string, hfToken?: string): Promise<string> {
  for (const infoPath of ["/gradio_api/info", "/info"]) {
    try {
      const res = await fetchWithTimeout(`${base}${infoPath}`, undefined, hfToken);
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
async function uploadImage(
  base: string,
  bytes: Buffer,
  name: string,
  hfToken?: string,
): Promise<string> {
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
      }, hfToken);
      if (!res.ok) continue;
      const paths = (await res.json()) as string[];
      if (Array.isArray(paths) && paths.length > 0) return paths[0];
    } catch {
      /* try next path */
    }
  }
  throw new Error("Space image upload failed");
}

/**
 * Read an SSE event stream until complete/error; returns the last data JSON.
 * ZeroGPU Spaces queue behind other users, so this is intentionally patient.
 */
const QUOTA_HINT =
  "GPU quota exhausted — ZeroGPU Spaces ration anonymous traffic. " +
  "Add a free Hugging Face token (Supabase app_secrets key `hf_token`, or env HF_TOKEN) " +
  "for a much larger quota, or retry in a few minutes.";

async function readSseResult(url: string, hfToken?: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: hfHeaders(hfToken),
    signal: AbortSignal.timeout(480_000),
  });
  if (!res.ok) throw new Error(`Event stream failed (HTTP ${res.status})`);
  const text = await res.text();
  let sawError = false;
  let lastData: string | null = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("event:")) {
      if (line.slice(6).trim() === "error") sawError = true;
    } else if (line.startsWith("data:")) {
      lastData = line.slice(5).trim();
    }
  }
  // Gradio reports ZeroGPU quota rejections as `event: error` + `data: null`
  // (the message is only shown in the browser), so treat that shape as quota.
  if (sawError && (lastData === null || lastData === "null" || lastData === "")) {
    throw new Error(QUOTA_HINT);
  }
  if (lastData) {
    try {
      const parsed = JSON.parse(lastData) as unknown;
      if (parsed !== null && parsed !== undefined) return parsed;
    } catch {
      /* genuine JSON parse failure — fall through to the generic error */
    }
  }
  if (sawError) {
    throw new Error(
      `Space reported an error during processing — ${QUOTA_HINT}`,
    );
  }
  throw new Error("Space returned no result");
}

/** Extract and download the first image output from a result payload. */
async function downloadOutput(
  base: string,
  result: unknown,
  hfToken?: string,
): Promise<Buffer> {
  const outputs = Array.isArray(result) ? result : [result];
  for (const out of outputs) {
    const ref = out as GradioFileData;
    if (ref && typeof ref === "object" && (ref.url || ref.path)) {
      const fileUrl =
        ref.url ??
        `${base}/gradio_api/file=${ref.path}`.replace("/gradio_api/file=", "/file=");
      const fileRes = await fetch(fileUrl, {
        headers: hfHeaders(hfToken),
        signal: AbortSignal.timeout(60_000),
      });
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
 *
 * When a full-body mask is available it is sent as the ImageEditor layer with
 * auto-masking OFF — that is what makes the saree drape the whole body
 * instead of just the torso.
 */
async function callIdmVton(
  space: string,
  modelBytes: Buffer,
  garmentBytes: Buffer,
  hfToken?: string,
  seed = 42,
  maskBytes?: Buffer,
): Promise<Buffer> {
  const base = spaceBase(space);
  const endpoint = await discoverEndpoint(base, hfToken);

  const humanPath = await uploadImage(base, modelBytes, "model.jpg", hfToken);
  const garmPath = await uploadImage(base, garmentBytes, "saree.jpg", hfToken);
  let maskPath: string | null = null;
  if (maskBytes) {
    try {
      maskPath = await uploadImage(base, maskBytes, "mask.png", hfToken);
    } catch {
      maskPath = null;
    }
  }

  // Param 0 is an ImageEditor dict (background image + empty layers);
  // param 1 the garment FileData; then description, auto-mask, crop, steps, seed.
  // With a full-body mask layer: is_checked=false makes the Space use OUR
  // mask (full-body drape). Without one, auto-masking stays on — but that
  // path masks only the torso, producing a blouse-style render.
  const submitBody = {
    data: [
      {
        background: { path: humanPath, meta: { _type: "gradio.FileData" } },
        layers: maskPath ? [{ path: maskPath, meta: { _type: "gradio.FileData" } }] : [],
        composite: null,
      },
      { path: garmPath, meta: { _type: "gradio.FileData" } },
      "full traditional Indian saree outfit, pleated skirt drape and pallu over the shoulder, full body",
      maskPath === null, // auto-mask the human (only when we have no mask)
      false, // no auto-crop
      30, // denoise steps
      seed,
    ],
  };

  let eventId: string | undefined;
  for (const callPath of [`/gradio_api/call/${endpoint}`, `/call/${endpoint}`]) {
    try {
      const res = await fetchWithTimeout(`${base}${callPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitBody),
      }, hfToken);
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
      result = await readSseResult(`${base}${streamPath}`, hfToken);
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

  return downloadOutput(base, result, hfToken);
}

/**
 * Call CatVTON. Verified against the live Space API: `person_image` and
 * `cloth_image` are PLAIN FileData (not an ImageEditor dict), followed by
 * cloth type, steps, guidance scale, seed and result display mode.
 */
async function callCatVton(
  space: string,
  modelBytes: Buffer,
  garmentBytes: Buffer,
  hfToken?: string,
  seed = 42,
): Promise<Buffer> {
  const base = spaceBase(space);
  const humanPath = await uploadImage(base, modelBytes, "model.jpg", hfToken);
  const garmPath = await uploadImage(base, garmentBytes, "saree.jpg", hfToken);
  const errors: string[] = [];

  for (const attempt of [
    { endpoint: "submit_function_flux", guidance: 30 },
    { endpoint: "submit_function", guidance: 2.5 },
  ]) {
    const submitBody = {
      data: [
        // Verified signature: person_image is a plain FileData, NOT an
        // ImageEditor dict — the editor shape gets rejected mid-run.
        { path: humanPath, meta: { _type: "gradio.FileData" } },
        { path: garmPath, meta: { _type: "gradio.FileData" } },
        "overall",
        50,
        attempt.guidance,
        seed,
        "result only",
      ],
    };

    let eventId: string | undefined;
    for (const callPath of [`/gradio_api/call/${attempt.endpoint}`, `/call/${attempt.endpoint}`]) {
      try {
        const res = await fetchWithTimeout(`${base}${callPath}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submitBody),
        }, hfToken);
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
    if (!eventId) {
      errors.push(`${attempt.endpoint}: submit failed`);
      continue;
    }

    let result: unknown = null;
    let streamError: string | null = null;
    for (const streamPath of [
      `/gradio_api/call/${attempt.endpoint}/${eventId}`,
      `/call/${attempt.endpoint}/${eventId}`,
    ]) {
      try {
        result = await readSseResult(`${base}${streamPath}`, hfToken);
        break;
      } catch (err) {
        if (!streamError) streamError = (err as Error).message;
      }
    }
    if (result === null) {
      errors.push(`${attempt.endpoint}: ${streamError ?? "event stream failed"}`);
      continue;
    }

    return downloadOutput(base, result, hfToken);
  }

  throw new Error(`CatVTON failed — ${errors.join(" | ")}`);
}

/**
 * Deterministic mock render — a locally composited model preview so the full
 * pipeline is testable without any network.
 */
async function mockRender(
  modelBytes: Buffer,
  garmentBytes: Buffer,
  productName: string,
  pose: TryOnPose = "front",
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const width = 768;
  const height = 1024;
  const canvas = await sharp(modelBytes)
    .resize(width, height, { fit: "cover" })
    .png()
    .toBuffer();
  const garment = await sharp(garmentBytes)
    .resize(520, 620, { fit: "cover", position: "attention" })
    .modulate({ brightness: 1.08, saturation: 1.08 })
    .ensureAlpha(0.82)
    .png()
    .toBuffer();
  const poseLabel = pose === "side" ? "Side Look" : pose === "back" ? "Back Drape" : "Front Look";
  const label = Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <path d="M210 325 C310 260 470 285 580 380 L660 875 C505 950 325 955 155 870 Z" fill="#000" opacity="0.15"/>
      <path d="M180 348 C306 274 488 292 605 406 L650 892 C504 962 306 957 132 872 Z" fill="none" stroke="#f6ebe1" stroke-width="18" opacity="0.8"/>
      <rect x="0" y="835" width="${width}" height="189" fill="#1c0d05" opacity="0.75"/>
      <text x="50%" y="908" text-anchor="middle" font-family="Georgia" font-size="34" fill="#fff">${productName.slice(0, 34)}</text>
      <text x="50%" y="956" text-anchor="middle" font-family="Arial" font-size="24" fill="#f6ebe1">${poseLabel} | Free local try-on preview</text>
    </svg>`,
  );
  return sharp(canvas)
    .composite([
      { input: garment, top: 330, left: 120, blend: "over" },
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
  secrets: { tryOnSpace?: string; hfToken?: string };
  pose?: TryOnPose;
  allowMock?: boolean;
}

/**
 * Run the try-on: CatVTON → IDM-VTON → mock. Returns
 * image bytes of the model wearing the saree; provider recorded on the row.
 */
export async function runTryOn(input: TryOnInput): Promise<TryOnResult> {
  const [model, garment] = await Promise.all([
    fetchImageInput(input.modelUrl),
    fetchImageInput(input.garmentUrl),
  ]);
  const allowMock = input.allowMock !== false;

  // Admin photos are frequently small/flat/cluttered — normalise both inputs
  // so the Spaces receive clean, consistently-sized portraits.
  const [modelBytes, garmentBytes] = await Promise.all([
    prepPersonImage(model.bytes),
    prepGarmentImage(garment.bytes),
  ]);

  if (process.env.TRYON_MOCK === "1") {
    if (!allowMock) {
      throw new Error("Real try-on is disabled because TRYON_MOCK=1 is set");
    }
    return {
      bytes: await mockRender(modelBytes, garmentBytes, input.productName, input.pose),
      contentType: "image/png",
      provider: "mock",
    };
  }

  const customSpace = input.secrets.tryOnSpace?.trim();
  const customIsCatVton = customSpace?.toLowerCase().includes("catvton") === true;
  // IDM-VTON first: verified working end-to-end; the public CatVTON Space
  // currently errors mid-run. CatVTON stays as the "overall"-mode fallback
  // (and as the target for the tryon_space_id secret).
  const candidates: { space: string; provider: TryOnProviderId }[] = customSpace
    ? [
        {
          space: customSpace,
          provider: customIsCatVton ? "catvton" : "custom-space",
        },
        ...(customIsCatVton
          ? [{ space: TRYON_SPACES.idmVton, provider: "idm-vton" as const }]
          : []),
      ]
    : [
        { space: TRYON_SPACES.idmVton, provider: "idm-vton" },
        { space: TRYON_SPACES.catVton, provider: "catvton" },
      ];

  const errors: string[] = [];
  const seed = seedFor(input.productName, input.pose);
  // Full-body mask (best effort — null → the Space's own upper-body mask).
  let bodyMask: Buffer | null = null;
  try {
    const silhouette = await fetchSilhouette(modelBytes, input.secrets.hfToken);
    if (silhouette) bodyMask = await silhouetteToBodyMask(silhouette);
  } catch {
    bodyMask = null;
  }
  for (const candidate of candidates) {
    try {
      const bytes = candidate.space.toLowerCase().includes("catvton")
        ? await callCatVton(candidate.space, modelBytes, garmentBytes, input.secrets.hfToken, seed)
        : await callIdmVton(
            candidate.space,
            modelBytes,
            garmentBytes,
            input.secrets.hfToken,
            seed,
            bodyMask ?? undefined,
          );
      return { bytes, contentType: "image/jpeg", provider: candidate.provider };
    } catch (err) {
      errors.push(`${candidate.space}: ${(err as Error).message}`);
    }
  }

  if (!allowMock) {
    throw new Error(`Real try-on failed — ${errors.join(" | ")}`);
  }

  // Mock fallback keeps the pipeline flowing in dev/demo/CI.
  try {
    const bytes = await mockRender(modelBytes, garmentBytes, input.productName, input.pose);
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

/** Pick a random base model for a fresh product run. */
export function pickRandomBaseModel(
  models: { id: string; imageUrl: string }[],
): { id: string; imageUrl: string } | undefined {
  if (models.length === 0) return undefined;
  return models[randomInt(models.length)];
}

function shuffleModels<T>(models: T[]): T[] {
  const next = [...models];
  for (let i = next.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

/** Convenience for the orchestrator. */
export function tryOnFromContext(
  ctx: AdvanceContext,
  models: { id: string; imageUrl: string }[],
  secrets: { tryOnSpace?: string; hfToken?: string },
): TryOnInput & { modelId: string } {
  const existing = ctx.marketing.tryOn?.modelId
    ? models.find((m) => m.id === ctx.marketing.tryOn?.modelId)
    : undefined;
  const model = existing ?? pickRandomBaseModel(models);
  if (!model) throw new Error("No saree models available — add one in Admin → Saree Models");
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

/** Build front/side/back try-on jobs from one saree image. */
export function tryOnGalleryFromContext(
  ctx: AdvanceContext,
  models: { id: string; imageUrl: string }[],
  secrets: { tryOnSpace?: string; hfToken?: string },
): (TryOnInput & { modelId: string; pose: TryOnPose })[] {
  const garment = ctx.product.images[0] ?? productPhoto(ctx.product.slug);
  if (!garment) {
    throw new Error(
      "Product has no photo — upload one in Admin → Products first",
    );
  }

  const existingIds = ctx.marketing.tryOn?.renders
    ?.map((r) => r.modelId)
    .filter(Boolean) as string[] | undefined;
  const existingModels = existingIds
    ?.map((id) => models.find((m) => m.id === id))
    .filter(Boolean) as { id: string; imageUrl: string }[] | undefined;
  const picked = existingModels?.length
    ? existingModels
    : shuffleModels(models).slice(0, Math.min(3, models.length));
  const finalModels = picked.length > 0 ? picked : [];
  if (finalModels.length === 0) {
    throw new Error("No saree models available — add one in Admin → Saree Models");
  }

  const poses: TryOnPose[] = ["front", "side", "back"];
  return poses.map((pose, index) => {
    const model = finalModels[index % finalModels.length];
    return {
      garmentUrl: garment,
      modelUrl: model.imageUrl,
      productName: ctx.product.name,
      secrets,
      modelId: model.id,
      pose,
    };
  });
}
