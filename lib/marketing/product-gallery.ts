import "server-only";
import { baseModels, pipelineProduct } from "@/lib/marketing/store";
import { loadPipelineSecrets } from "@/lib/marketing/secrets";
import { pickRandomBaseModel, runTryOn, type TryOnPose } from "@/lib/marketing/tryon";
import { runQwenImageEdit } from "@/lib/marketing/qwen";
import {
  submitKaggleTryOn,
  kaggleRunStatus,
  fetchKaggleOutputs,
  kaggleAvailable,
  type KagglePose,
} from "@/lib/marketing/kaggle";
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
const KAGGLE_TRY_ON_POSES = new Set<GalleryPose>(TRY_ON_POSES);
const KAGGLE_MAX_POSES_PER_RUN =
  Number(process.env.TRYON_KAGGLE_MAX_POSES_PER_RUN ?? 1) || 1;
const DEFAULT_BUDGET_MS = 55_000;
/** One local-GPU pose takes ~1-3 min; the route runs on the local Node server. */
const LOCAL_BUDGET_MS = 7 * 60_000;
const MAX_KAGGLE_PENDING_MS =
  Number(process.env.TRYON_KAGGLE_MAX_PENDING_MS ?? 12 * 60_000) || 12 * 60_000;
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
  /** True when a Kaggle FLUX.2 job is queued/running — keep polling. */
  pending?: boolean;
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
  return sortGalleryImages(out).slice(0, MAX_PRODUCT_IMAGES);
}

function imagePoseRank(url: string): number {
  const text = url.toLowerCase();
  if (/(^|[-_/])front[-_/.]/.test(text)) return 0;
  if (/(^|[-_/])side[-_/.]/.test(text)) return 1;
  if (/(^|[-_/])back[-_/.]/.test(text)) return 2;
  if (/(^|[-_/])full[-_]?saree[-_/.]/.test(text)) return 3;
  return 4;
}

function sortGalleryImages(images: string[]): string[] {
  return [...images].sort((a, b) => imagePoseRank(a) - imagePoseRank(b));
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
  const groups = new Map<string, ModelPoseSet>();
  for (const model of models) {
    const groupId = modelGroupId(model);
    const set = groups.get(groupId) ?? { groupId, fallback: model, byPose: {} };
    const tag = poseTag(model);
    if (tag) set.byPose[tag] = model;
    groups.set(groupId, set);
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

async function assertModelDrapeImage(input: {
  pose: GalleryPose;
  bytes: Buffer;
  contentType: string;
  provider?: string;
}): Promise<void> {
  if (input.pose === "full_saree" || !input.contentType.startsWith("image/")) return;

  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(input.bytes).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width > 0 && height > 0 && width / height > 1.35) {
      throw new Error(
        `${input.provider ?? "AI"} returned a wide/fabric image instead of a portrait model drape. Regenerate the product photos after using a clear saree source image.`,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("portrait model drape")) throw err;
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

/** Download any image URL (Supabase, /api/media, http) to a temp file. */
async function downloadImageToFile(url: string, name: string): Promise<string | undefined> {
  try {
    const { bytes } = await fetchImageBytes(url);
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const dir = path.join(os.tmpdir(), "thetanti-kaggle");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, name);
    fs.writeFileSync(file, bytes);
    return file;
  } catch {
    return undefined;
  }
}

async function renderFullSareeCatalogueImage(
  garmentUrl: string,
  _productName: string,
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const { bytes } = await fetchImageBytes(garmentUrl);
  const width = 768;
  const height = 1024;
  const path = await import("node:path");
  const logoPath = path.resolve(process.cwd(), "public", "logo", "logo.png");
  const brandBadge = Buffer.from(`
    <svg width="188" height="58" viewBox="0 0 188 58" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="188" height="58" rx="0" fill="#f6ebe1" opacity="0.92"/>
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
          .resize(width - 88, height - 88, {
            fit: "contain",
            background: { r: 246, g: 235, b: 225, alpha: 0 },
          })
          .png()
          .toBuffer(),
        left: 44,
        top: 44,
      },
      { input: brandBadge, left: width - 220, top: height - 96 },
      {
        input: await sharp(logoPath).resize(148, 46, { fit: "contain" }).png().toBuffer(),
        left: width - 200,
        top: height - 90,
      },
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
  if (force) {
    await persistGallery(slug, baseImages, marketing);
  }

  const secrets = await loadPipelineSecrets();
  const tryOnProvider = (process.env.TRYON_PROVIDER ?? "kaggle").trim().toLowerCase();
  const useQwenProvider = ["qwen", "dashscope", "local-first", "local-first-qwen"].includes(
    tryOnProvider,
  );
  const configuredTryOnUrl = secrets.localTryOnUrl?.trim();
  const useLegacyVtonFallback = process.env.TRYON_ENABLE_LEGACY_VTON?.trim().toLowerCase() === "true";
  const useLocalEngineFallback = process.env.TRYON_ENABLE_LOCAL_ENGINE?.trim().toLowerCase() === "true";
  const useExternalTryOn = Boolean(
    useLegacyVtonFallback &&
      configuredTryOnUrl &&
      !isTheTantiLocalEngine(configuredTryOnUrl),
  );
  const useLocalEngine =
    useLocalEngineFallback && !useExternalTryOn && (await engineHealthy());
  let error: string | undefined;

  // ---- Kaggle FLUX.2 path (free cloud GPU, async job) ----
  // Priority: collect a finished run → report a running one → submit a new one.
  // Falls back to the local engine below on any Kaggle failure. Legacy HF/VTON
  // providers are opt-in only; they do not understand sarees well enough for
  // the product gallery and can hide the real FLUX retry path behind quota
  // errors.
  const kaggleState = marketing.tryOn?.kaggle;
  if (!useQwenProvider && kaggleState && !kaggleState.error) {
    const { state } = await kaggleRunStatus();
    const submittedAtMs = Date.parse(kaggleState.submittedAt);
    const isStale =
      Number.isFinite(submittedAtMs) && Date.now() - submittedAtMs > MAX_KAGGLE_PENDING_MS;
    if (state === "COMPLETE") {
      const wanted = remaining.filter((p): p is KagglePose => KAGGLE_TRY_ON_POSES.has(p));
      const kaggleUrls: string[] = [];
      const outputs: Partial<Record<KagglePose, string>> =
        wanted.length > 0 ? await fetchKaggleOutputs(slug, wanted) : {};
      const fs = await import("node:fs");
      const selectedModelId = marketing.tryOn?.modelId ?? "kaggle-flux2";
      for (const pose of wanted) {
        const file = outputs[pose];
        if (!file) continue;
        try {
          const bytes = fs.readFileSync(file);
          const stored = await uploadPipelineAsset(
            "model-renders",
            `${slug}-${pose}-catalogue.png`,
            bytes,
            "image/png",
          );
          landed.push({
            kind: pose,
            imageUrl: stored.url,
            storagePath: stored.storagePath,
            localFile: file,
            modelId: selectedModelId,
            provider: "kaggle-flux2",
          });
          kaggleUrls.push(stored.url);
        } catch {
          /* skip this pose; local fallback can cover it later */
        }
      }
      if (kaggleUrls.length > 0) {
        const nextMarketing: MarketingData = {
          ...marketing,
          tryOn: {
            ...(marketing.tryOn ?? {}),
            imageUrl: landed[0]?.imageUrl,
            garmentUrl: garment,
            modelId: selectedModelId,
            provider: "kaggle-flux2",
            kaggle: undefined,
            renders: [...landed],
          },
        };
        await persistGallery(slug, mergeImages(baseImages, kaggleUrls), nextMarketing);
        const doneKinds = new Set(landed.map((r) => r.kind));
        return {
          urls: kaggleUrls,
          done: ALL_POSES.filter((p) => doneKinds.has(p)),
          remaining: ALL_POSES.filter((p) => !doneKinds.has(p)),
          provider: "kaggle-flux2",
        };
      }
      // Outputs missing usually means Kaggle ran against a stale input dataset.
      // Do not silently fall back to another model; that makes the admin think
      // the result came from FLUX when it did not.
      storedMarketing.tryOn = { ...storedMarketing.tryOn, kaggle: { submittedAt: kaggleState.submittedAt, error: "run completed but no outputs downloaded" } };
      return {
        urls: [],
        done: ALL_POSES.filter((p) => landedKinds.has(p)),
        remaining,
        error: "Kaggle FLUX completed but did not return matching product outputs. Click Generate again to submit a fresh FLUX job.",
        provider: "kaggle-flux2",
      };
    } else if (state === "ERROR" || state === "CANCEL_ACKNOWLEDGED") {
      storedMarketing.tryOn = { ...storedMarketing.tryOn, kaggle: { submittedAt: kaggleState.submittedAt, error: `kaggle run ${state}` } };
      return {
        urls: [],
        done: ALL_POSES.filter((p) => landedKinds.has(p)),
        remaining,
        error: `Kaggle FLUX run failed with state ${state}. Click Generate again to submit a fresh FLUX job.`,
        provider: "kaggle-flux2",
      };
    } else if (isStale && (state === "QUEUED" || state === "RUNNING" || state === "NO_SESSION")) {
      const message =
        "Kaggle FLUX job is taking too long and produced no outputs. The Kaggle runner is likely stuck before image generation; click Generate again to submit a fresh job.";
      const nextMarketing: MarketingData = {
        ...marketing,
        tryOn: {
          ...(marketing.tryOn ?? {}),
          garmentUrl: garment,
          kaggle: { submittedAt: kaggleState.submittedAt, state, error: message },
        },
      };
      await persistGallery(slug, baseImages, nextMarketing);
      return {
        urls: [],
        done: ALL_POSES.filter((p) => landedKinds.has(p)),
        remaining,
        error: message,
        provider: "kaggle-flux2",
      };
    } else if (state === "QUEUED" || state === "RUNNING" || state === "NO_SESSION") {
      return {
        urls: [],
        done: ALL_POSES.filter((p) => landedKinds.has(p)),
        remaining,
        provider: "kaggle-flux2",
        pending: true,
      };
    }
  }

  // Try submitting a fresh Kaggle job when the CLI is available and there is
  // no previous attempt for this product (retries = press Generate again).
  const canSubmitFreshKaggle = !kaggleState || Boolean(kaggleState.error);
  if (!useQwenProvider && canSubmitFreshKaggle && !process.env.TRYON_MOCK && (await kaggleAvailable())) {
    const person = await (async () => {
      const models = await baseModels();
      if (models.length === 0) return undefined;
      const modelSet = selectModelSet(models, slug, marketing.tryOn?.modelId);
      const pick = modelSet ? modelForPose(modelSet, "front") : undefined;
      if (!pick) return undefined;
      const file = await downloadImageToFile(pick.imageUrl, "person.png");
      return file ? { id: pick.id, file } : undefined;
    })();
    if (person) {
      const garmentFile = await downloadImageToFile(garment, "saree.jpg");
      const kagglePoses = remaining
        .filter((p): p is KagglePose => KAGGLE_TRY_ON_POSES.has(p))
        .slice(0, KAGGLE_MAX_POSES_PER_RUN);
      if (garmentFile && kagglePoses.length > 0) {
        const submit = await submitKaggleTryOn({
          slug,
          personImagePath: person.file,
          sareeImagePath: garmentFile,
          poses: kagglePoses,
          colorHint: row.colorway,
          fabric: row.fabric,
          productName: name ?? row.name,
        });
        if (submit.ok) {
          const nextMarketing: MarketingData = {
            ...marketing,
            tryOn: {
              ...(marketing.tryOn ?? {}),
              garmentUrl: garment,
              modelId: person.id,
              kaggle: { submittedAt: new Date().toISOString(), state: "QUEUED" },
            },
          };
          await persistGallery(slug, mergeImages(baseImages, []), nextMarketing);
          return {
            urls: [],
            done: ALL_POSES.filter((p) => landedKinds.has(p)),
            remaining,
            provider: "kaggle-flux2",
            pending: true,
          };
        }
        error = submit.error ?? "Kaggle FLUX job could not be submitted";
      }
    }
  }
  let models: Awaited<ReturnType<typeof baseModels>> = [];
  let modelSet: ModelPoseSet | undefined;
  if (!useLocalEngine && (useLegacyVtonFallback || useQwenProvider)) {
    // Remote try-on/image-edit paths need a base model + garment reference;
    // the local engine creates its own model and does not.
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

  for (const pose of remaining) {
    if (urls.length > 0 && Date.now() - startedAt > budget) break;
    try {
      const result = pose === "full_saree"
        ? {
            bytes: await renderFullSareeCatalogueImage(garment, name ?? row.name),
            contentType: "image/jpeg",
            provider: "local-fabric",
          }
        : useLocalEngine
        ? await generateLocalEnginePose({
            slug,
            pose,
            name: name ?? row.name,
            colorway: row.colorway,
            fabric: row.fabric,
            garmentUrl: garment,
          })
        : useQwenProvider
        ? await runQwenImageEdit({
            apiKey: secrets.qwenKey,
            modelUrl: modelForPose(modelSet!, pose).imageUrl,
            garmentUrl: garment,
            productName: name ?? row.name,
            pose,
          })
        : useLegacyVtonFallback
        ? await runTryOn({
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
            })
        : (() => {
            throw new Error(
              error ??
                "Kaggle FLUX is not running yet. Check Kaggle credentials/GPU, then click Generate model photos again.",
            );
          })();
      provider = result.provider;
      await assertModelDrapeImage({
        pose,
        bytes: result.bytes,
        contentType: result.contentType,
        provider: result.provider,
      });
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
          : modelSet?.groupId ?? result.provider,
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
            : modelSet?.groupId ?? result.provider,
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

  const kaggleErr = storedMarketing.tryOn?.kaggle?.error;
  return { urls, done, remaining, error: error ?? (kaggleErr ? `Kaggle fallback: ${kaggleErr}` : undefined), provider };
}
