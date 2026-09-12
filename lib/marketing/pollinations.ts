/**
 * Pollinations AI client — OPTIONAL cloud engine for social creatives.
 *
 * Uses the model validated by the owner's live test (2026-09-11):
 *   I2I  POST /v1/images/edits   model black-forest-labs/flux.1-kontext-pro
 * (text-to-image is served by the local ComfyUI pipeline; kontext handles
 * product-photo → fashion-ad conversion, which local SD1.5 cannot).
 *
 * HARD RULES (owner spec):
 *   - AI-rendered banner text spells the price as "INR 199", NEVER "₹199" —
 *     image models garble the rupee glyph. Sharp-rendered text may keep ₹.
 *   - Key is read from secrets/env at call time and NEVER logged or returned.
 *   - Outputs arrive as b64_json and stay local — nothing is published to a
 *     public gallery.
 *   - Failure here NEVER blocks the social flow: callers fall back to the
 *     existing image or the local composer.
 */
import "server-only";

const GEN_BASE = "https://gen.pollinations.ai";
export const POLLINATIONS_I2I_MODEL = "black-forest-labs/flux.1-kontext-pro";
/** Free-tier default text→image model (validated live, 0.004 pollen, seed-aware). */
export const POLLINATIONS_T2I_MODEL = "tongyi-mai/z-image-turbo";
/** Kontext is slow (owner test: ~1-2 min). One retry, then give up. */
const TIMEOUT_MS = 180_000;

/** Resolve the API key from pipeline secrets (Supabase RPC) or env. */
export async function pollinationsKey(): Promise<string | undefined> {
  try {
    const { loadPipelineSecrets } = await import("@/lib/marketing/secrets");
    const s = await loadPipelineSecrets();
    if (s.pollinationsKey) return s.pollinationsKey;
  } catch {
    /* fall through to env */
  }
  return process.env.POLLINATIONS_API_KEY?.trim() || undefined;
}

export function pollinationsEnabled(key: string | undefined): key is string {
  return Boolean(key && key.length > 8);
}

/** Build the I2I edit prompt for a saree fashion-ad creative. Pure function. */
export function aiModelAdPrompt(opts: {
  price: number;
  brand?: string;
  cta?: string;
}): string {
  const brand = opts.brand ?? "TheTanti";
  const cta = opts.cta ?? "SHOP NOW";
  // INR spelling is deliberate: image models cannot render the ₹ glyph.
  return [
    `Transform this flat saree product photo into a premium e-commerce fashion advertisement: a beautiful realistic Indian woman wearing this EXACT saree — keep the fabric, colour, pattern and border completely unchanged — elegant confident fashion-model pose, warm tasteful interior background, realistic lighting, natural skin.`,
    `Then add a clean promotional layout on top: a bold pink brush-paint banner across the upper left with white text "ALL SAREES" and very large yellow text "INR ${opts.price} FLAT" (spelled I-N-R, extremely prominent), and a white rounded "${cta}" pill button below the banner. Small elegant brand wordmark "${brand}" in the top corner.`,
    `Commercial advertisement quality, strong visual hierarchy, minimal text, no clutter, no watermark, no fake logo, no extra people.`,
  ].join(" ");
}

export interface EditImageInput {
  /** Raw bytes of the source (product/model) image. */
  sourceBytes: Buffer;
  contentType?: string;
  prompt: string;
  model?: string;
}

export interface EditImageResult {
  buffer: Buffer;
  contentType: "image/jpeg";
}

/**
 * Image-to-image edit via /v1/images/edits (multipart, source uploaded
 * directly — no public URL needed). Throws on failure; callers fall back.
 */
export async function editImageToImage(input: EditImageInput): Promise<EditImageResult> {
  const key = await pollinationsKey();
  if (!pollinationsEnabled(key)) {
    throw new Error("Pollinations key not configured");
  }

  const run = async (): Promise<Response> => {
    const fd = new FormData();
    fd.append(
      "image",
      new Blob([new Uint8Array(input.sourceBytes)], { type: input.contentType ?? "image/jpeg" }),
      "source.jpg",
    );
    fd.append("prompt", input.prompt);
    fd.append("model", input.model ?? POLLINATIONS_I2I_MODEL);
    fd.append("response_format", "b64_json");
    return fetch(`${GEN_BASE}/v1/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: fd,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  };

  let res: Response;
  try {
    res = await run();
  } catch (err) {
    // Rule: retry once on transient failure (timeout / network), then surface.
    try {
      res = await run();
    } catch (err2) {
      throw new Error(`Pollinations unreachable: ${(err2 as Error).message} (first: ${(err as Error).message})`);
    }
  }
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`Pollinations edit failed (HTTP ${res.status}): ${body}`);
  }
  const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const item = json.data?.[0];
  if (item?.b64_json) {
    return { buffer: Buffer.from(item.b64_json, "base64"), contentType: "image/jpeg" };
  }
  if (item?.url) {
    const img = await fetch(item.url, { signal: AbortSignal.timeout(60_000) });
    if (!img.ok) throw new Error(`Pollinations result fetch failed (HTTP ${img.status})`);
    return {
      buffer: Buffer.from(await img.arrayBuffer()),
      contentType: "image/jpeg" as const,
    };
  }
  throw new Error("Pollinations returned no image data");
}

export interface TextToImageInput {
  prompt: string;
  width?: number;
  height?: number;
  /** Fixed seed keeps results reproducible; omit for a fresh variation. */
  seed?: number;
  model?: string;
}

/**
 * Text→image via POST /v1/images/generations (JSON body, b64 back — no URL
 * length limits, nothing published to a gallery). Used for promo-poster
 * BACKGROUNDS only; text/price is still rendered by sharp on top.
 */
export async function generateImageFromText(input: TextToImageInput): Promise<EditImageResult> {
  const key = await pollinationsKey();
  if (!pollinationsEnabled(key)) {
    throw new Error("Pollinations key not configured");
  }
  const res = await fetch(`${GEN_BASE}/v1/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: input.prompt,
      model: input.model ?? POLLINATIONS_T2I_MODEL,
      size: `${input.width ?? 1080}x${input.height ?? 1350}`,
      ...(input.seed !== undefined && input.seed >= 0 ? { seed: input.seed } : {}),
      response_format: "b64_json",
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`Pollinations generation failed (HTTP ${res.status}): ${body}`);
  }
  const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const item = json.data?.[0];
  if (item?.b64_json) {
    return { buffer: Buffer.from(item.b64_json, "base64"), contentType: "image/jpeg" };
  }
  if (item?.url) {
    const img = await fetch(item.url, { signal: AbortSignal.timeout(60_000) });
    if (!img.ok) throw new Error(`Pollinations result fetch failed (HTTP ${img.status})`);
    return { buffer: Buffer.from(await img.arrayBuffer()), contentType: "image/jpeg" };
  }
  throw new Error("Pollinations returned no image data");
}
