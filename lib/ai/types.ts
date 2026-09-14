/**
 * Shared contracts for the image-generation provider layer.
 * Imported by both server code and client components — keep it dependency-free.
 */

export type ProviderId = "puter" | "cloudflare";

/** Inputs accepted by the provider layer. */
export interface GenerateProductImageRequest {
  /** The saree product photo — the source of truth for colour/border/pallu. */
  sareeImage: string;
  /** Model reference photo (existing Saree Models system). */
  modelImage: string;
  /** Optional pose reference (front/side/back exemplar). */
  poseImage?: string;
  /** Optional background reference for scene style. */
  backgroundImage?: string;
  prompt?: string;
  aspectRatio?: "1:1" | "3:4" | "4:5" | "9:16";
}

/** Normalized result every provider returns. */
export interface GenerateProductImageResult {
  success: boolean;
  /** data URL when the image bytes are available inline. */
  imageUrl?: string;
  imageBase64?: string;
  provider: ProviderId | string;
  model: string;
  durationMs?: number;
  error?: string;
}

/** Debug/status payload served to the admin UI. */
export interface ImageProviderStatus {
  provider: ProviderId;
  model: string;
  /** Only populated when debug mode is on (dev default). */
  workerUrl?: string;
  debug: boolean;
  puterRelayConnected: boolean;
  cloudflareConfigured: boolean;
}
