/**
 * Pipeline orchestrator — advances a product through its NEXT pipeline stage.
 *
 * The API layer calls `advanceProduct(slug)`; each invocation performs at
 * most one stage and persists the new state, so a cron/worker (or repeated
 * admin "Process queue" clicks) walks products to completion:
 *
 *   pending → tryon → copy → video → publish → published
 *
 * Stage data flows through the product's marketing blob (lib/marketing/types).
 * Any stage failure moves the row to `failed` with the error recorded, ready
 * for admin retry.
 */
import "server-only";
import { loadPipelineSecrets } from "@/lib/marketing/secrets";
import { runTryOn, tryOnFromContext } from "@/lib/marketing/tryon";
import { generateAdCopy, type CopyLanguage } from "@/lib/marketing/copy";
import { renderReel } from "@/lib/marketing/video";
import { publishReel } from "@/lib/marketing/publish";
import { uploadPipelineAsset, fetchImageBytes } from "@/lib/marketing/storage";
import { baseModels, pipelineProduct, setMarketing } from "@/lib/marketing/store";
import { advancePipeline } from "@/lib/marketing/status";
import { productPhoto } from "@/lib/photos";
import { SITE } from "@/lib/site";
import type {
  AdvanceContext,
  MarketingData,
  PipelineStatus,
} from "@/lib/marketing/types";
import type { DbProduct } from "@/lib/demo/db";

export interface AdvanceOutcome {
  slug: string;
  from: PipelineStatus;
  to: PipelineStatus;
  marketing: MarketingData;
  note?: string;
}

/** Site URL for CTAs (Vercel-aware via lib/site). */
function siteUrl(): string {
  return SITE.url;
}

async function fail(
  slug: string,
  marketing: MarketingData,
  error: unknown,
): Promise<MarketingData> {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[marketing] ${slug} failed:`, msg);
  const next = advancePipeline(marketing, "failed", { error: msg });
  await setMarketing(slug, next);
  return next;
}

/**
 * Advance one product by one stage. Returns the outcome; throws only on
 * precondition problems (product not found / not in the pipeline).
 */
export async function advanceProduct(slug: string): Promise<AdvanceOutcome> {
  const row = await pipelineProduct(slug);
  if (!row) throw new Error("Product not found");
  const marketing = row.marketing;
  const from = marketing.pipeline.status;

  try {
    switch (from) {
      case "pending":
        return await stageTryOn(row, marketing);
      case "tryon_processing":
        // A previous try-on crashed mid-flight — the data is in tryOn only
        // after completion, so re-run from try-on.
        return await stageTryOn(row, marketing);
      case "tryon_completed":
        // Persist the rendering state first so the UI shows progress during
        // the (slow) copy + ffmpeg stage, then render.
        await setMarketing(slug, advancePipeline(marketing, "rendering_video"));
        return await stageCopyAndVideo(row, await (await pipelineProduct(slug))!.marketing);
      case "rendering_video":
        return await stageCopyAndVideo(row, marketing);
      case "publishing":
        return await stagePublish(row, marketing);
      case "published":
        return { slug, from, to: "published", marketing, note: "Already published" };
      case "failed":
        throw new Error("Product is in failed state — retry it first");
      default:
        throw new Error(`Unknown pipeline status: ${from}`);
    }
  } catch (error) {
    const nextMarketing = await fail(slug, marketing, error);
    return { slug, from, to: "failed", marketing: nextMarketing, note: (error as Error).message };
  }
}

/* ------------------------------- stage: try-on ------------------------------- */

async function stageTryOn(
  row: DbProduct,
  marketing: MarketingData,
): Promise<AdvanceOutcome> {
  const slug = row.slug;
  await setMarketing(slug, advancePipeline(marketing, "tryon_processing"));

  const secrets = await loadPipelineSecrets();
  const models = await baseModels();
  const ctx = buildCtx(row, marketing);
  const input = tryOnFromContext(ctx, models, { tryOnSpace: secrets.tryOnSpace });

  const result = await runTryOn(input);
  const stored = await uploadPipelineAsset(
    "model-renders",
    `${slug}-tryon.jpg`,
    result.bytes,
    result.contentType,
  );

  const next = advancePipeline(
    await (await pipelineProduct(slug))!.marketing,
    "tryon_completed",
    { tryOn: { imageUrl: stored.url, modelId: input.modelId, provider: result.provider } },
  );
  await setMarketing(slug, next);
  return { slug, from: "pending", to: "tryon_completed", marketing: next };
}

/* -------------------------- stage: copy + video -------------------------- */

async function stageCopyAndVideo(
  row: DbProduct,
  marketing: MarketingData,
): Promise<AdvanceOutcome> {
  const slug = row.slug;
  const secrets = await loadPipelineSecrets();
  const ctx = buildCtx(row, marketing);

  // Copy (Gemini → Groq → template) — cheap, do it before the video render.
  const language: CopyLanguage =
    (marketing.copy?.language as CopyLanguage) ?? "hinglish";
  const { copy, engine } = await generateAdCopy(ctx, language, secrets);

  // Scene B: the raw saree fabric photo (admin upload, else the editorial shot).
  const garmentUrl = row.images[0] ?? productPhoto(row.slug);
  if (!garmentUrl) throw new Error("Product has no photo — upload one in Admin → Products first");
  const fabric = await fetchImageBytes(garmentUrl);
  const tryOnBytes = marketing.tryOn?.imageUrl
    ? (await fetchImageBytes(marketing.tryOn.imageUrl)).bytes
    : fabric.bytes;

  const reel = await renderReel({
    tryOnBytes,
    fabricBytes: fabric.bytes,
    price: row.price,
    productName: row.name,
  });
  const stored = await uploadPipelineAsset(
    "reels",
    `${slug}-reel.mp4`,
    reel.mp4,
    "video/mp4",
  );

  const next = advancePipeline(marketing, "publishing", {
    copy: { ...copy, language: `${copy.language} (${engine})` },
    video: { url: stored.url, storagePath: stored.storagePath, engine: reel.engine },
  });
  await setMarketing(slug, next);
  return { slug, from: "tryon_completed", to: "publishing", marketing: next };
}

/* ------------------------------ stage: publish ------------------------------ */

async function stagePublish(
  row: DbProduct,
  marketing: MarketingData,
): Promise<AdvanceOutcome> {
  const slug = row.slug;
  const secrets = await loadPipelineSecrets();

  if (!marketing.video?.url) throw new Error("No video rendered yet");
  if (!marketing.copy) throw new Error("No ad copy generated yet");

  const missing = [
    !secrets.metaPageToken && "meta_page_access_token",
    !secrets.fbPageId && "meta_fb_page_id",
    !secrets.igUserId && "meta_ig_user_id",
  ].filter(Boolean) as string[];
  if (missing.length > 0) {
    throw new Error(
      `Meta publishing is not configured (missing: ${missing.join(", ")}) — add them in Supabase app_secrets`,
    );
  }

  const result = await publishReel(marketing.video.url, marketing.copy, {
    metaPageToken: secrets.metaPageToken!,
    fbPageId: secrets.fbPageId!,
    igUserId: secrets.igUserId!,
  });

  const next = advancePipeline(marketing, "published", {
    publish: { ...result, publishedAt: new Date().toISOString() },
  });
  await setMarketing(slug, next);
  return { slug, from: "publishing", to: "published", marketing: next };
}

/* --------------------------------- helpers --------------------------------- */

function buildCtx(row: DbProduct, marketing: MarketingData): AdvanceContext {
  return {
    product: {
      id: row.id,
      slug: row.slug,
      name: row.name,
      category: row.category,
      fabric: row.fabric,
      price: row.price,
      images: row.images ?? [],
    },
    marketing,
    siteUrl: siteUrl(),
  };
}
