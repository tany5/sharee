import "server-only";
import { baseModels, pipelineProduct } from "@/lib/marketing/store";
import { loadPipelineSecrets } from "@/lib/marketing/secrets";
import { pickRandomBaseModel, runTryOn, type TryOnPose } from "@/lib/marketing/tryon";
import { fetchImageBytes, uploadPipelineAsset } from "@/lib/marketing/storage";
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
type GalleryPose = TryOnRender["kind"];
type GalleryBaseModel = { id: string; imageUrl: string; name?: string };
type ModelPoseSet = {
  groupId: string;
  fallback: GalleryBaseModel;
  byPose: Partial<Record<GalleryPose, GalleryBaseModel>>;
};

const TRY_ON_POSES: TryOnPose[] = ["front", "side", "back"];
const ALL_POSES: GalleryPose[] = [...TRY_ON_POSES, "full_saree"];
const DEFAULT_BUDGET_MS = 55_000;
/** One local-GPU pose takes ~1-3 min; the route runs on the local Node server. */
const LOCAL_BUDGET_MS = 7 * 60_000;
const MAX_PRODUCT_IMAGES = 8;
const LOCAL_DOWNLOAD_DIR =
  process.env.TRYON_DOWNLOAD_DIR ?? "D:/TheTanti-AI/generated/tryon-downloads";

/** Workflow B engine (TheTanti-AI) on loopback — ComfyUI RealisticVision. */
const ENGINE_URL = "http://127.0.0.1:8787";

async function engineHealthy(): Promise<boolean> {
  try {
    const r = await fetch(`${ENGINE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * One pose via the local engine. Deterministic seed from the slug keeps the
 * SAME model across all four poses and across regenerations; different
 * products derive different seeds, so they get different models.
 */
async function generateLocalEnginePose(input: {
  slug: string;
  pose: GalleryPose;
  name?: string;
  colorway?: string;
  fabric?: string;
  garmentUrl?: string;
}): Promise<{ bytes: Buffer; contentType: string; provider: string; seed: number }> {
  // Give the engine the REAL saree photo so it extracts the actual fabric
  // colors for the prompt (fixes drape color/fabric mismatch).
  let imagePath: string | undefined;
  if (input.garmentUrl) {
    try {
      const { bytes } = await fetchImageBytes(input.garmentUrl);
      const fs = await import("node:fs");
      const os = await import("node:os");
      const path = await import("node:path");
      const dir = path.join(os.tmpdir(), "thetanti-engine");
      fs.mkdirSync(dir, { recursive: true });
      imagePath = path.join(dir, `${input.slug}-garment.jpg`);
      fs.writeFileSync(imagePath, bytes);
    } catch {
      // Color extraction is an enhancement — proceed without it.
    }
  }
  const res = await fetch(`${ENGINE_URL}/model-images`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: input.slug,
      pose: input.pose,
      name: input.name,
      color: input.colorway,
      fabric: input.fabric,
      image_path: imagePath,
    }),
    signal: AbortSignal.timeout(8 * 60_000),
  });
  const data = (await res.json()) as {
    ok: boolean;
    result?: { ok?: boolean; file?: string; seed?: number; error?: string };
    error?: string;
  };
  const file = data.result?.file;
  if (!res.ok || !data.ok || !data.result?.ok || !file) {
    throw new Error(data.result?.error || data.error || "Local engine pose failed");
  }
  const fs = await import("node:fs");
  const bytes = fs.readFileSync(file);
  return { bytes, contentType: "image/png", provider: "comfyui-sd15-rv", seed: data.result.seed ?? 0 };
}

export interface GenerateGalleryInput {
  slug: string;
  name?: string;
  /** The admin-uploaded saree photo (the garment source). */
  garmentUrl?: string;
  /** Clear previous generated catalogue renders and start again. */
  force?: boolean;
  timeBudgetMs?: number;
}

export interface GenerateGalleryProgress {
  /** Newly generated image URLs (also appended to the product). */
  urls: string[];
  /** Poses that now have a render (including ones from earlier calls). */
  done: GalleryPose[];
  /** Poses still missing. */
  remaining: GalleryPose[];
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

/** The admin's original saree photo: explicit pick, stored source, else first non-AI image. */
function garmentFromRow(
  row: DbProduct,
  marketing: MarketingData,
  explicit?: string,
): string | undefined {
  if (explicit) return explicit;
  if (marketing.tryOn?.garmentUrl) return marketing.tryOn.garmentUrl;
  const generated = new Set(marketing.tryOn?.renders?.map((render) => render.imageUrl) ?? []);
  if (marketing.tryOn?.imageUrl) generated.add(marketing.tryOn.imageUrl);
  return row.images?.find((url) => !generated.has(url));
}

function poseTag(model: GalleryBaseModel): GalleryPose | undefined {
  const text = `${model.id} ${model.name ?? ""}`.toLowerCase();
  if (/(^|[-_\s])full[-_\s]?saree($|[-_\s.])/.test(text)) return "full_saree";
  if (/(^|[-_\s])front($|[-_\s.])/.test(text)) return "front";
  if (/(^|[-_\s])side($|[-_\s.])/.test(text)) return "side";
  if (/(^|[-_\s])back($|[-_\s.])/.test(text)) return "back";
  return undefined;
}

function modelGroupId(model: GalleryBaseModel): string {
  return `${model.id} ${model.name ?? ""}`
    .toLowerCase()
    .replace(/\.(jpe?g|png|webp)$/g, "")
    .replace(/(^|[-_\s])(front|side|back|full[-_\s]?saree)($|[-_\s.])/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || model.id;
}

function modelSetScore(set: ModelPoseSet): number {
  return (["front", "side", "back", "full_saree"] as GalleryPose[]).filter((pose) => set.byPose[pose]).length;
}

function selectModelSet(
  models: GalleryBaseModel[],
  slug: string,
  existingModelId?: string,
): ModelPoseSet | undefined {
  if (models.length === 0) return undefined;
  const preferredModelId = process.env.TRYON_BASE_MODEL_ID?.trim();
  const groups = new Map<string, ModelPoseSet>();
  for (const model of models) {
    const groupId = modelGroupId(model);
    const set = groups.get(groupId) ?? { groupId, fallback: model, byPose: {} };
    const tag = poseTag(model);
    if (tag) set.byPose[tag] = model;
    groups.set(groupId, set);
  }

  if (preferredModelId) {
    const preferred = models.find((model) => model.id === preferredModelId);
    const preferredSet = preferred ? groups.get(modelGroupId(preferred)) : groups.get(preferredModelId);
    if (preferredSet) return preferredSet;
  }

  if (existingModelId) {
    const rememberedSet = groups.get(existingModelId);
    if (rememberedSet) return rememberedSet;
    const existing = models.find((model) => model.id === existingModelId);
    const existingSet = existing ? groups.get(modelGroupId(existing)) : undefined;
    if (existingSet) return existingSet;
  }

  const completeSets = [...groups.values()]
    .filter((set) => modelSetScore(set) >= 3)
    .sort((a, b) => a.groupId.localeCompare(b.groupId));
  if (completeSets.length > 0) {
    let hash = 0;
    for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return completeSets[hash % completeSets.length];
  }

  const fallback = pickRandomBaseModel(models);
  return fallback ? { groupId: fallback.id, fallback, byPose: {} } : undefined;
}

function modelForPose(set: ModelPoseSet, pose: GalleryPose): GalleryBaseModel {
  return set.byPose[pose] ?? set.byPose.front ?? set.fallback;
}

async function saveGeneratedLocalCopy(input: {
  slug: string;
  pose: GalleryPose;
  provider?: string;
  ext: string;
  bytes: Buffer;
}): Promise<string | undefined> {
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    fs.mkdirSync(LOCAL_DOWNLOAD_DIR, { recursive: true });
    const provider = (input.provider ?? "tryon").replace(/[^a-z0-9._-]+/gi, "-");
    const safeSlug = input.slug.replace(/[^a-z0-9._-]+/gi, "-");
    const file = path.join(
      LOCAL_DOWNLOAD_DIR,
      `${safeSlug}-${input.pose}-${provider}-${Date.now()}.${input.ext}`,
    );
    fs.writeFileSync(file, input.bytes);
    return file;
  } catch {
    return undefined;
  }
}

function isTheTantiLocalEngine(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      ["127.0.0.1", "localhost"].includes(parsed.hostname) &&
      parsed.port === "8787" &&
      parsed.pathname.includes("model-images")
    );
  } catch {
    return false;
  }
}

function withoutPreviousRenders(row: DbProduct, marketing: MarketingData): string[] {
  const previous = new Set(marketing.tryOn?.renders?.map((render) => render.imageUrl) ?? []);
  if (marketing.tryOn?.imageUrl) previous.add(marketing.tryOn.imageUrl);
  return (row.images ?? []).filter((url) => !previous.has(url));
}

async function renderFullSareeCatalogueImage(
  garmentUrl: string,
  productName: string,
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const { bytes } = await fetchImageBytes(garmentUrl);
  const width = 768;
  const height = 1024;
  const title = productName
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .slice(0, 34);
  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="${height - 118}" width="${width}" height="118" fill="#1c0d05" opacity="0.72"/>
      <text x="${width / 2}" y="${height - 68}" text-anchor="middle" font-family="Georgia, serif" font-size="33" font-weight="700" fill="#ffffff">${title}</text>
      <text x="${width / 2}" y="${height - 30}" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#f6ebe1">Full saree view</text>
    </svg>
  `);

  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 246, g: 235, b: 225 },
    },
  })
    .composite([
      {
        input: await sharp(bytes)
          .rotate()
          .resize(width - 88, height - 166, {
            fit: "contain",
            background: { r: 246, g: 235, b: 225, alpha: 0 },
          })
          .png()
          .toBuffer(),
        left: 44,
        top: 28,
      },
      { input: overlay, left: 0, top: 0 },
    ])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

/**
 * Generate the missing catalogue poses for a product, within the time budget.
 * Throws only when NO pose could be generated and nothing landed before.
 */
export async function generateProductTryOnGallery({
  slug,
  name,
  garmentUrl,
  force = false,
  timeBudgetMs = DEFAULT_BUDGET_MS,
}: GenerateGalleryInput): Promise<GenerateGalleryProgress> {
  const row = await pipelineProduct(slug);
  if (!row) throw new Error("Product not found — save it first");
  const storedMarketing = parseMarketing(row.marketing);
  const marketing: MarketingData = force
    ? {
        ...storedMarketing,
        tryOn: undefined,
      }
    : storedMarketing;
  const baseImages = force ? withoutPreviousRenders(row, storedMarketing) : row.images ?? [];

  const landed: TryOnRender[] = [...(marketing.tryOn?.renders ?? [])];
  const landedKinds = new Set(landed.map((r) => r.kind));
  let remaining = ALL_POSES.filter((pose) => !landedKinds.has(pose));

  const garment = garmentFromRow(row, storedMarketing, garmentUrl);
  if (!garment) throw new Error("Upload a saree photo first");

  const secrets = await loadPipelineSecrets();
  const configuredTryOnUrl = secrets.localTryOnUrl?.trim();
  const useExternalTryOn = Boolean(configuredTryOnUrl && !isTheTantiLocalEngine(configuredTryOnUrl));
  const useLocalEngine = !useExternalTryOn && (await engineHealthy());
  let models: Awaited<ReturnType<typeof baseModels>> = [];
  let modelSet: ModelPoseSet | undefined;
  if (!useLocalEngine) {
    // HF try-on path needs a base model + secrets; the local engine does not.
    models = await baseModels();
    // Keep the same model across poses (one consistent photoshoot, like a real
    // catalogue); fall back to a random pick for fresh products.
    modelSet = selectModelSet(models, slug, marketing.tryOn?.modelId);
    if (!modelSet) throw new Error("No saree models available — add one in Admin → Saree Models");
  }
  const urls: string[] = [];
  const startedAt = Date.now();
  const budget = useLocalEngine ? Math.max(timeBudgetMs, LOCAL_BUDGET_MS) : timeBudgetMs;
  let provider: string | undefined;
  let error: string | undefined;

  for (const pose of remaining) {
    if (urls.length > 0 && Date.now() - startedAt > budget) break;
    try {
      const result = useLocalEngine
        ? await generateLocalEnginePose({
            slug,
            pose,
            name: name ?? row.name,
            colorway: row.colorway,
            fabric: row.fabric,
            garmentUrl: garment,
          })
        : pose === "full_saree" && !useExternalTryOn
          ? {
              bytes: await renderFullSareeCatalogueImage(garment, name ?? row.name),
              contentType: "image/jpeg",
              provider: "local-fabric",
            }
          : await runTryOn({
              modelUrl: modelForPose(modelSet!, pose).imageUrl,
              garmentUrl: garment,
              productName: name ?? row.name,
              pose,
              secrets: {
                tryOnSpace: secrets.tryOnSpace,
                localTryOnUrl: useExternalTryOn ? configuredTryOnUrl : undefined,
                hfToken: secrets.hfToken,
              },
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
      const localFile = await saveGeneratedLocalCopy({
        slug,
        pose,
        provider: result.provider,
        ext,
        bytes: result.bytes,
      });
      landed.push({
        kind: pose,
        imageUrl: stored.url,
        storagePath: stored.storagePath,
        localFile,
        modelId: useLocalEngine
          ? `engine-seed-${(result as { seed?: number }).seed ?? 0}`
          : modelSet!.groupId,
        provider: result.provider,
      });
      urls.push(stored.url);

      // Persist IMMEDIATELY so partial progress survives timeouts/retries.
      const nextMarketing: MarketingData = {
        ...marketing,
        tryOn: {
          ...(marketing.tryOn ?? {}),
          imageUrl: landed[0]?.imageUrl,
          garmentUrl: garment,
          modelId: useLocalEngine
            ? `engine-seed-${(result as { seed?: number }).seed ?? 0}`
            : modelSet!.groupId,
          provider: result.provider,
          renders: [...landed],
        },
      };
      await persistGallery(slug, mergeImages(baseImages, urls), nextMarketing);
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
