import "server-only";

/**
 * Image-generation provider configuration — the ONLY place env vars are read.
 *
 * Switching provider is an env change + server restart, never a code change:
 *
 *   IMAGE_GENERATION_PROVIDER=puter       → existing browser-relay Puter flow
 *   IMAGE_GENERATION_PROVIDER=cloudflare  → Cloudflare Worker → Workers AI
 *
 * Cloudflare secrets stay server-side; nothing here is NEXT_PUBLIC_*.
 */

export type ImageGenerationProvider = "puter" | "cloudflare";

export const DEFAULT_CLOUDFLARE_IMAGE_MODEL = "@cf/black-forest-labs/flux-2-klein-4b";

export function imageGenerationProvider(): ImageGenerationProvider {
  const raw = (process.env.IMAGE_GENERATION_PROVIDER ?? "puter").trim().toLowerCase();
  return raw === "cloudflare" ? "cloudflare" : "puter";
}

/** Base URL of the independently deployed Cloudflare image worker. */
export function cloudflareWorkerUrl(): string | undefined {
  const url = process.env.CLOUDFLARE_IMAGE_WORKER_URL?.trim();
  return url ? url.replace(/\/+$/, "") : undefined;
}

/** Optional shared secret; sent as `Authorization: Bearer <secret>` to the worker. */
export function cloudflareWorkerSecret(): string | undefined {
  return process.env.CLOUDFLARE_IMAGE_WORKER_SECRET?.trim() || undefined;
}

/**
 * Display fallback for the model name. The worker itself owns the real model
 * via its own CLOUDFLARE_IMAGE_MODEL var and always reports what it used.
 */
export function cloudflareImageModel(): string {
  return process.env.CLOUDFLARE_IMAGE_MODEL?.trim() || DEFAULT_CLOUDFLARE_IMAGE_MODEL;
}

/** Whole flow budget for one generation (worker round-trip or Puter relay). */
export function imageGenerationTimeoutMs(): number {
  const n = Number(process.env.IMAGE_GENERATION_TIMEOUT_MS ?? 150_000);
  return Number.isFinite(n) && n > 10_000 ? n : 150_000;
}

/**
 * Developer debug panel (provider/model/worker URL) — on by default in
 * development, off in production unless IMAGE_GENERATION_DEBUG=true.
 */
export function imageGenerationDebug(): boolean {
  const flag = process.env.IMAGE_GENERATION_DEBUG?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export interface ImageProviderInfo {
  provider: ImageGenerationProvider;
  model: string;
  /** Only present for cloudflare; only included when debug is enabled. */
  workerUrl?: string;
  debug: boolean;
  /** True when a signed-in Puter browser worker is polling the relay. */
  puterRelayConnected?: boolean;
}

export function imageProviderInfo(): ImageProviderInfo {
  const provider = imageGenerationProvider();
  const debug = imageGenerationDebug();
  return {
    provider,
    model:
      provider === "cloudflare"
        ? cloudflareImageModel()
        : "gpt-image-2.5-flare (browser relay)",
    workerUrl: debug ? cloudflareWorkerUrl() : undefined,
    debug,
    puterRelayConnected: undefined,
  };
}
