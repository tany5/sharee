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
import { runTryOn, tryOnGalleryFromContext } from "@/lib/marketing/tryon";
import { generateAdCopy, type CopyLanguage } from "@/lib/marketing/copy";
import { renderReel } from "@/lib/marketing/video";
import { renderImagePosts } from "@/lib/marketing/posts";
import { publishReel } from "@/lib/marketing/publish";
import { uploadPipelineAsset, fetchImageBytes } from "@/lib/marketing/storage";
import {
  appendProductImages,
  baseModels,
  pipelineProduct,
  setMarketing,
} from "@/lib/marketing/store";
import { advancePipeline } from "@/lib/marketing/status";
import { productPhoto } from "@/lib/photos";
import { SITE } from "@/lib/site";
import type {
  AdvanceContext,
  MarketingData,
  PipelineStatus,
  TryOnRender,
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
  const inputs = tryOnGalleryFromContext(ctx, models, {
    tryOnSpace: secrets.tryOnSpace,
    hfToken: secrets.hfToken,
  });
  const renders: TryOnRender[] = [];
  for (const input of inputs) {
    const result = await runTryOn(input);
    const stored = await uploadPipelineAsset(
      "model-renders",
      `${slug}-${input.pose}-tryon.jpg`,
      result.bytes,
      result.contentType,
    );
    renders.push({
      kind: input.pose,
      imageUrl: stored.url,
      storagePath: stored.storagePath,
      modelId: input.modelId,
      provider: result.provider,
    });
  }
  const first = renders[0];
  if (!first) throw new Error("Try-on generated no catalogue images");

  const next = advancePipeline(
    await (await pipelineProduct(slug))!.marketing,
    "tryon_completed",
    {
      tryOn: {
        imageUrl: first.imageUrl,
        modelId: first.modelId,
        provider: first.provider,
        renders,
      },
    },
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
  const catalogueUrls = marketing.tryOn?.renders?.map((render) => render.imageUrl) ?? [];
  const heroTryOnUrl = catalogueUrls[0] ?? marketing.tryOn?.imageUrl;
  const tryOnBytes = heroTryOnUrl
    ? (await fetchImageBytes(heroTryOnUrl)).bytes
    : fabric.bytes;
  const catalogueBytes = await Promise.all(
    catalogueUrls.slice(0, 3).map(async (url) => (await fetchImageBytes(url)).bytes),
  );
  const imagePosts = await renderImagePosts({
    tryOnBytes,
    sideBytes: catalogueBytes[1],
    backBytes: catalogueBytes[2],
    fabricBytes: fabric.bytes,
    price: row.price,
    productName: row.name,
    copy,
  });
  const storedPosts = await Promise.all(
    imagePosts.map(async (post) => {
      const stored = await uploadPipelineAsset(
        "model-renders",
        `${slug}-${post.kind}-post.jpg`,
        post.bytes,
        post.contentType,
      );
      return {
        kind: post.kind,
        url: stored.url,
        storagePath: stored.storagePath,
      };
    }),
  );

  const reel = await renderReel({
    tryOnBytes,
    fabricBytes: fabric.bytes,
    galleryBytes: catalogueBytes,
    price: row.price,
    productName: row.name,
    musicUrl: secrets.musicUrl,
  });
  const stored = await uploadPipelineAsset(
    "reels",
    `${slug}-reel.mp4`,
    reel.mp4,
    "video/mp4",
  );
  await appendProductImages(slug, [
    ...(marketing.tryOn?.renders?.map((render) => render.imageUrl) ?? []),
    ...(marketing.tryOn?.imageUrl ? [marketing.tryOn.imageUrl] : []),
  ]);

  const next = advancePipeline(marketing, "publishing", {
    copy: { ...copy, language: `${copy.language} (${engine})` },
    posts: storedPosts,
    video: {
      url: stored.url,
      storagePath: stored.storagePath,
      engine: reel.engine,
      durationSec: reel.durationSec,
    },
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

  const result = await publishReel(
    marketing.video.url,
    marketing.copy,
    {
      metaPageToken: secrets.metaPageToken!,
      fbPageId: secrets.fbPageId!,
      igUserId: secrets.igUserId!,
    },
    marketing.posts?.map((p) => p.url) ?? [],
  );

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
