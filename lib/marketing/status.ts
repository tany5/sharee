/**
 * Pipeline state machine — pure helpers (unit-tested).
 *
 * On Supabase the pipeline status is mirrored into `db_status` so the existing
 * RLS/admin filters keep working; the demo store keeps products in
 * `dbStatus: "active"` and tracks everything in `marketing`.
 */
import type {
  AdvanceContext,
  MarketingData,
  PipelineStatus,
} from "@/lib/marketing/types";

/** Allowed forward transitions (any state may additionally fail). */
const TRANSITIONS: Partial<Record<PipelineStatus, PipelineStatus>> = {
  pending: "tryon_processing",
  tryon_processing: "tryon_completed",
  tryon_completed: "rendering_video",
  rendering_video: "publishing",
  publishing: "published",
};

export function canAdvance(from: PipelineStatus): boolean {
  return TRANSITIONS[from] !== undefined;
}

export function nextStatus(from: PipelineStatus): PipelineStatus | null {
  return TRANSITIONS[from] ?? null;
}

/** Mirror of the pipeline status into the `db_status` column (Supabase). */
export function dbStatusFor(status: PipelineStatus): string {
  return status === "pending" ? "draft" : status;
}

/**
 * Timestamp key to stamp for a status (the moment we ENTER that status).
 */
export function timestampKeyFor(status: PipelineStatus): keyof MarketingData["pipeline"] | null {
  switch (status) {
    case "tryon_processing":
      return "tryOnStartedAt";
    case "tryon_completed":
      return "tryOnCompletedAt";
    case "rendering_video":
      return "videoStartedAt";
    case "publishing":
      return "publishStartedAt";
    case "published":
      return "publishedAt";
    case "failed":
      return "failedAt";
    default:
      return null;
  }
}

/**
 * Advance a marketing blob to `to`, merging per-stage data and stamps.
 * Pure: returns a new object, validates the transition, throws on illegal moves.
 */
export function advancePipeline(
  marketing: MarketingData,
  to: PipelineStatus,
  patch?: Partial<Pick<MarketingData, "tryOn" | "copy" | "video" | "posts" | "publish">> & {
    error?: string;
  },
): MarketingData {
  const from = marketing.pipeline.status;
  const allowed =
    TRANSITIONS[from] === to ||
    to === "failed" || // any non-terminal stage may fail
    (from === "tryon_completed" && to === "tryon_completed"); // retry no-op
  if (!allowed) {
    throw new Error(`Illegal pipeline transition: ${from} → ${to}`);
  }

  const key = timestampKeyFor(to);
  const pipeline: MarketingData["pipeline"] = {
    ...marketing.pipeline,
    status: to,
    attempts: marketing.pipeline.attempts + 1,
    ...(key ? { [key]: new Date().toISOString() } : {}),
    ...(to === "failed"
      ? { error: patch?.error ?? "Unknown error" }
      : to !== "tryon_completed"
        ? { error: undefined }
        : {}),
  };

  return {
    ...marketing,
    pipeline,
    ...(patch?.tryOn ? { tryOn: { ...marketing.tryOn, ...patch.tryOn } } : {}),
    ...(patch?.copy ? { copy: { ...marketing.copy, ...patch.copy } } : {}),
    ...(patch?.video ? { video: { ...marketing.video, ...patch.video } } : {}),
    ...(patch?.posts ? { posts: patch.posts } : {}),
    ...(patch?.publish ? { publish: { ...marketing.publish, ...patch.publish } } : {}),
  };
}

/** Reset a failed (or stuck) product back to the queue for another attempt. */
export function resetForRetry(marketing: MarketingData): MarketingData {
  return {
    ...marketing,
    pipeline: {
      ...marketing.pipeline,
      status: "pending",
      error: undefined,
      queuedAt: new Date().toISOString(),
    },
  };
}

/** Build the advance-engine context from a product row. */
export function buildContext(
  p: {
    id: string;
    slug: string;
    name: string;
    category: string;
    fabric?: string;
    price: number;
    images?: string[];
  },
  marketing: MarketingData,
  siteUrl: string,
): AdvanceContext {
  return {
    product: {
      id: p.id,
      slug: p.slug,
      name: p.name,
      category: p.category,
      fabric: p.fabric,
      price: p.price,
      images: p.images ?? [],
    },
    marketing,
    siteUrl,
  };
}
