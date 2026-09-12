/**
 * Ads engine — two-approval paid flow. RULE 8: no ad can spend without a
 * SECOND explicit approval.
 *
 *   generate (Ollama) → 1st approval → stage on Meta as PAUSED
 *     → 2nd approval → ACTIVE
 *
 * Idempotent staging: Meta ids are stored on the record as soon as each object
 * exists; a retry continues from the last completed object instead of
 * duplicating campaigns (Rule 11). TEST MODE (ADS_TEST_MODE, default true)
 * fakes Meta ids end-to-end so nothing can spend on a fresh install.
 */
import "server-only";
import { SITE } from "@/lib/site";
import { ollamaEnabled, ollamaJson } from "@/lib/marketing/ollama";
import {
  adKey,
  adSystemPrompt,
  adUserPrompt,
  buildAdParams,
  buildAdsetParams,
  buildCampaignParams,
  buildCreativeParams,
  ctaTypeFor,
  dailyBudgetMinorUnits,
  fallbackAdCopy,
  isAdsTestMode,
  parseAdReply,
  validateDailyBudget,
  type AdCopyData,
  type AdLanguage,
  type AdObjective,
  type AdPromptInput,
  type AdRecord,
} from "@/lib/marketing/ads";
import { getAd, getAdByKey, newAdId, saveAd } from "@/lib/marketing/ai-store";
import { uploadPipelineAsset } from "@/lib/marketing/storage";
import { sendTelegramCard } from "@/lib/marketing/telegram";
import { pipelineProduct } from "@/lib/marketing/store";
import { graphPost } from "@/lib/marketing/publish";
import { META_GRAPH_BASE } from "@/lib/marketing/meta-graph";

const GRAPH = META_GRAPH_BASE;

interface GraphReply {
  id?: string;
  error?: { message?: string };
}

/** Single Graph POST returning an object id (used for staging/pause). */
async function graphCall(
  path: string,
  params: Record<string, string>,
  token: string,
): Promise<string> {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ access_token: token, ...params }).toString(),
    signal: AbortSignal.timeout(60_000),
  });
  const json = (await res.json().catch(() => undefined)) as GraphReply | undefined;
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message ?? `Graph API HTTP ${res.status}`);
  }
  if (!json?.id) throw new Error(`Graph API returned no id for ${path}`);
  return json.id;
}

async function loadProduct(slug: string) {
  const row = await pipelineProduct(slug);
  if (!row) throw new Error("Product not found");
  return row;
}

/* ------------------------------- generation ------------------------------- */

export interface GenerateAdInput {
  productSlug: string;
  objective: AdObjective;
  language: AdLanguage;
  dailyBudgetInr: number;
  destination?: "website" | "whatsapp";
  destinationUrl?: string;
}

export interface GenerateAdResult {
  ad: AdRecord;
  created: boolean; // false when an existing record was reused (idempotent)
  engine: string;
}

/** Generate (or reuse) an ad record with Ollama copy — nothing goes to Meta. */
export async function generateAd(input: GenerateAdInput): Promise<GenerateAdResult> {
  validateDailyBudget(input.dailyBudgetInr);
  const row = await loadProduct(input.productSlug);
  const key = adKey(input.productSlug, input.objective, input.language);
  const existing = await getAdByKey(key);
  if (existing && existing.state !== "rejected") {
    return { ad: existing, created: false, engine: existing.engine };
  }

  const destinationUrl = input.destinationUrl?.trim() || `${SITE.url}/sarees/${row.slug}`;
  const promptInput: AdPromptInput = {
    productName: row.name,
    productCategory: row.category,
    price: row.price,
    fabric: row.fabric,
    productUrl: destinationUrl,
    objective: input.objective,
    language: input.language,
  };

  let copy: AdCopyData;
  let engine: string;
  if (ollamaEnabled()) {
    try {
      const text = await ollamaJson({
        system: adSystemPrompt(),
        prompt: adUserPrompt(promptInput),
        temperature: 0.75,
        numPredict: 400,
      });
      copy = parseAdReply(text);
      engine = `ollama:${process.env.OLLAMA_TEXT_MODEL?.trim() || "qwen2.5:7b"}`;
    } catch (err) {
      console.warn("[ads] Ollama generation failed, using template:", (err as Error).message);
      copy = fallbackAdCopy(promptInput);
      engine = "template-fallback";
    }
  } else {
    copy = fallbackAdCopy(promptInput);
    engine = "template-fallback";
  }

  const image = (row.images ?? []).find((u) => typeof u === "string" && u.trim().length > 0);
  if (!image) throw new Error("Product has no image — add one in Admin → Products first");

  const now = new Date().toISOString();
  const record: AdRecord = {
    id: existing?.id ?? newAdId(),
    key,
    productSlug: row.slug,
    productName: row.name,
    productPrice: row.price,
    productCategory: row.category,
    imageUrl: image,
    objective: input.objective,
    destination: input.destination ?? "website",
    destinationUrl,
    language: input.language,
    copy,
    dailyBudgetInr: input.dailyBudgetInr,
    engine,
    state: "pending_approval",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    generatedAt: now,
    rejectedReason: undefined,
  };
  await saveAd(record);
  await notifyAdCard(record);
  return { ad: record, created: true, engine };
}

/* ------------------------------- approvals -------------------------------- */

/** FIRST approval — allows the ad to be created on Meta in PAUSED state. */
export async function approveAd(id: string, source: "telegram" | "admin"): Promise<AdRecord> {
  const ad = await requireAd(id);
  if (ad.state !== "pending_approval") {
    throw new Error(`Cannot approve: ad is ${ad.state.replace(/_/g, " ")}`);
  }
  const next: AdRecord = {
    ...ad,
    state: "approved",
    firstApprovedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveAd(next);
  console.info(`[ads] ad ${id} approved (1st) via ${source}`);
  return next;
}

/** Reject a draft/pending ad with a reason. */
export async function rejectAd(
  id: string,
  reason: string,
  source: "telegram" | "admin",
): Promise<AdRecord> {
  const ad = await requireAd(id);
  if (ad.state !== "pending_approval" && ad.state !== "draft") {
    throw new Error(`Cannot reject a ${ad.state.replace(/_/g, " ")} ad`);
  }
  const next: AdRecord = {
    ...ad,
    state: "rejected",
    rejectedReason: reason.trim() || "No reason given",
    updatedAt: new Date().toISOString(),
  };
  await saveAd(next);
  console.info(`[ads] ad ${id} rejected via ${source}`);
  return next;
}

/**
 * SECOND approval — activates the PAUSED ad. This is the only code path in
 * the whole system that can make an ad spend money.
 */
export async function activateAd(id: string, source: "telegram" | "admin"): Promise<AdRecord> {
  const ad = await requireAd(id);
  if (ad.state !== "pending_activation") {
    throw new Error(
      `Second approval needs a PAUSED ad awaiting activation (current: ${ad.state.replace(/_/g, " ")})`,
    );
  }

  if (isAdsTestMode()) {
    const next: AdRecord = {
      ...ad,
      state: "active",
      secondApprovedAt: new Date().toISOString(),
      activatedAt: new Date().toISOString(),
      metaStatus: "ACTIVE",
      updatedAt: new Date().toISOString(),
    };
    await saveAd(next);
    return next;
  }

  const { loadPipelineSecrets } = await import("@/lib/marketing/secrets");
  const s = await loadPipelineSecrets();
  if (!s.metaPageToken || !ad.metaAdId) {
    throw new Error("Cannot activate: Meta token or staged ad id missing");
  }
  await graphPost<GraphReply>(ad.metaAdId, { status: "ACTIVE" }, s.metaPageToken);
  const next: AdRecord = {
    ...ad,
    state: "active",
    secondApprovedAt: new Date().toISOString(),
    activatedAt: new Date().toISOString(),
    metaStatus: "ACTIVE",
    updatedAt: new Date().toISOString(),
  };
  await saveAd(next);
  console.info(`[ads] ad ${id} ACTIVATED (2nd approval) via ${source}`);
  return next;
}

/** Manual pause (works on active and on staged-but-not-activated ads). */
export async function pauseAd(id: string): Promise<AdRecord> {
  const ad = await requireAd(id);
  if (ad.state !== "active" && ad.state !== "pending_activation") {
    throw new Error(`Cannot pause a ${ad.state.replace(/_/g, " ")} ad`);
  }
  if (!isAdsTestMode() && ad.metaAdId) {
    const { loadPipelineSecrets } = await import("@/lib/marketing/secrets");
    const s = await loadPipelineSecrets();
    if (s.metaPageToken) {
      await graphPost<GraphReply>(ad.metaAdId, { status: "PAUSED" }, s.metaPageToken);
    }
  }
  const next: AdRecord = {
    ...ad,
    state: "paused",
    metaStatus: "PAUSED",
    updatedAt: new Date().toISOString(),
  };
  await saveAd(next);
  return next;
}

/* --------------------------------- staging -------------------------------- */

/**
 * FIRST-approval follow-up: create campaign → adset → creative → ad on Meta,
 * all PAUSED. Idempotent — each id is persisted as soon as it exists.
 */
export async function stageAd(id: string): Promise<{ ad: AdRecord; simulated: boolean }> {
  const ad = await requireAd(id);
  if (ad.state === "pending_activation") {
    // Retry after a crash between staging and recording — idempotent no-op
    // (Rule 11: never duplicate Meta objects because of retries).
    return { ad, simulated: Boolean(ad.metaAdId?.startsWith("TEST-")) };
  }
  if (ad.state !== "approved") {
    throw new Error(`Staging needs an approved ad (current: ${ad.state.replace(/_/g, " ")})`);
  }

  if (isAdsTestMode()) {
    const now = new Date().toISOString();
    const staged: AdRecord = {
      ...ad,
      metaCampaignId: ad.metaCampaignId ?? `TEST-CAMP-${Date.now()}`,
      metaAdsetId: ad.metaAdsetId ?? `TEST-ADSET-${Date.now()}`,
      metaCreativeId: ad.metaCreativeId ?? `TEST-CREATIVE-${Date.now()}`,
      metaAdId: ad.metaAdId ?? `TEST-AD-${Date.now()}`,
      metaStatus: "PAUSED",
      stagedAt: ad.stagedAt ?? now,
      stagingError: undefined,
      updatedAt: now,
    };
    await saveAd(staged);
    const pending: AdRecord = { ...staged, state: "pending_activation", updatedAt: new Date().toISOString() };
    await saveAd(pending);
    return { ad: pending, simulated: true };
  }

  const { loadPipelineSecrets } = await import("@/lib/marketing/secrets");
  const s = await loadPipelineSecrets();
  const missing = [
    !s.metaPageToken && "meta_page_access_token",
    !s.fbPageId && "meta_fb_page_id",
    !s.metaAdAccountId && "meta_ad_account_id",
  ].filter(Boolean) as string[];
  if (missing.length > 0) {
    throw new Error(`Meta ads not configured (missing: ${missing.join(", ")})`);
  }

  const token = s.metaPageToken!;
  const act = s.metaAdAccountId!.startsWith("act_")
    ? s.metaAdAccountId!
    : `act_${s.metaAdAccountId!}`;
  const imageUrl = await ensurePublicAdImageUrl(ad);
  const ctaType = ctaTypeFor(ad.destination);
  let current = ad;

  try {
    if (!current.metaCampaignId) {
      const campaignId = await graphCall(
        `${act}/campaigns`,
        buildCampaignParams(`${SITE.name} — ${current.productName}`, current.objective),
        token,
      );
      current = { ...current, metaCampaignId: campaignId, updatedAt: new Date().toISOString() };
      await saveAd(current); // checkpoint — retry never duplicates this object
    }
    if (!current.metaAdsetId) {
      const adsetId = await graphCall(
        `${act}/adsets`,
        buildAdsetParams({
          name: `${SITE.name} — ${current.productName} — adset`,
          campaignId: current.metaCampaignId!,
          dailyBudgetMinor: dailyBudgetMinorUnits(current.dailyBudgetInr),
          country: process.env.META_AD_COUNTRY?.trim() || "IN",
          ageMin: Number(process.env.META_AGE_MIN ?? 30) || 30,
          ageMax: Number(process.env.META_AGE_MAX ?? 55) || 55,
        }),
        token,
      );
      current = { ...current, metaAdsetId: adsetId, updatedAt: new Date().toISOString() };
      await saveAd(current);
    }
    if (!current.metaCreativeId) {
      const creativeId = await graphCall(
        `${act}/adcreatives`,
        buildCreativeParams(
          `${SITE.name} — ${current.productName} — creative`,
          s.fbPageId!,
          imageUrl,
          current.copy,
          current.destinationUrl,
          ctaType,
        ),
        token,
      );
      current = { ...current, metaCreativeId: creativeId, publicImageUrl: imageUrl, updatedAt: new Date().toISOString() };
      await saveAd(current);
    }
    if (!current.metaAdId) {
      const adId = await graphCall(
        `${act}/ads`,
        buildAdParams(`${SITE.name} — ${current.productName} — ad`, current.metaAdsetId!, current.metaCreativeId!),
        token,
      );
      current = { ...current, metaAdId: adId, updatedAt: new Date().toISOString() };
      await saveAd(current);
    }

    const staged: AdRecord = {
      ...current,
      state: "staged",
      stagedAt: current.stagedAt ?? new Date().toISOString(),
      metaStatus: "PAUSED",
      stagingError: undefined,
      publicImageUrl: imageUrl,
      updatedAt: new Date().toISOString(),
    };
    await saveAd(staged);
    const pending: AdRecord = { ...staged, state: "pending_activation", updatedAt: new Date().toISOString() };
    await saveAd(pending);
    return { ad: pending, simulated: false };
  } catch (err) {
    const failed: AdRecord = {
      ...current,
      stagingError: (err as Error).message,
      updatedAt: new Date().toISOString(),
    };
    await saveAd(failed);
    throw err;
  }
}

/* ------------------------------ telegram card ------------------------------ */

/** Send (or re-send) the Telegram approval card for an ad. */
export async function notifyAdCard(ad: AdRecord): Promise<void> {
  const buttons =
    ad.state === "pending_approval"
      ? [
          [
            { text: "✅ Approve (create PAUSED)", callback_data: `ad:approve:${ad.id}` },
            { text: "❌ Reject", callback_data: `ad:reject:${ad.id}` },
          ],
          [{ text: "🔄 Regenerate", callback_data: `ad:regen:${ad.id}` }],
        ]
      : ad.state === "pending_activation"
        ? [[{ text: `🚀 ACTIVATE (₹${ad.dailyBudgetInr}/day)`, callback_data: `ad:activate:${ad.id}` }]]
        : [];

  const stateNote: Record<string, string> = {
    pending_approval:
      "1st approval → ad is created on Meta in PAUSED state. No spending yet.",
    pending_activation: `2nd approval → the ad STARTS SPENDING ₹${ad.dailyBudgetInr}/day.`,
  };

  await sendTelegramCard({
    text: [
      `<b>💰 Meta ad — ${ad.state.replace(/_/g, " ")}</b>`,
      ``,
      `<b>${escapeHtml(ad.productName)}</b> · ₹${ad.productPrice} · ${escapeHtml(ad.objective)}`,
      `Daily budget: ₹${ad.dailyBudgetInr} · ${escapeHtml(ad.destination)} · ${ad.language}`,
      ``,
      `<b>${escapeHtml(ad.copy.headline)}</b>`,
      escapeHtml(ad.copy.primaryText),
      `${escapeHtml(ad.copy.cta)} → ${escapeHtml(ad.destinationUrl)}`,
      ``,
      stateNote[ad.state] ?? "Open Admin → Marketing AI to manage.",
      ad.stagingError ? `⚠️ ${escapeHtml(ad.stagingError)}` : "",
    ].filter(Boolean).join("\n"),
    imageUrl: absolutiseImageUrl(ad.imageUrl),
    buttons,
  });
}

/** Regenerate = discard rejected copy and generate fresh (key reuse). */
export async function regenerateAd(id: string): Promise<AdRecord> {
  const ad = await requireAd(id);
  if (ad.state !== "pending_approval" && ad.state !== "draft" && ad.state !== "rejected") {
    throw new Error(`Cannot regenerate a ${ad.state.replace(/_/g, " ")} ad`);
  }
  return (
    await generateAd({
      productSlug: ad.productSlug,
      objective: ad.objective,
      language: ad.language,
      dailyBudgetInr: ad.dailyBudgetInr,
      destination: ad.destination,
      destinationUrl: ad.destinationUrl,
    })
  ).ad;
}

/* --------------------------------- helpers --------------------------------- */

async function requireAd(id: string): Promise<AdRecord> {
  const ad = await getAd(id);
  if (!ad) throw new Error("Ad not found");
  return ad;
}

/**
 * Meta creatives need a PUBLIC https URL. Supabase mode uploads the product
 * image to the social-media bucket once and reuses it. Demo mode cannot serve
 * public URLs — production staging throws with a clear hint.
 */
async function ensurePublicAdImageUrl(ad: AdRecord): Promise<string> {
  const { isSupabaseBackend } = await import("@/lib/backend/env");
  if (/^https:\/\//i.test(ad.imageUrl)) return ad.imageUrl;
  if (!isSupabaseBackend()) {
    throw new Error(
      "Product image is local (demo mode) — Meta needs a public https URL. Use ADS_TEST_MODE=true, or switch to the Supabase backend.",
    );
  }
  if (ad.publicImageUrl) return ad.publicImageUrl;
  const { fetchImageBytes } = await import("@/lib/marketing/storage");
  const { bytes, contentType } = await fetchImageBytes(ad.imageUrl);
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const stored = await uploadPipelineAsset(
    "social-media",
    `${ad.productSlug}-ad.${ext}`,
    bytes,
    contentType,
  );
  return stored.url;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function absolutiseImageUrl(url: string): string | undefined {
  if (/^https?:\/\//i.test(url)) return url;
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}${url}`;
}
