/**
 * Pipeline data access — the single interface the API routes use.
 *
 * Works over both backends. Supabase stores everything in `products.marketing`
 * (jsonb) with db_status mirroring the pipeline status; demo mode keeps the
 * same shape on the DbProduct rows in .demo-data/db.json (products stay
 * `active` so the storefront keeps working while the pipeline runs).
 */
import "server-only";
import { isSupabaseBackend } from "@/lib/backend/env";
import { supabaseServer } from "@/lib/supabase/server";
import {
  emptyPipeline,
  parseMarketing,
  type BaseModel,
  type MarketingData,
} from "@/lib/marketing/types";
import { dbStatusFor } from "@/lib/marketing/status";
import type { DbProduct } from "@/lib/demo/db";

const DEFAULT_BASE_MODELS: BaseModel[] = [
  {
    id: "bengali-model-1",
    name: "Bengali model 1",
    imageUrl: "/marketing/models/bengali-model-01.png",
  },
  {
    id: "bengali-model-2",
    name: "Bengali model 2",
    imageUrl: "/marketing/models/bengali-model-02.png",
  },
  {
    id: "bengali-model-3",
    name: "Bengali model 3",
    imageUrl: "/marketing/models/bengali-model-03.png",
  },
  {
    id: "bengali-model-4",
    name: "Bengali model 4",
    imageUrl: "/marketing/models/bengali-model-04.png",
  },
];

const SYNTHETIC_MODEL_SEEDS = [
  "/marketing/model-seeds/ai-seed-01.png",
  "/marketing/model-seeds/ai-seed-02.png",
  "/marketing/model-seeds/ai-seed-03.png",
];

function safeModelName(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9._-]/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "ai-model"
  );
}

function displayBaseModelName(filename: string): string {
  return filename
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/^\d+-[a-f0-9]{8}-/i, "")
    .replace(/^bm-/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

function assertManagedBaseModel(id: string): void {
  if (DEFAULT_BASE_MODELS.some((m) => m.id === id)) {
    throw new Error("Built-in AI models are protected. Generate or upload a managed copy first.");
  }
}

/** db_status values that mark a product as part of the pipeline (Supabase). */
const PIPELINE_DB_STATUS = new Set([
  "pending",
  "tryon_processing",
  "tryon_completed",
  "rendering_video",
  "publishing",
  "published",
  "failed",
]);

export class PipelineMigrationError extends Error {
  constructor() {
    super(
      "Marketing pipeline schema is missing — run supabase/migrations/0004_marketing_pipeline.sql (and 0005_pipeline_secrets.sql) in the Supabase SQL editor",
    );
    this.name = "PipelineMigrationError";
  }
}

function rowToProduct(r: Record<string, unknown>): DbProduct & { marketing: MarketingData } {
  const p = r as unknown as Omit<DbProduct, "marketing">;
  return { ...p, marketing: parseMarketing(r.marketing) };
}

/** Products currently in or finished by the pipeline (admin view). */
export async function pipelineProducts(): Promise<
  (DbProduct & { marketing: MarketingData })[]
> {
  if (isSupabaseBackend()) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .or(
        "db_status.in.(pending,tryon_processing,tryon_completed,rendering_video,publishing,published,failed)",
      )
      .order("marketing_updated_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) {
      // Migration 0004 not applied yet (missing marketing columns).
      if (/marketing|column|relation/i.test(error.message)) {
        throw new PipelineMigrationError();
      }
      throw new Error(error.message);
    }
    return (data ?? []).map((r) => rowToProduct(r as Record<string, unknown>));
  }
  const db = await import("@/lib/demo/db");
  return db
    .adminProducts()
    .filter(
      (p) =>
        PIPELINE_DB_STATUS.has(p.dbStatus) ||
        // Demo mode keeps rows 'active' — presence of a marketing blob marks
        // the product as part of the pipeline.
        p.marketing != null && typeof p.marketing === "object",
    )
    .map(
      (p) =>
        ({ ...p, marketing: parseMarketing(p.marketing) }) as DbProduct & {
          marketing: MarketingData;
        },
    );
}

/** Load one product + its marketing blob (or null). */
export async function pipelineProduct(
  slug: string,
): Promise<(DbProduct & { marketing: MarketingData }) | null> {
  if (isSupabaseBackend()) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data) return null;
    return rowToProduct(data as Record<string, unknown>);
  }
  const db = await import("@/lib/demo/db");
  const p = db.adminProducts().find((row) => row.slug === slug);
  return p
    ? ({ ...p, marketing: parseMarketing(p.marketing) } as DbProduct & { marketing: MarketingData })
    : null;
}

async function writeProductRow(
  slug: string,
  marketing: MarketingData,
  dbStatus: string,
): Promise<void> {
  if (isSupabaseBackend()) {
    const supabase = await supabaseServer();
    const { error } = await supabase
      .from("products")
      .update({
        marketing,
        marketing_updated_at: new Date().toISOString(),
        db_status: dbStatus,
      })
      .eq("slug", slug);
    if (error) throw new Error(error.message);
    return;
  }
  const db = await import("@/lib/demo/db");
  await db.upsertProduct({
    slug,
    marketing: marketing as unknown as Record<string, unknown>,
    dbStatus: "active",
    updatedAt: new Date().toISOString(),
  } as Partial<DbProduct> & { slug: string });
}

/** Persist a new marketing blob (demo keeps products active). */
export async function setMarketing(
  slug: string,
  marketing: MarketingData,
  opts?: { dbStatus?: string },
): Promise<void> {
  await writeProductRow(
    slug,
    marketing,
    opts?.dbStatus ?? dbStatusFor(marketing.pipeline.status),
  );
}

/** Enqueue: flip a product into 'pending' with a fresh pipeline blob. */
export async function enqueueProduct(slug: string): Promise<MarketingData> {
  const marketing: MarketingData = { pipeline: emptyPipeline() };
  await writeProductRow(
    slug,
    marketing,
    isSupabaseBackend() ? "pending" : "active",
  );
  return marketing;
}

/** Append generated marketing images to the product gallery without duplicates. */
export async function appendProductImages(
  slug: string,
  urls: string[],
  maxImages = 6,
): Promise<string[]> {
  const clean = urls.map((u) => u.trim()).filter(Boolean);
  if (clean.length === 0) return [];

  const current = await pipelineProduct(slug);
  if (!current) throw new Error("Product not found");
  const nextImages = [...current.images];
  for (const url of clean) {
    if (!nextImages.includes(url)) nextImages.push(url);
  }
  const capped = nextImages.slice(0, maxImages);

  if (isSupabaseBackend()) {
    const supabase = await supabaseServer();
    const { error } = await supabase
      .from("products")
      .update({ images: capped, updated_at: new Date().toISOString() })
      .eq("slug", slug);
    if (error) throw new Error(error.message);
  } else {
    const db = await import("@/lib/demo/db");
    await db.upsertProduct({ slug, images: capped } as Partial<DbProduct> & {
      slug: string;
    });
  }
  return capped;
}

/** Cancel: mark failed-by-admin; product returns to a normal draft/active. */
export async function cancelPipeline(slug: string): Promise<MarketingData> {
  const current = await pipelineProduct(slug);
  const marketing: MarketingData = {
    ...(current?.marketing ?? { pipeline: emptyPipeline() }),
    pipeline: {
      status: "failed",
      attempts: current?.marketing.pipeline.attempts ?? 0,
      error: "Cancelled by admin",
      failedAt: new Date().toISOString(),
    },
  };
  await writeProductRow(slug, marketing, isSupabaseBackend() ? "draft" : "active");
  return marketing;
}

/** Base model avatars: Supabase `base-models` bucket listing / demo dir. */
export async function baseModels(): Promise<BaseModel[]> {
  let models: BaseModel[] = [];
  if (isSupabaseBackend()) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.storage.from("base-models").list("", {
      limit: 50,
      sortBy: { column: "name", order: "asc" },
    });
    if (!error && data) {
      const { data: pub } = supabase.storage.from("base-models").getPublicUrl("");
      const root = pub.publicUrl.replace(/\/$/, "");
      models = data
        .filter((f) => /\.(jpe?g|png|webp)$/i.test(f.name))
        .map((f) => ({
          id: f.name,
          name: displayBaseModelName(f.name),
          imageUrl: `${root}/${encodeURIComponent(f.name)}`,
        }));
    }
  } else {
    const fsMod = await import("node:fs");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), ".demo-data", "uploads");
    try {
      models = fsMod
        .readdirSync(dir)
        .filter((f) => /^bm-.*\.(jpe?g|png|webp)$/i.test(f))
        .map((f) => ({
          id: f,
          name: displayBaseModelName(f),
          imageUrl: `/api/media/${f}`,
        }));
    } catch {
      models = [];
    }
  }
  return [...models, ...DEFAULT_BASE_MODELS];
}

/** Upload a base model avatar (prefix `bm-` so demo listing finds it). */
export async function uploadBaseModel(file: File): Promise<BaseModel> {
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() ?? "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
    throw new Error("Base model must be a JPG/PNG/WebP image");
  }
  const name = safeModelName(file.name);
  const { uploadPipelineAsset } = await import("@/lib/marketing/storage");
  const filename = `bm-${name}.${ext === "jpeg" ? "jpg" : ext}`;
  const { url, storagePath } = await uploadPipelineAsset(
    "base-models",
    filename,
    buf,
    file.type || "image/jpeg",
  );
  return { id: storagePath ?? filename, name, imageUrl: url };
}

export async function generateSyntheticBaseModel(name?: string): Promise<BaseModel> {
  const managedCount = (await baseModels()).filter((m) => !DEFAULT_BASE_MODELS.some((d) => d.id === m.id)).length;
  const source = SYNTHETIC_MODEL_SEEDS[managedCount % SYNTHETIC_MODEL_SEEDS.length];
  const { fetchImageBytes, uploadPipelineAsset } = await import("@/lib/marketing/storage");
  const { bytes, contentType } = await fetchImageBytes(source);
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const label = safeModelName(name?.trim() || "ai-saree-model");
  const filename = `bm-${label}.${ext}`;
  const { url, storagePath } = await uploadPipelineAsset("base-models", filename, bytes, contentType);
  return { id: storagePath ?? filename, name: label.replace(/[-_]+/g, " "), imageUrl: url };
}

export async function deleteBaseModel(id: string): Promise<void> {
  assertManagedBaseModel(id);
  const safeId = id.split(/[\\/]/).pop();
  if (!safeId) throw new Error("Choose a valid model");
  if (isSupabaseBackend()) {
    const supabase = await supabaseServer();
    const { error } = await supabase.storage.from("base-models").remove([safeId]);
    if (error) throw new Error(error.message);
    return;
  }
  const fs = await import("node:fs");
  const path = await import("node:path");
  const abs = path.join(process.cwd(), ".demo-data", "uploads", safeId);
  if (!fs.existsSync(abs)) throw new Error("Model not found");
  fs.unlinkSync(abs);
}

export async function renameBaseModel(id: string, name: string): Promise<BaseModel> {
  assertManagedBaseModel(id);
  const current = (await baseModels()).find((m) => m.id === id);
  if (!current) throw new Error("Model not found");
  const { fetchImageBytes, uploadPipelineAsset } = await import("@/lib/marketing/storage");
  const { bytes, contentType } = await fetchImageBytes(current.imageUrl);
  const ext = current.id.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const safeName = safeModelName(name);
  const filename = `bm-${safeName}.${["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg"}`;
  const { url, storagePath } = await uploadPipelineAsset("base-models", filename, bytes, contentType);
  await deleteBaseModel(id);
  return { id: storagePath ?? filename, name: safeName.replace(/[-_]+/g, " "), imageUrl: url };
}
