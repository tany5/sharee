import "server-only";
import { fetchImageBytes } from "@/lib/marketing/storage";
import {
  cloudflareImageModel,
  cloudflareWorkerSecret,
  cloudflareWorkerUrl,
  imageGenerationDebug,
  imageGenerationProvider,
  imageGenerationTimeoutMs,
} from "@/lib/ai/config";
import { puterRelayConnected } from "@/lib/marketing/puter-relay-store";
import type {
  GenerateProductImageRequest,
  GenerateProductImageResult,
  ImageProviderStatus,
  ProviderId,
} from "@/lib/ai/types";

/**
 * Provider abstraction for product image generation.
 *
 *   Browser → Next.js API route → this module → provider
 *
 *  · "cloudflare"  → the standalone Cloudflare Worker (Workers AI, env.AI)
 *  · "puter"       → the existing browser relay: a signed-in admin browser
 *                    (Saree AI Studio / Marketing AI tab) polls the relay job
 *                    queue and runs puter.ai.txt2img under its own account
 *
 * Server-only by design — Puter browser code is never imported here, so the
 * bundler cannot leak `puter`/`window` references into server modules and the
 * secrets stay server-side.
 */

export const DEFAULT_SAREE_PROMPT = [
  "Create a realistic professional Indian fashion catalogue photograph.",
  // Extra-limb guard: multi-reference models fuse people/hands out of the
  // reference photos. State the anatomy budget explicitly and repeatedly.
  "FINAL IMAGE RULE: exactly ONE woman appears in the photo — one head, exactly two arms, exactly two hands, exactly two legs, exactly ten fingers total. No extra arms, no extra hands, no duplicate or detached limbs, no second person, no reflection of a person.",
  "INPUT IMAGE 1 is the MODEL REFERENCE. Preserve the model's identity, facial structure, age appearance, hairstyle, skin tone and realistic body proportions. She is the ONLY person in the output.",
  "INPUT IMAGE 2 is the EXACT SAREE PRODUCT REFERENCE. The saree shown in INPUT IMAGE 2 is the source of truth.",
  "Dress the model in the exact saree from the product reference. Preserve the saree's exact colour, print, motifs, border, pallu, fabric appearance, decorative details, pattern placement and overall visual identity.",
  "INPUT IMAGE 2 shows FABRIC ONLY — if any person, mannequin, hand, arm or body part is visible inside INPUT IMAGE 2, ignore it completely: copy the fabric, never people or limbs from it.",
  "Do not redesign, recolour, simplify, replace or invent the saree.",
  "Create a natural and realistic Indian saree drape with realistic pleats, realistic pallu, natural fabric folds, believable fabric weight, realistic shadows, correct garment geometry and realistic interaction between fabric and body.",
  "The model should look like a real Indian/Bengali fashion catalogue model: realistic Bengali/Indian woman, natural dark hair, subtle makeup, small tasteful bindi, minimal elegant jewellery, healthy realistic body proportions, natural expression.",
  "Photography: premium Indian ecommerce catalogue photography, realistic skin texture, exactly two arms and two hands with five fingers each, anatomically correct arms attached only at the two shoulders, realistic anatomy, natural studio lighting, clean premium background, soft realistic shadows, high-quality fashion photography, full-body or three-quarter-body composition, saree must remain the main subject.",
  "Do not add text, logo, watermark, price, promotional graphics, random jewellery, random clothing or extra people.",
  "Do not change the model's identity. Do not change the saree. The result must look like a real ecommerce fashion photograph.",
].join("\n");

const ASPECT_DIMENSIONS: Record<NonNullable<GenerateProductImageRequest["aspectRatio"]>, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "3:4": { width: 896, height: 1152 },
  "4:5": { width: 896, height: 1152 },
  "9:16": { width: 768, height: 1344 },
};

export function providerStatus(): ImageProviderStatus {
  const provider = imageGenerationProvider();
  const debug = imageGenerationDebug();
  const workerUrl = cloudflareWorkerUrl();
  return {
    provider,
    model:
      provider === "cloudflare"
        ? cloudflareImageModel()
        : "gpt-image-2.5-flare (browser relay)",
    workerUrl: debug ? workerUrl : undefined,
    debug,
    puterRelayConnected: puterRelayConnected(),
    cloudflareConfigured: Boolean(workerUrl),
  };
}

/** Convert any supported input (data URL, base64, http(s) URL) to bytes. */
async function imageInputToBytes(input: string): Promise<{ bytes: Buffer; contentType: string }> {
  const trimmed = input.trim();
  if (trimmed.startsWith("data:")) {
    const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(trimmed);
    if (!m) throw new Error("Invalid data URL image");
    return { bytes: Buffer.from(m[2]!, "base64"), contentType: m[1] || "image/jpeg" };
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(trimmed.slice(0, 200)) || trimmed.length < 200) {
    // Not plausibly raw base64 → treat as URL.
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    const fetched = await fetchImageBytes(trimmed);
    return { bytes: fetched.bytes, contentType: fetched.contentType };
  }
  // Assume raw base64.
  return { bytes: Buffer.from(trimmed, "base64"), contentType: "image/jpeg" };
}

/* ------------------------------------------------------------------ */
/* Cloudflare Worker provider                                          */
/* ------------------------------------------------------------------ */

interface CloudflareWorkerResponse {
  success?: boolean;
  provider?: string;
  model?: string;
  /** Base64 (no data: prefix) image. */
  image?: string;
  contentType?: string;
  error?: string;
}

async function generateWithCloudflare(
  request: GenerateProductImageRequest,
  startedAt: number,
): Promise<GenerateProductImageResult> {
  const workerUrl = cloudflareWorkerUrl();
  const model = cloudflareImageModel();
  if (!workerUrl) {
    return {
      success: false,
      provider: "cloudflare",
      model,
      durationMs: Date.now() - startedAt,
      error:
        "Cloudflare image worker is not configured. Set CLOUDFLARE_IMAGE_WORKER_URL in .env.local (e.g. http://localhost:8787) and start it with `npx wrangler dev`.",
    };
  }

  try {
    // Normalize inputs before transport: the worker accepts data URLs but the
    // saree reference must survive intact, so nothing is downscaled here.
    const saree = await imageInputToBytes(request.sareeImage);
    const modelRef = await imageInputToBytes(request.modelImage);

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const secret = cloudflareWorkerSecret();
    if (secret) headers.Authorization = `Bearer ${secret}`;

    const res = await fetch(`${workerUrl}/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt: request.prompt?.trim() || DEFAULT_SAREE_PROMPT,
        modelImage: `data:${modelRef.contentType};base64,${modelRef.bytes.toString("base64")}`,
        sareeImage: `data:${saree.contentType};base64,${saree.bytes.toString("base64")}`,
        poseImage: request.poseImage
          ? await imageInputToBytes(request.poseImage).then((r) => `data:${r.contentType};base64,${r.bytes.toString("base64")}`)
          : undefined,
        backgroundImage: request.backgroundImage
          ? await imageInputToBytes(request.backgroundImage).then((r) => `data:${r.contentType};base64,${r.bytes.toString("base64")}`)
          : undefined,
        aspectRatio: request.aspectRatio,
      }),
      signal: AbortSignal.timeout(imageGenerationTimeoutMs()),
    });

    const raw = (await res.json().catch(() => ({}))) as CloudflareWorkerResponse;
    if (!res.ok || !raw.success || !raw.image) {
      const friendly = cloudflareFriendlyError(res.status, raw.error);
      return {
        success: false,
        provider: "cloudflare",
        model: raw.model ?? model,
        durationMs: Date.now() - startedAt,
        error: friendly,
      };
    }
    const contentType = raw.contentType ?? "image/png";
    return {
      success: true,
      provider: "cloudflare",
      model: raw.model ?? model,
      imageBase64: raw.image,
      imageUrl: `data:${contentType};base64,${raw.image}`,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const friendly = /timeout|abort/i.test(message)
      ? "Cloudflare image generation timed out. Try again — the first request after a worker cold start can be slow."
      : /fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(message)
        ? "Cloudflare image worker is unavailable. Start it with `npx wrangler dev` in cloudflare/image-worker, then retry."
        : `Cloudflare image generation failed: ${message}`;
    return {
      success: false,
      provider: "cloudflare",
      model,
      durationMs: Date.now() - startedAt,
      error: friendly,
    };
  }
}

function cloudflareFriendlyError(status: number, workerError?: string): string {
  if (status === 401 || status === 403) {
    return "Cloudflare image worker rejected the request (401/403). Check CLOUDFLARE_IMAGE_WORKER_SECRET on both sides.";
  }
  if (status === 413) {
    return "The reference images are too large for the worker. Use a smaller saree/model photo (under 8 MB).";
  }
  if (status === 429) {
    return "Cloudflare image generation failed: Workers AI daily free allocation may have been reached. Try again after the daily reset.";
  }
  if (status >= 500) {
    return `Cloudflare Workers AI error (${status}). ${workerError ?? "The model may be temporarily unavailable — retry shortly."}`;
  }
  return workerError || `Cloudflare image generation failed (HTTP ${status}).`;
}

/* ------------------------------------------------------------------ */
/* Puter provider (existing browser relay)                             */
/* ------------------------------------------------------------------ */

async function generateWithPuter(
  request: GenerateProductImageRequest,
  startedAt: number,
): Promise<GenerateProductImageResult> {
  if (!puterRelayConnected()) {
    return {
      success: false,
      provider: "puter",
      model: "gpt-image-2.5-flare",
      durationMs: Date.now() - startedAt,
      error:
        "No Puter browser worker is connected. Open Admin → Marketing AI (or the Saree AI Studio tab), sign in to Puter, and keep that tab open — it picks up generation jobs.",
    };
  }

  // The relay contract is text-to-image: the browser worker runs
  // puter.ai.txt2img(prompt), so the saree + model references are folded into
  // the prompt text. (True pixel-level reference generation is what the
  // Cloudflare path provides.)
  const prompt = request.prompt?.trim() || DEFAULT_SAREE_PROMPT;
  const relay = await import("@/lib/marketing/puter-relay-store");
  const job = relay.createPuterRelayJob({
    prompt,
    imageDataUrl: "",
    product: { name: "Product image", category: "product-image", price: 199 },
    width: 1080,
    height: 1080,
    format: "square",
  });
  const completed = await relay.waitForPuterRelayJob(job.id, imageGenerationTimeoutMs());
  if (completed.status === "failed" || (!completed.imageDataUrl && !completed.imageUrl)) {
    return {
      success: false,
      provider: "puter",
      model: "gpt-image-2.5-flare",
      durationMs: Date.now() - startedAt,
      error: completed.error || "Puter relay returned no image",
    };
  }
  const dataUrl = completed.imageDataUrl ?? completed.imageUrl ?? "";
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl);
  return {
    success: true,
    provider: "puter",
    model: "gpt-image-2.5-flare",
    imageBase64: m?.[2],
    imageUrl: m ? dataUrl : undefined,
    durationMs: Date.now() - startedAt,
  };
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export async function generateProductImage(
  request: GenerateProductImageRequest,
): Promise<GenerateProductImageResult> {
  const startedAt = Date.now();
  const provider: ProviderId = imageGenerationProvider();
  return provider === "cloudflare"
    ? generateWithCloudflare(request, startedAt)
    : generateWithPuter(request, startedAt);
}

/** Aspect helpers reused by the worker and the UI preview. */
export function aspectDimensions(ratio?: GenerateProductImageRequest["aspectRatio"]) {
  return ASPECT_DIMENSIONS[ratio ?? "3:4"];
}
