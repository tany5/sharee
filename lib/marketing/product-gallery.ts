import "server-only";
import { baseModels, pipelineProduct } from "@/lib/marketing/store";
import { loadPipelineSecrets } from "@/lib/marketing/secrets";
import { pickRandomBaseModel, runTryOn, type TryOnPose } from "@/lib/marketing/tryon";
import { uploadPipelineAsset } from "@/lib/marketing/storage";
import { parseMarketing, type MarketingData, type TryOnRender } from "@/lib/marketing/types";
import { isSupabaseBackend } from "@/lib/backend/env";
import { supabaseServer } from "@/lib/supabase/server";
import type { DbProduct } from "@/lib/demo/db";

/**
 * Product photo generation — "upload a saree photo, get model-wearing shots".
 *
 * Designed to be RESUMABLE and incremental: each call generates as many of
 * the missing poses as the time budget allows, persisting every image the
 * moment it lands (so partial progress is never lost and no single request
 * outlives a serverless timeout). The admin editor drives the loop with
 * repeated calls until `remaining` is empty.
 */
const ALL_POSES: TryOnPose[] = ["front", "side", "back"];
const DEFAULT_BUDGET_MS = 55_000;
const MAX_PRODUCT_IMAGES = 8;

export interface GenerateGalleryInput {
  slug: string;
  name?: string;
  /** The admin-uploaded saree photo (the garment source). */
  garmentUrl?: string;
  timeBudgetMs?: number;
}

export interface GenerateGalleryProgress {
  /** Newly generated image URLs (also appended to the product). */
  urls: string[];
  /** Poses that now have a render (including ones from earlier calls). */
  done: TryOnPose[];
  /** Poses still missing. */
  remaining: TryOnPose[];
  /** Set when a pose failed — message is admin-presentable. */
  error?: string;
  provider?: string;
}

/** Dedupe + cap an image list, keeping new URLs first. */
function mergeImages(current: string[], additions: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of [...additions, ...current]) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= MAX_PRODUCT_IMAGES) break;
  }
  return out;
}

/** Persist gallery images + the marketing blob without touching db_status. */
async function persistGallery(
  slug: string,
  images: string[],
  marketing: MarketingData,
): Promise<void> {
  if (isSupabaseBackend()) {
    const supabase = await supabaseServer();
    const { error } = await supabase
      .from("products")
      .update({ images, marketing, updated_at: new Date().toISOString() })
      .eq("slug", slug);
    if (error) throw new Error(error.message);
    return;
  }
  const db = await import("@/lib/demo/db");
  await db.upsertProduct({
    slug,
    images,
    marketing: marketing as unknown as Record<string, unknown>,
  } as Partial<DbProduct> & { slug: string });
}

/** The admin's original saree photo: explicit pick, else the first non-AI image. */
function garmentFromRow(row: DbProduct, explicit?: string): string | undefined {
  if (explicit) return explicit;
  return row.images?.find((url) => !url.includes("-catalogue"));
}

/**
 * Generate the missing catalogue poses for a product, within the time budget.
 * Throws only when NO pose could be generated and nothing landed before.
 */
export async function generateProductTryOnGallery({
  slug,
  name,
  garmentUrl,
  timeBudgetMs = DEFAULT_BUDGET_MS,
}: GenerateGalleryInput): Promise<GenerateGalleryProgress> {
  const row = await pipelineProduct(slug);
  if (!row) throw new Error("Product not found — save it first");
  const marketing = parseMarketing(row.marketing);

  const landed: TryOnRender[] = [...(marketing.tryOn?.renders ?? [])];
  const landedKinds = new Set(landed.map((r) => r.kind));
  let remaining = ALL_POSES.filter((pose) => !landedKinds.has(pose));

  const garment = garmentFromRow(row, garmentUrl);
  if (!garment) throw new Error("Upload a saree photo first");

  const models = await baseModels();
  // Keep the same model across poses (one consistent photoshoot, like a real
  // catalogue); fall back to a random pick for fresh products.
  const model =
    (marketing.tryOn?.modelId ? models.find((m) => m.id === marketing.tryOn?.modelId) : undefined) ??
    pickRandomBaseModel(models);
  if (!model) throw new Error("No saree models available — add one in Admin → Saree Models");

  const secrets = await loadPipelineSecrets();
  const urls: string[] = [];
  const startedAt = Date.now();
  let provider: string | undefined;
  let error: string | undefined;

  for (const pose of remaining) {
    if (urls.length > 0 && Date.now() - startedAt > timeBudgetMs) break;
    try {
      const result = await runTryOn({
        modelUrl: model.imageUrl,
        garmentUrl: garment,
        productName: name ?? row.name,
        pose,
        secrets: { tryOnSpace: secrets.tryOnSpace, hfToken: secrets.hfToken },
        allowMock: false,
      });
      provider = result.provider;
      const ext = result.contentType.includes("png")
        ? "png"
        : result.contentType.includes("webp")
          ? "webp"
          : "jpg";
      const stored = await uploadPipelineAsset(
        "model-renders",
        `${slug}-${pose}-catalogue.${ext}`,
        result.bytes,
        result.contentType,
      );
      landed.push({
        kind: pose,
        imageUrl: stored.url,
        storagePath: stored.storagePath,
        modelId: model.id,
        provider: result.provider,
      });
      urls.push(stored.url);

      // Persist IMMEDIATELY so partial progress survives timeouts/retries.
      const nextMarketing: MarketingData = {
        ...marketing,
        tryOn: {
          ...(marketing.tryOn ?? {}),
          imageUrl: landed[0]?.imageUrl,
          modelId: model.id,
          provider: result.provider,
          renders: [...landed],
        },
      };
      await persistGallery(slug, mergeImages(row.images ?? [], urls), nextMarketing);
    } catch (err) {
      error = err instanceof Error ? err.message : "Could not generate model photo";
      break;
    }
  }

  const doneKinds = new Set(landed.map((r) => r.kind));
  const done = ALL_POSES.filter((p) => doneKinds.has(p));
  remaining = ALL_POSES.filter((p) => !doneKinds.has(p));

  if (urls.length === 0 && !error && remaining.length > 0) {
    error = "Ran out of time before the first photo finished — press retry";
  }

  return { urls, done, remaining, error, provider };
}
