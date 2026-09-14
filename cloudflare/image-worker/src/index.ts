/**
 * TheTanti Image Worker — Cloudflare Workers AI inference only.
 *
 *   POST /generate  { prompt, modelImage, sareeImage, poseImage?, backgroundImage? }
 *                   → { success, provider, model, image (base64), contentType }
 *
 * Uses the Workers AI binding (env.AI) — no Cloudflare API token lives in the
 * Next.js app. Reference images (data URLs or http(s) URLs) are normalized to
 * binary multipart fields (input_image_0..3) as required by FLUX.2 klein:
 * each reference must be ≤ 512×512, so inputs are downscaled to fit (the full
 * saree reference is downscaled as little as possible and always kept
 * readable — 512 is the model's hard limit, not an app choice).
 */
/** Minimal Workers AI binding contract (multipart image models). */
export interface AiImageBinding {
  run(
    model: string,
    input: { multipart: { body: ReadableStream; contentType: string } },
  ): Promise<unknown>;
}

export interface Env {
  AI: AiImageBinding;
  /** Overrides the default model, e.g. @cf/black-forest-labs/flux-2-klein-9b */
  CLOUDFLARE_IMAGE_MODEL?: string;
  /** Shared secret; when set, requests must send `Authorization: Bearer <secret>`. */
  CLOUDFLARE_IMAGE_WORKER_SECRET?: string;
  /** Comma-separated allowed origins, e.g. http://localhost:3000,https://thetanti.com */
  ALLOWED_ORIGIN?: string;
}

const DEFAULT_MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
const MAX_REF_EDGE = 512; // model's documented hard limit per reference image
const MAX_BODY_BYTES = 12 * 1024 * 1024; // generous cap for 2–4 inline data URLs

const CORS_HEADERS = (origin: string | null, env: Env): Record<string, string> => {
  const allow = resolveAllowedOrigin(origin, env);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allow) headers["Access-Control-Allow-Origin"] = allow;
  return headers;
};

function resolveAllowedOrigin(origin: string | null, env: Env): string | null {
  if (!origin) return null;
  const configured = (env.ALLOWED_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (configured.includes("*")) return "*";
  if (configured.includes(origin)) return origin;
  // localhost on any port is fine for development.
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
  return null;
}

function json(data: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
  });
}

/* ---------------------------------------------------------------- */
/* Image normalization                                              */
/* ---------------------------------------------------------------- */

interface RefImage {
  /** Decoded bytes of the reference image. */
  bytes: Uint8Array;
  contentType: string;
}

async function decodeImageInput(input: unknown, label: string): Promise<RefImage> {
  if (typeof input !== "string" || input.trim() === "") {
    throw new HttpError(400, `${label} is required`);
  }
  const value = input.trim();

  // Data URL
  const dataUrl = /^data:([^;]+);base64,([\s\S]+)$/.exec(value);
  if (dataUrl) {
    return {
      bytes: base64ToBytes(dataUrl[2]!),
      contentType: dataUrl[1] || "image/jpeg",
    };
  }

  // http(s) URL — fetch inside the worker (Workers AI does not take URLs).
  if (/^https?:\/\//i.test(value)) {
    const res = await fetch(value, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new HttpError(400, `${label} URL could not be fetched (HTTP ${res.status})`);
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) throw new HttpError(415, `${label} URL is not an image`);
    return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: type };
  }

  // Raw base64
  try {
    return { bytes: base64ToBytes(value), contentType: "image/jpeg" };
  } catch {
    throw new HttpError(400, `${label} is not a valid data URL, URL or base64 image`);
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^base64,/, "").replace(/\s+/g, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Downscale a reference image to ≤512×512 — the FLUX.2 klein documented limit
 * for `input_image_N` references. Implemented with Cloudflare Images
 * (`env.images.resize`) when available; falls back to the original bytes when
 * the binding is not enabled on the account (larger inputs still work, they
 * just may be center-cropped by the model).
 */
async function downscaleReference(ref: RefImage, env: Env): Promise<Uint8Array> {
  const images = (env as Env & { images?: { resize?: (input: { blob: Blob }, options: Record<string, unknown>) => Promise<{ blob: () => Promise<Blob> }> } }).images;
  if (!images?.resize) return ref.bytes;
  try {
    const out = await images.resize(
      { blob: new Blob([ref.bytes], { type: ref.contentType }) },
      { width: MAX_REF_EDGE, height: MAX_REF_EDGE, fit: "contain", format: "image/png" },
    );
    return new Uint8Array(await (await out.blob()).arrayBuffer());
  } catch (err) {
    console.warn("[image-worker] resize unavailable, sending original reference:", err instanceof Error ? err.message : err);
    return ref.bytes;
  }
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/* ---------------------------------------------------------------- */
/* Handlers                                                         */
/* ---------------------------------------------------------------- */

function handleHealth(): Response {
  return json({ status: "ok" }, 200, {});
}

function handleRoot(cors: Record<string, string>): Response {
  return json({ service: "TheTanti Image Worker", status: "ok" }, 200, cors);
}

interface GenerateBody {
  prompt?: unknown;
  modelImage?: unknown;
  sareeImage?: unknown;
  poseImage?: unknown;
  backgroundImage?: unknown;
  aspectRatio?: unknown;
  width?: unknown;
  height?: unknown;
  seed?: unknown;
}

const ASPECTS: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "3:4": { width: 896, height: 1152 },
  "4:5": { width: 896, height: 1152 },
  "9:16": { width: 768, height: 1344 },
};

async function handleGenerate(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  // Shared secret (optional — empty CLOUDFLARE_IMAGE_WORKER_SECRET disables it).
  const secret = env.CLOUDFLARE_IMAGE_WORKER_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("Authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return json({ success: false, error: "Unauthorized" }, 401, cors);
    }
  }

  let body: GenerateBody;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return json({ success: false, error: "Request body too large" }, 413, cors);
    }
    body = JSON.parse(text) as GenerateBody;
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400, cors);
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return json({ success: false, error: "prompt is required" }, 400, cors);

  const model = env.CLOUDFLARE_IMAGE_MODEL?.trim() || DEFAULT_MODEL;

  try {
    // Order matters: the prompt refers to "INPUT IMAGE 1/2" as
    // model = input_image_0, saree = input_image_1, pose = 2, background = 3.
    const refs: RefImage[] = [];
    refs.push(await decodeImageInput(body.modelImage, "modelImage"));
    refs.push(await decodeImageInput(body.sareeImage, "sareeImage"));
    if (body.poseImage) refs.push(await decodeImageInput(body.poseImage, "poseImage"));
    if (body.backgroundImage) refs.push(await decodeImageInput(body.backgroundImage, "backgroundImage"));
    if (refs.length > 4) {
      return json({ success: false, error: "At most 4 reference images are supported" }, 400, cors);
    }

    const aspect =
      typeof body.aspectRatio === "string" && ASPECTS[body.aspectRatio]
        ? ASPECTS[body.aspectRatio]!
        : ASPECTS["3:4"]!;
    const width = clampDim(body.width) ?? aspect.width;
    const height = clampDim(body.height) ?? aspect.height;

    const form = new FormData();
    form.append("prompt", prompt);
    for (const [i, ref] of refs.entries()) {
      const bytes = await downscaleReference(ref, env);
      form.append(`input_image_${i}`, new Blob([bytes], { type: ref.contentType }));
    }
    form.append("width", String(width));
    form.append("height", String(height));

    const formResponse = new Response(form);
    const formBody = formResponse.body;
    if (!formBody) throw new Error("Could not serialize multipart form body");
    const result = await env.AI.run(model, {
      multipart: {
        body: formBody,
        contentType: formResponse.headers.get("content-type") ?? "multipart/form-data",
      },
    });

    // FLUX.2 klein returns { image: <base64> } — normalize whatever came back.
    const imageB64 = extractImageB64(result);
    if (!imageB64) {
      return json(
        { success: false, provider: "cloudflare", model, error: "Model returned no image — it may have refused the prompt (safety filter). Try a different reference photo." },
        502,
        cors,
      );
    }
    return json(
      { success: true, provider: "cloudflare", model, image: imageB64, contentType: "image/png" },
      200,
      cors,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[image-worker] generate failed:", message);
    if (err instanceof HttpError) {
      return json({ success: false, error: err.message }, err.status, cors);
    }
    // Workers AI quota/availability errors surface as generic errors — map the
    // common ones to actionable text without leaking internals.
    const friendly = /quota|allocation|limit/i.test(message)
      ? "Workers AI daily free allocation may have been reached. Try again after the daily reset."
      : /timeout|timed out/i.test(message)
        ? "Workers AI timed out. Retry — the first request after idle can be slow."
        : "Workers AI inference failed. Check the model name and your Cloudflare plan.";
    return json({ success: false, provider: "cloudflare", model, error: friendly }, 502, cors);
  }
}

function clampDim(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(1920, Math.max(256, Math.round(n)));
}

function extractImageB64(result: unknown): string | undefined {
  if (!result) return undefined;
  if (typeof result === "string") return result;
  const rec = result as Record<string, unknown>;
  if (typeof rec.image === "string") return rec.image;
  if (Array.isArray(rec.images) && typeof rec.images[0] === "string") return rec.images[0] as string;
  return undefined;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = CORS_HEADERS(request.headers.get("Origin"), env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "")) {
        return handleRoot(cors);
      }
      if (request.method === "GET" && url.pathname === "/health") {
        return handleHealth();
      }
      if (request.method === "POST" && url.pathname === "/generate") {
        return await handleGenerate(request, env, cors);
      }
      return json({ success: false, error: "Not found" }, 404, cors);
    } catch (err) {
      console.error("[image-worker] unhandled error:", err instanceof Error ? err.message : err);
      return json({ success: false, error: "Internal worker error" }, 500, cors);
    }
  },
};
