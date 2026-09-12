/**
 * Marketing AI store — persistence for the social/ads layer ONLY.
 *
 * The existing product pipeline keeps lib/marketing/store.ts (products.*
 * marketing blob). This module owns two dedicated tables:
 *
 *   social_posts — organic Facebook/Instagram posts awaiting approval
 *   ads          — Meta ad records with the two-approval state machine
 *   state        — tiny key/value blob (Telegram getUpdates offset etc.)
 *
 * Supabase mode: rows in public.social_posts / public.ads / public.state
 * (migration 0006, admin-only RLS). Demo mode: .demo-data/marketing-ai.json
 * so everything works offline with zero external services.
 */
import "server-only";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { isSupabaseBackend } from "@/lib/backend/env";
import { supabaseServer } from "@/lib/supabase/server";
import type { SocialPostRecord } from "@/lib/marketing/social";
import type { AdRecord } from "@/lib/marketing/ads";

/* ------------------------------- id helpers ------------------------------- */

export function newSocialId(): string {
  return `sp_${randomUUID()}`;
}

export function newAdId(): string {
  return `ad_${randomUUID()}`;
}

/* ------------------------------- demo backend ------------------------------ */

interface DemoAiDb {
  socialPosts: SocialPostRecord[];
  ads: AdRecord[];
  state: Record<string, unknown>;
}

/**
 * Demo-mode data file. Override with MARKETING_AI_DEMO_PATH (used by the
 * smoke test to run against a throwaway file instead of real demo data).
 */
const DEMO_PATH = process.env.MARKETING_AI_DEMO_PATH
  ? path.resolve(process.env.MARKETING_AI_DEMO_PATH)
  : path.join(process.cwd(), ".demo-data", "marketing-ai.json");

function readDemo(): DemoAiDb {
  try {
    if (existsSync(DEMO_PATH)) {
      const raw = JSON.parse(readFileSync(DEMO_PATH, "utf8")) as Partial<DemoAiDb>;
      return {
        socialPosts: Array.isArray(raw.socialPosts) ? raw.socialPosts : [],
        ads: Array.isArray(raw.ads) ? raw.ads : [],
        state: raw.state ?? {},
      };
    }
  } catch {
    /* corrupted file — start fresh */
  }
  return { socialPosts: [], ads: [], state: {} };
}

function writeDemo(db: DemoAiDb): void {
  mkdirSync(path.dirname(DEMO_PATH), { recursive: true });
  writeFileSync(DEMO_PATH, JSON.stringify(db, null, 2));
}

/* ----------------------------- row mapping (pg) ---------------------------- */

type SocialRow = Record<string, unknown>;
type AdRow = Record<string, unknown>;

function socialToRow(r: SocialPostRecord): SocialRow {
  return {
    id: r.id,
    key: r.key,
    product_slug: r.productSlug,
    product_name: r.productName,
    product_price: r.productPrice,
    product_category: r.productCategory,
    image_url: r.imageUrl,
    post_image_url: r.postImageUrl ?? null,
    public_image_url: r.publicImageUrl ?? null,
    kind: r.kind,
    language: r.language,
    caption: r.caption,
    engine: r.engine,
    state: r.state,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    generated_at: r.generatedAt ?? null,
    approved_at: r.approvedAt ?? null,
    published_at: r.publishedAt ?? null,
    rejected_reason: r.rejectedReason ?? null,
    fb_post_id: r.fbPostId ?? null,
    ig_media_id: r.igMediaId ?? null,
    fb_photo_id: r.fbPhotoId ?? null,
    ig_image_id: r.igImageId ?? null,
    publish_error: r.publishError ?? null,
  };
}

function socialFromRow(row: SocialRow): SocialPostRecord {
  return {
    id: String(row.id),
    key: String(row.key),
    productSlug: String(row.product_slug),
    productName: String(row.product_name),
    productPrice: Number(row.product_price ?? 0),
    productCategory: String(row.product_category ?? ""),
    imageUrl: String(row.image_url ?? ""),
    postImageUrl: typeof row.post_image_url === "string" ? row.post_image_url : undefined,
    publicImageUrl: typeof row.public_image_url === "string" ? row.public_image_url : undefined,
    kind: row.kind as SocialPostRecord["kind"],
    language: row.language as SocialPostRecord["language"],
    caption: row.caption as SocialPostRecord["caption"],
    engine: String(row.engine ?? ""),
    state: row.state as SocialPostRecord["state"],
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
    generatedAt: typeof row.generated_at === "string" ? row.generated_at : undefined,
    approvedAt: typeof row.approved_at === "string" ? row.approved_at : undefined,
    publishedAt: typeof row.published_at === "string" ? row.published_at : undefined,
    rejectedReason: typeof row.rejected_reason === "string" ? row.rejected_reason : undefined,
    fbPostId: typeof row.fb_post_id === "string" ? row.fb_post_id : undefined,
    igMediaId: typeof row.ig_media_id === "string" ? row.ig_media_id : undefined,
    fbPhotoId: typeof row.fb_photo_id === "string" ? row.fb_photo_id : undefined,
    igImageId: typeof row.ig_image_id === "string" ? row.ig_image_id : undefined,
    publishError: typeof row.publish_error === "string" ? row.publish_error : undefined,
  };
}

function adToRow(r: AdRecord): AdRow {
  return {
    id: r.id,
    key: r.key,
    product_slug: r.productSlug,
    product_name: r.productName,
    product_price: r.productPrice,
    product_category: r.productCategory,
    image_url: r.imageUrl,
    public_image_url: r.publicImageUrl ?? null,
    objective: r.objective,
    destination: r.destination,
    destination_url: r.destinationUrl,
    language: r.language,
    copy: r.copy,
    daily_budget_inr: r.dailyBudgetInr,
    engine: r.engine,
    state: r.state,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    generated_at: r.generatedAt ?? null,
    first_approved_at: r.firstApprovedAt ?? null,
    staged_at: r.stagedAt ?? null,
    second_approved_at: r.secondApprovedAt ?? null,
    activated_at: r.activatedAt ?? null,
    rejected_reason: r.rejectedReason ?? null,
    meta_campaign_id: r.metaCampaignId ?? null,
    meta_adset_id: r.metaAdsetId ?? null,
    meta_creative_id: r.metaCreativeId ?? null,
    meta_ad_id: r.metaAdId ?? null,
    meta_status: r.metaStatus ?? null,
    staging_error: r.stagingError ?? null,
  };
}

function adFromRow(row: AdRow): AdRecord {
  return {
    id: String(row.id),
    key: String(row.key),
    productSlug: String(row.product_slug),
    productName: String(row.product_name),
    productPrice: Number(row.product_price ?? 0),
    productCategory: String(row.product_category ?? ""),
    imageUrl: String(row.image_url ?? ""),
    publicImageUrl: typeof row.public_image_url === "string" ? row.public_image_url : undefined,
    objective: row.objective as AdRecord["objective"],
    destination: row.destination as AdRecord["destination"],
    destinationUrl: String(row.destination_url ?? ""),
    language: row.language as AdRecord["language"],
    copy: row.copy as AdRecord["copy"],
    dailyBudgetInr: Number(row.daily_budget_inr ?? 0),
    engine: String(row.engine ?? ""),
    state: row.state as AdRecord["state"],
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
    generatedAt: typeof row.generated_at === "string" ? row.generated_at : undefined,
    firstApprovedAt: typeof row.first_approved_at === "string" ? row.first_approved_at : undefined,
    stagedAt: typeof row.staged_at === "string" ? row.staged_at : undefined,
    secondApprovedAt: typeof row.second_approved_at === "string" ? row.second_approved_at : undefined,
    activatedAt: typeof row.activated_at === "string" ? row.activated_at : undefined,
    rejectedReason: typeof row.rejected_reason === "string" ? row.rejected_reason : undefined,
    metaCampaignId: typeof row.meta_campaign_id === "string" ? row.meta_campaign_id : undefined,
    metaAdsetId: typeof row.meta_adset_id === "string" ? row.meta_adset_id : undefined,
    metaCreativeId: typeof row.meta_creative_id === "string" ? row.meta_creative_id : undefined,
    metaAdId: typeof row.meta_ad_id === "string" ? row.meta_ad_id : undefined,
    metaStatus: typeof row.meta_status === "string" ? row.meta_status : undefined,
    stagingError: typeof row.staging_error === "string" ? row.staging_error : undefined,
  };
}

/* ------------------------------ social posts ------------------------------ */

export async function listSocialPosts(): Promise<SocialPostRecord[]> {
  if (isSupabaseBackend()) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from("social_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      if (/relation|does not exist/i.test(error.message)) {
        throw new Error(
          "social_posts table missing — run supabase/migrations/0006_marketing_ai.sql in the Supabase SQL editor",
        );
      }
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => socialFromRow(row as SocialRow));
  }
  return readDemo().socialPosts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getSocialPost(id: string): Promise<SocialPostRecord | null> {
  if (isSupabaseBackend()) {
    const supabase = await supabaseServer();
    const { data } = await supabase.from("social_posts").select("*").eq("id", id).maybeSingle();
    return data ? socialFromRow(data as SocialRow) : null;
  }
  return readDemo().socialPosts.find((p) => p.id === id) ?? null;
}

/** Idempotency: find an existing post for a product+kind+language key. */
export async function getSocialPostByKey(key: string): Promise<SocialPostRecord | null> {
  if (isSupabaseBackend()) {
    const supabase = await supabaseServer();
    const { data } = await supabase.from("social_posts").select("*").eq("key", key).maybeSingle();
    return data ? socialFromRow(data as SocialRow) : null;
  }
  return readDemo().socialPosts.find((p) => p.key === key) ?? null;
}

export async function saveSocialPost(record: SocialPostRecord): Promise<void> {
  if (isSupabaseBackend()) {
    const supabase = await supabaseServer();
    const { error } = await supabase
      .from("social_posts")
      .upsert(socialToRow(record), { onConflict: "id" });
    if (error) throw new Error(error.message);
    return;
  }
  const db = readDemo();
  const idx = db.socialPosts.findIndex((p) => p.id === record.id);
  if (idx >= 0) db.socialPosts[idx] = record;
  else db.socialPosts.push(record);
  writeDemo(db);
}

export async function deleteSocialPost(id: string): Promise<void> {
  if (isSupabaseBackend()) {
    const supabase = await supabaseServer();
    const { error } = await supabase.from("social_posts").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  const db = readDemo();
  db.socialPosts = db.socialPosts.filter((p) => p.id !== id);
  writeDemo(db);
}

/* ----------------------------------- ads ---------------------------------- */

export async function listAds(): Promise<AdRecord[]> {
  if (isSupabaseBackend()) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from("ads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      if (/relation|does not exist/i.test(error.message)) {
        throw new Error(
          "ads table missing — run supabase/migrations/0006_marketing_ai.sql in the Supabase SQL editor",
        );
      }
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => adFromRow(row as AdRow));
  }
  return readDemo().ads.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAd(id: string): Promise<AdRecord | null> {
  if (isSupabaseBackend()) {
    const supabase = await supabaseServer();
    const { data } = await supabase.from("ads").select("*").eq("id", id).maybeSingle();
    return data ? adFromRow(data as AdRow) : null;
  }
  return readDemo().ads.find((a) => a.id === id) ?? null;
}

/** Idempotency: find an existing ad for a product+objective+language key. */
export async function getAdByKey(key: string): Promise<AdRecord | null> {
  if (isSupabaseBackend()) {
    const supabase = await supabaseServer();
    const { data } = await supabase.from("ads").select("*").eq("key", key).maybeSingle();
    return data ? adFromRow(data as AdRow) : null;
  }
  return readDemo().ads.find((a) => a.key === key) ?? null;
}

export async function saveAd(record: AdRecord): Promise<void> {
  if (isSupabaseBackend()) {
    const supabase = await supabaseServer();
    const { error } = await supabase.from("ads").upsert(adToRow(record), { onConflict: "id" });
    if (error) throw new Error(error.message);
    return;
  }
  const db = readDemo();
  const idx = db.ads.findIndex((a) => a.id === record.id);
  if (idx >= 0) db.ads[idx] = record;
  else db.ads.push(record);
  writeDemo(db);
}

export async function deleteAd(id: string): Promise<void> {
  if (isSupabaseBackend()) {
    const supabase = await supabaseServer();
    const { error } = await supabase.from("ads").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  const db = readDemo();
  db.ads = db.ads.filter((a) => a.id !== id);
  writeDemo(db);
}

/* ---------------------------- key/value state ----------------------------- */

export async function getAiState<T>(key: string, fallback: T): Promise<T> {
  if (isSupabaseBackend()) {
    try {
      const supabase = await supabaseServer();
      const { data } = await supabase.from("state").select("value").eq("key", key).maybeSingle();
      return (data?.value as T | undefined) ?? fallback;
    } catch {
      return fallback;
    }
  }
  const v = readDemo().state[key];
  return (v as T | undefined) ?? fallback;
}

export async function setAiState(key: string, value: unknown): Promise<void> {
  if (isSupabaseBackend()) {
    const supabase = await supabaseServer();
    const { error } = await supabase
      .from("state")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return;
  }
  const db = readDemo();
  db.state[key] = value;
  writeDemo(db);
}
