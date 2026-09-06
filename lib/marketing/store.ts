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
import { pexels } from "@/lib/photos";
import type { DbProduct } from "@/lib/demo/db";

/**
 * Built-in fallback avatar so the try-on stage works before the admin uploads
 * curated base models (upload 2–3 of your own in Admin → Marketing Studio to
 * replace it — those are distributed across products deterministically).
 */
const DEFAULT_BASE_MODEL: BaseModel = {
  id: "default-model",
  name: "Default model",
  imageUrl: pexels(7486657),
};

/** db_status values that mark a product as part of the pipeline (Supabase). */
const PIPELINE_DB_STATUS = new Set([
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
        marketing: JSON.stringify(marketing),
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
          name: f.name.replace(/\.[a-z]+$/i, "").replace(/[-_]+/g, " "),
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
          name: f.replace(/^bm-/, "").replace(/\.[a-z]+$/i, "").replace(/[-_]+/g, " "),
          imageUrl: `/api/media/${f}`,
        }));
    } catch {
      models = [];
    }
  }
  return models.length > 0 ? models : [DEFAULT_BASE_MODEL];
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
  const name =
    file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9._-]/gi, "-")
      .slice(0, 40) || "model";
  const { uploadPipelineAsset } = await import("@/lib/marketing/storage");
  const { url } = await uploadPipelineAsset(
    "base-models",
    `bm-${name}.${ext === "jpeg" ? "jpg" : ext}`,
    buf,
    file.type || "image/jpeg",
  );
  return { id: `bm-${name}`, name, imageUrl: url };
}
