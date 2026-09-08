/**
 * AI marketing pipeline types ("Saree → Reel" automation).
 *
 * A product entering the pipeline walks the states below. All state lives in
 * the product row: Supabase `products.marketing` (jsonb) / demo `DbProduct`.
 *
 *   pending → tryon_processing → tryon_completed → rendering_video
 *           → publishing → published        (any step → failed)
 */

export type PipelineStatus =
  | "pending"
  | "tryon_processing"
  | "tryon_completed"
  | "rendering_video"
  | "publishing"
  | "published"
  | "failed";

export const PIPELINE_STATUSES: PipelineStatus[] = [
  "pending",
  "tryon_processing",
  "tryon_completed",
  "rendering_video",
  "publishing",
  "published",
  "failed",
];

/** Ordered stages before terminal states (drives the UI progress rail). */
export const PIPELINE_STAGES: PipelineStatus[] = [
  "pending",
  "tryon_processing",
  "tryon_completed",
  "rendering_video",
  "publishing",
];

export const PIPELINE_STATUS_LABEL: Record<PipelineStatus, string> = {
  pending: "Queued",
  tryon_processing: "AI Try-On",
  tryon_completed: "Try-On Ready",
  rendering_video: "Rendering Video",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
};

/** Extra states stored in db_status on Supabase (mirror of the pipeline). */
export const DB_STATUS_PIPELINE: Record<
  Exclude<PipelineStatus, "pending">,
  string
> = {
  tryon_processing: "tryon_processing",
  tryon_completed: "tryon_completed",
  rendering_video: "rendering_video",
  publishing: "publishing",
  published: "published",
  failed: "failed",
};

export interface PipelineState {
  status: PipelineStatus;
  attempts: number;
  queuedAt?: string;
  tryOnStartedAt?: string;
  tryOnCompletedAt?: string;
  videoStartedAt?: string;
  videoCompletedAt?: string;
  publishStartedAt?: string;
  publishedAt?: string;
  failedAt?: string;
  error?: string;
}

export interface TryOnData {
  /** Public URL of the AI-rendered "model wearing the saree" image. */
  imageUrl?: string;
  /** Which base model avatar was used. */
  modelId?: string;
  /** Try-on provider used ("kolors" | "idm-vton" | "mock"). */
  provider?: string;
  /** Clean catalogue-style model renders for the product gallery. */
  renders?: TryOnRender[];
}

export interface TryOnRender {
  kind: "front" | "side" | "back";
  imageUrl: string;
  storagePath?: string;
  modelId?: string;
  provider?: string;
}

export interface AdCopy {
  /** Scroll-stopping hook line. */
  headline: string;
  bullets: string[];
  /** Call to action incl. the product link. */
  cta: string;
  hashtags: string[];
  language: string;
}

export interface VideoData {
  url?: string;
  storagePath?: string;
  /** Render engine used ("ffmpeg" | "mock"). */
  engine?: string;
  durationSec?: number;
}

export interface ImagePostData {
  kind: "front" | "back" | "detail" | "price" | "model" | "catalogue";
  url: string;
  storagePath?: string;
}

export interface PublishData {
  fbPostId?: string;
  igMediaId?: string;
  fbPhotoIds?: string[];
  igImageIds?: string[];
  publishedAt?: string;
  caption?: string;
}

export interface MarketingData {
  pipeline: PipelineState;
  tryOn?: TryOnData;
  copy?: AdCopy;
  video?: VideoData;
  posts?: ImagePostData[];
  publish?: PublishData;
}

/** A curated base model avatar stored in the `base-models` bucket. */
export interface BaseModel {
  id: string;
  name: string;
  imageUrl: string;
}

/** In-memory record for the advance engine's between-stage context. */
export interface AdvanceContext {
  product: {
    id: string;
    slug: string;
    name: string;
    category: string;
    fabric?: string;
    price: number;
    images: string[];
  };
  marketing: MarketingData;
  siteUrl: string;
}

export function emptyPipeline(): PipelineState {
  return { status: "pending", attempts: 0, queuedAt: new Date().toISOString() };
}

/** Parse the marketing blob defensively (never throws). */
export function parseMarketing(raw: unknown): MarketingData {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const pipelineRaw = (obj.pipeline ?? {}) as Record<string, unknown>;
  const status = PIPELINE_STATUSES.includes(pipelineRaw.status as PipelineStatus)
    ? (pipelineRaw.status as PipelineStatus)
    : "pending";
  const pipeline: PipelineState = {
    status,
    attempts: Number.isFinite(pipelineRaw.attempts) ? Number(pipelineRaw.attempts) : 0,
    queuedAt: typeof pipelineRaw.queuedAt === "string" ? pipelineRaw.queuedAt : undefined,
    tryOnStartedAt: typeof pipelineRaw.tryOnStartedAt === "string" ? pipelineRaw.tryOnStartedAt : undefined,
    tryOnCompletedAt:
      typeof pipelineRaw.tryOnCompletedAt === "string" ? pipelineRaw.tryOnCompletedAt : undefined,
    videoStartedAt: typeof pipelineRaw.videoStartedAt === "string" ? pipelineRaw.videoStartedAt : undefined,
    videoCompletedAt:
      typeof pipelineRaw.videoCompletedAt === "string" ? pipelineRaw.videoCompletedAt : undefined,
    publishStartedAt:
      typeof pipelineRaw.publishStartedAt === "string" ? pipelineRaw.publishStartedAt : undefined,
    publishedAt: typeof pipelineRaw.publishedAt === "string" ? pipelineRaw.publishedAt : undefined,
    failedAt: typeof pipelineRaw.failedAt === "string" ? pipelineRaw.failedAt : undefined,
    error: typeof pipelineRaw.error === "string" ? pipelineRaw.error : undefined,
  };
  const copy = obj.copy as AdCopy | undefined;
  const tryOnRaw = obj.tryOn as TryOnData | undefined;
  const renders = Array.isArray(tryOnRaw?.renders)
    ? tryOnRaw.renders.filter(
        (r) =>
          r &&
          typeof r === "object" &&
          typeof r.imageUrl === "string" &&
          ["front", "side", "back"].includes(String(r.kind)),
      )
    : undefined;
  const tryOn = tryOnRaw
    ? { ...tryOnRaw, renders: renders?.length ? renders : undefined }
    : undefined;
  const video = obj.video as VideoData | undefined;
  const posts = Array.isArray(obj.posts)
    ? (obj.posts as ImagePostData[]).filter(
        (p) =>
          p &&
          typeof p === "object" &&
          typeof p.url === "string" &&
          ["front", "back", "detail", "price", "model", "catalogue"].includes(
            String(p.kind),
          ),
      )
    : undefined;
  const publish = obj.publish as PublishData | undefined;
  return {
    pipeline,
    copy: copy && typeof copy.headline === "string" ? copy : undefined,
    tryOn:
      tryOn && (typeof tryOn.imageUrl === "string" || tryOn.renders?.length)
        ? tryOn
        : undefined,
    video: video && typeof video.url === "string" ? video : undefined,
    posts: posts?.length ? posts : undefined,
    publish: publish && typeof publish.publishedAt === "string" ? publish : undefined,
  };
}
