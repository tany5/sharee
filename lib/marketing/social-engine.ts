/**
 * Social engine — generation → approval → publish for organic FB/IG posts.
 *
 *   generate (LOCAL Ollama only) → Telegram card → owner approves in the
 *   admin UI or Telegram → publish to Meta (TEST MODE simulates) → ids saved.
 *
 * Idempotency: every post has a stable key (product:kind:language); a retry
 * after a publish crash reuses the same record and never double-posts. The
 * product image pipeline is NOT touched — posts reuse existing images.
 */
import "server-only";
import { SITE } from "@/lib/site";
import { ollamaEnabled, ollamaJson } from "@/lib/marketing/ollama";
import {
  fallbackSocialCaption,
  isSocialTestMode,
  parseSocialReply,
  pickSocialImage,
  socialKey,
  socialSystemPrompt,
  socialToCaption,
  socialUserPrompt,
  type SocialCaption,
  type SocialLanguage,
  type SocialPostKind,
  type SocialPostRecord,
  type SocialState,
} from "@/lib/marketing/social";
import {
  getSocialPostByKey,
  newSocialId,
  saveSocialPost,
} from "@/lib/marketing/ai-store";
import { composePostCard } from "@/lib/marketing/post-image";
import {
  PROMO_CAMPAIGN,
  planPromo,
} from "@/lib/marketing/promo/poster-plan";
import { generatePuterPromoImage } from "@/lib/marketing/puter-promo";
import { aiModelAdPrompt, editImageToImage, pollinationsEnabled, pollinationsKey } from "@/lib/marketing/pollinations";
import { composeEditorialCard } from "@/lib/marketing/editorial-image";
import { shortLink } from "@/lib/marketing/post-card";
import { fetchImageBytes, uploadPipelineAsset } from "@/lib/marketing/storage";
import { sendTelegramCard } from "@/lib/marketing/telegram";
import { pipelineProduct } from "@/lib/marketing/store";

export interface GenerateSocialInput {
  productSlug: string;
  kind: SocialPostKind;
  language: SocialLanguage;
}

export interface GenerateSocialResult {
  post: SocialPostRecord;
  created: boolean; // false when an existing record was reused (idempotent)
  engine: string;
}

/** Load a product row for the social flow (admin store, either backend). */
async function loadProduct(slug: string) {
  const row = await pipelineProduct(slug);
  if (!row) throw new Error("Product not found");
  return row;
}

/**
 * Generate (or regenerate) a social post for one product.
 * - draft/regenerate → fresh Ollama output, stays/returns to pending_approval
 * - existing pending/approved/published → reused, no regeneration (idempotent)
 */
export async function generateSocialPost(
  input: GenerateSocialInput,
): Promise<GenerateSocialResult> {
  const row = await loadProduct(input.productSlug);
  const key = socialKey(input.productSlug, input.kind, input.language);
  const existing = await getSocialPostByKey(key);
  if (existing && existing.state !== "rejected") {
    return { post: existing, created: false, engine: existing.engine };
  }

  // PROMO POSTER — Puter-only ₹199 campaign creative.
  // Captions/planning via the promo planner; everything else is shared.
  if (input.kind === "promo_poster") {
    return generatePromoSocialPost({ row, key, existing, productUrl: `${SITE.url}/sarees/${row.slug}` });
  }

  // AI MODEL AD — Pollinations I2I: product photo → model-wearing-saree ad
  // creative (banner text spelled "INR …"; ₹ is only safe in sharp pixels).
  if (input.kind === "ai_model_ad") {
    return generateAiModelAdPost({
      row,
      key,
      existing,
      productUrl: `${SITE.url}/sarees/${row.slug}`,
      language: input.language,
    });
  }

  const productUrl = `${SITE.url}/sarees/${row.slug}`;
  const promptInput = {
    productName: row.name,
    productCategory: row.category,
    price: row.price,
    fabric: row.fabric,
    productUrl,
    kind: input.kind,
    language: input.language,
  };

  const { caption, engine } = await socialCaption(promptInput);

  const image = pickSocialImage(row.images ?? []);
  if (!image) throw new Error("Product has no image — add one in Admin → Products first");

  // Branded 4:5 card — composed LOCALLY from the existing photo (sharp).
  // Failure never blocks the flow: the post falls back to the raw image.
  let postImageUrl: string | undefined;
  try {
    const card = await composePostCard({
      headline: row.name,
      body: caption.body,
      price: row.price,
      siteName: SITE.name,
      handle: SITE.instagramHandle,
      siteUrl: SITE.url,
      productPath: `sarees/${row.slug}`,
      imageUrl: image,
    });
    const stored = await uploadPipelineAsset(
      "social-media",
      `${row.slug}-${input.kind}-card.jpg`,
      card.buffer,
      card.contentType,
    );
    postImageUrl = stored.url;
  } catch (err) {
    console.warn("[social] branded card composition failed, using raw product image:", (err as Error).message);
  }

  const now = new Date().toISOString();
  const record: SocialPostRecord = {
    id: existing?.id ?? newSocialId(),
    key,
    productSlug: row.slug,
    productName: row.name,
    productPrice: row.price,
    productCategory: row.category,
    imageUrl: image,
    postImageUrl,
    kind: input.kind,
    language: input.language,
    caption,
    engine,
    state: "pending_approval",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    generatedAt: now,
    rejectedReason: undefined,
  };
  await saveSocialPost(record);
  await notifySocialCard(record);
  return { post: record, created: true, engine };
}

/** Edit caption fields of a pending post (owner tweaks before approval). */
export async function editSocialPost(
  id: string,
  patch: Partial<Pick<SocialCaption, "hook" | "body" | "cta">> & { hashtags?: string[] },
): Promise<SocialPostRecord> {
  const post = await requirePost(id);
  if (post.state !== "pending_approval" && post.state !== "draft") {
    throw new Error(`Cannot edit a ${post.state} post`);
  }
  const next: SocialPostRecord = {
    ...post,
    caption: {
      hook: patch.hook?.trim() || post.caption.hook,
      body: patch.body?.trim() || post.caption.body,
      cta: patch.cta?.trim() || post.caption.cta,
      hashtags:
        patch.hashtags && patch.hashtags.length > 0
          ? patch.hashtags.map((h) => (h.startsWith("#") ? h : `#${h.replace(/^#+/, "")}`)).slice(0, 6)
          : post.caption.hashtags,
    },
    updatedAt: new Date().toISOString(),
  };
  await saveSocialPost(next);
  return next;
}

/** Approve a pending post (Telegram callback or admin UI). */
export async function approveSocialPost(id: string, source: "telegram" | "admin"): Promise<SocialPostRecord> {
  const post = await requirePost(id);
  assertState(post.state, "pending_approval", "approve");
  const next: SocialPostRecord = {
    ...post,
    state: "approved",
    approvedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveSocialPost(next);
  console.info(`[social] post ${id} approved via ${source}`);
  return next;
}

/** Reject a draft/pending post with a reason. */
export async function rejectSocialPost(
  id: string,
  reason: string,
  source: "telegram" | "admin",
): Promise<SocialPostRecord> {
  const post = await requirePost(id);
  if (post.state !== "pending_approval" && post.state !== "draft") {
    throw new Error(`Cannot reject a ${post.state} post`);
  }
  const next: SocialPostRecord = {
    ...post,
    state: "rejected",
    rejectedReason: reason.trim() || "No reason given",
    updatedAt: new Date().toISOString(),
  };
  await saveSocialPost(next);
  console.info(`[social] post ${id} rejected via ${source}`);
  return next;
}

/** Send (or re-send) the Telegram approval card for a post. */
export async function notifySocialCard(post: SocialPostRecord): Promise<void> {
  const caption = socialToCaption(post.caption);
  await sendTelegramCard({
    text: [
      `<b>📝 Social post — ${post.state === "pending_approval" ? "approval needed" : post.state.replace("_", " ")}</b>`,
      ``,
      `<b>${escapeHtml(post.productName)}</b> · ₹${post.productPrice}`,
      `${escapeHtml(SITE.url)}/sarees/${post.productSlug}`,
      ``,
      `<i>${escapeHtml(caption)}</i>`,
      ``,
      `kind: ${post.kind} · lang: ${post.language} · engine: ${post.engine}`,
      post.state === "pending_approval"
        ? `Approve below or in Admin → Marketing AI.`
        : `Open Admin → Marketing AI to manage.`,
    ].join("\n"),
    imageUrl: absolutiseImageUrl(post.postImageUrl ?? post.imageUrl),
    buttons:
      post.state === "pending_approval"
        ? [
            [
              { text: "✅ Approve", callback_data: `social:approve:${post.id}` },
              { text: "❌ Reject", callback_data: `social:reject:${post.id}` },
            ],
            [{ text: "🔄 Regenerate", callback_data: `social:regen:${post.id}` }],
          ]
        : [],
  });
}

/**
 * Publish an APPROVED post to Facebook + Instagram.
 * TEST MODE (default): simulates Meta ids and marks published — nothing goes
 * live. Production (SOCIAL_TEST_MODE=false): real Graph API calls.
 * Idempotent: a published post is returned untouched; a partially published
 * post (fb done, ig crashed) keeps its ids and only completes the rest.
 */
export async function publishSocialPost(
  id: string,
  source: "telegram" | "admin" = "admin",
): Promise<{ post: SocialPostRecord; simulated: boolean; note?: string }> {
  const post = await requirePost(id);
  if (post.state === "published") {
    return { post, simulated: isSocialTestMode(), note: "Already published (idempotent)" };
  }
  assertState(post.state, "approved", "publish");

  const { secrets, missing } = await metaSecrets();
  if (missing.length > 0 && !isSocialTestMode()) {
    throw new Error(`Meta not configured (missing: ${missing.join(", ")})`);
  }

  // TEST MODE never needs a public URL (nothing is sent to Meta).
  const imageUrl = isSocialTestMode() ? post.imageUrl : await ensurePublicImageUrl(post);
  const caption = socialToCaption(post.caption);
  const next: SocialPostRecord = { ...post, publicImageUrl: imageUrl, updatedAt: new Date().toISOString() };

  if (isSocialTestMode()) {
    next.fbPostId = next.fbPostId ?? `TEST-FB-${Date.now()}`;
    next.igMediaId = next.igMediaId ?? `TEST-IG-${Date.now()}`;
    next.state = "published";
    next.publishedAt = new Date().toISOString();
    await saveSocialPost(next);
    return { post: next, simulated: true, note: "TEST MODE — nothing went live" };
  }

  const { publishFacebookPhoto, publishInstagramImage } = await import("@/lib/marketing/publish");
  const { resolveMetaPageToken } = await import("@/lib/marketing/secrets");
  const s = {
    metaPageToken: (await resolveMetaPageToken(secrets))!,
    fbPageId: secrets.fbPageId!,
    igUserId: secrets.igUserId!,
  };
  let failed: string | undefined;
  if (!next.fbPostId) {
    try {
      next.fbPostId = await publishFacebookPhoto(imageUrl, caption, s);
    } catch (err) {
      failed = `Facebook: ${(err as Error).message}`;
    }
  }
  if (!next.igMediaId) {
    try {
      next.igMediaId = await publishInstagramImage(imageUrl, caption, s);
    } catch (err) {
      failed = `${failed ? `${failed}; ` : ""}Instagram: ${(err as Error).message}`;
    }
  }
  if (!next.fbPostId && !next.igMediaId) {
    next.publishError = failed;
    next.updatedAt = new Date().toISOString();
    await saveSocialPost(next);
    throw new Error(failed ?? "Publishing failed");
  }
  next.publishError = undefined;
  next.state = "published";
  next.publishedAt = new Date().toISOString();
  await saveSocialPost(next);
  console.info(`[social] post ${id} published via ${source}`);
  return { post: next, simulated: false };
}

/** Regenerate = reject current pending + generate fresh (idempotent key reuse). */
export async function regenerateSocialPost(id: string): Promise<SocialPostRecord> {
  const post = await requirePost(id);
  if (post.state !== "pending_approval" && post.state !== "draft" && post.state !== "rejected") {
    throw new Error(`Cannot regenerate a ${post.state} post`);
  }
  if (post.state !== "rejected") {
    await saveSocialPost({
      ...post,
      state: "rejected",
      rejectedReason: "Regenerated by owner",
      updatedAt: new Date().toISOString(),
    });
  }
  return (
    await generateSocialPost({
      productSlug: post.productSlug,
      kind: post.kind,
      language: post.language,
    })
  ).post;
}

/* ------------------------------- ai model ad ------------------------------- */

/** Ollama caption with template fallback (shared by regular + promo flows). */
async function socialCaption(promptInput: Parameters<typeof socialUserPrompt>[0]): Promise<{
  caption: SocialCaption;
  engine: string;
}> {
  if (ollamaEnabled()) {
    try {
      const text = await ollamaJson({
        system: socialSystemPrompt(),
        prompt: socialUserPrompt(promptInput),
        temperature: 0.8,
        numPredict: 600,
      });
      return {
        caption: parseSocialReply(text),
        engine: `ollama:${process.env.OLLAMA_TEXT_MODEL?.trim() || "qwen2.5:7b"}`,
      };
    } catch (err) {
      console.warn("[social] Ollama generation failed, using template:", (err as Error).message);
    }
  }
  return { caption: fallbackSocialCaption(promptInput), engine: "template-fallback" };
}

/** Preferred source for the I2I edit: front model render, else product photo. */
function aiAdSource(row: PipelineRow): string {
  const renders = row.marketing?.tryOn?.renders ?? [];
  const front = renders.find((r) => r.kind === "front") ?? renders[0];
  if (front?.imageUrl) return front.imageUrl;
  const img = pickSocialImage(row.images ?? []);
  if (!img) throw new Error("Product has no image — add one in Admin → Products first");
  return img;
}

/**
 * Build the AI model-ad post: the EXISTING product/model photo is converted
 * by Pollinations (flux.1-kontext-pro) into a fashion-ad creative. The caption
 * still comes from local Ollama; failure anywhere falls back to the raw image
 * or template caption — the flow never blocks on the cloud.
 */
async function generateAiModelAdPost(ctx: {
  row: PipelineRow;
  key: string;
  existing: SocialPostRecord | null;
  productUrl: string;
  language: SocialLanguage;
}): Promise<GenerateSocialResult> {
  const { row, key, existing, productUrl, language } = ctx;
  const source = aiAdSource(row);

  // Caption: same local Ollama flow as regular posts (template fallback).
  const { caption: ollamaCaption, engine: textEngine } = await socialCaption({
    productName: row.name,
    productCategory: row.category,
    price: row.price,
    fabric: row.fabric,
    productUrl,
    kind: "ai_model_ad",
    language,
  });

  // I2I creative — optional. Any failure keeps the original image.
  let engine = `pollinations:kontext-pro+${textEngine}`;
  let postImageUrl: string | undefined;
  try {
    const key2 = await pollinationsKey();
    let adImageUrl: string | undefined;
    if (pollinationsEnabled(key2)) {
      const { bytes, contentType } = await fetchImageBytes(source);
      const edited = await editImageToImage({
        sourceBytes: bytes,
        contentType,
        prompt: aiModelAdPrompt({ price: row.price, brand: SITE.name }),
      });
      const adStored = await uploadPipelineAsset(
        "social-media",
        `${row.slug}-ai-model-ad.jpg`,
        edited.buffer,
        edited.contentType,
      );
      adImageUrl = adStored.url;
    } else {
      console.warn("[social] Pollinations key missing — editorial card uses the raw product photo");
      engine = `pollinations-off+${textEngine}`;
    }

    // Editorial typography pass (magazine-style creative, sharp-rendered —
    // exact price). Works on the AI creative OR the raw photo, so the kind
    // still produces a finished card without a Pollinations key.
    const composed = await composeEditorialCard({
      brand: SITE.name,
      headline: row.name,
      hashtag: ollamaCaption.hashtags[0] ?? "#TheTanti",
      price: row.price,
      handle: SITE.instagramHandle,
      siteLink: shortLink(SITE.url, `sarees/${row.slug}`),
      imageUrl: adImageUrl ?? source,
    });
    const cardStored = await uploadPipelineAsset(
      "social-media",
      `${row.slug}-ai-model-ad-editorial.jpg`,
      composed.buffer,
      composed.contentType,
    );
    postImageUrl = cardStored.url;
  } catch (err) {
    console.warn("[social] ai_model_ad composition failed, using raw source image:", (err as Error).message);
  }

  const now = new Date().toISOString();
  const record: SocialPostRecord = {
    id: existing?.id ?? newSocialId(),
    key,
    productSlug: row.slug,
    productName: row.name,
    productPrice: row.price,
    productCategory: row.category,
    imageUrl: source,
    postImageUrl,
    kind: "ai_model_ad",
    language,
    caption: ollamaCaption,
    engine,
    state: "pending_approval",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    generatedAt: now,
    rejectedReason: undefined,
  };
  await saveSocialPost(record);
  await notifySocialCard(record);
  return { post: record, created: true, engine };
}

/* ------------------------------- promo poster ------------------------------- */

type PipelineRow = NonNullable<Awaited<ReturnType<typeof pipelineProduct>>>;

/** Preferred hero: the EXISTING front model render, else first product image. */
function promoHero(row: PipelineRow): string {
  const renders = row.marketing?.tryOn?.renders ?? [];
  const front = renders.find((r) => r.kind === "front") ?? renders[0];
  if (front?.imageUrl) return front.imageUrl;
  const img = pickSocialImage(row.images ?? []);
  if (!img) throw new Error("Product has no image — add one in Admin → Products first");
  return img;
}

/** Build + store the bright promo poster post (caption from the promo plan). */
async function generatePromoSocialPost(ctx: {
  row: PipelineRow;
  key: string;
  existing: SocialPostRecord | null;
  productUrl: string;
}): Promise<GenerateSocialResult> {
  const { row, key, existing, productUrl } = ctx;

  // Price protection (owner spec): never render a wrong campaign price.
  if (row.price !== PROMO_CAMPAIGN.price) {
    throw new Error(
      `Price mismatch detected. Creative was not created (product ₹${row.price} vs campaign ₹${PROMO_CAMPAIGN.price}).`,
    );
  }

  const hero = promoHero(row);
  const renders = row.marketing?.tryOn?.renders ?? [];
  const plan = await planPromo({
    productName: row.name,
    category: row.category,
    fabric: row.fabric,
    heroKind: renders.length > 0 ? "existing model render" : "existing product photo",
  });

  let engine = plan.engine;
  const seed = Math.floor(Math.random() * 1e9);
  const poster = await generatePuterPromoImage({
    productName: row.name,
    category: row.category,
    fabric: row.fabric,
    price: PROMO_CAMPAIGN.price,
    heroImageUrl: hero,
    styleHint: plan.backgroundPrompt,
    seed,
  });
  if (!poster) {
    throw new Error("Puter poster worker is not connected. Click Connect Puter in Admin -> Marketing AI, sign in, keep the tab open, then generate again.");
  }
  engine = `${engine}+${poster.engine}`;
  const stored = await uploadPipelineAsset(
    "social-media",
    `${row.slug}-promo-poster.${poster.contentType.includes("png") ? "png" : "jpg"}`,
    poster.buffer,
    poster.contentType,
  );
  const postImageUrl = stored.url;

  const caption: SocialCaption = {
    hook: `${PROMO_CAMPAIGN.offer} ${PROMO_CAMPAIGN.currency}${PROMO_CAMPAIGN.price} ${PROMO_CAMPAIGN.priceLabel} 🙌`,
    body: plan.caption,
    cta: `Order kariye: ${productUrl}`,
    hashtags: plan.hashtags,
  };

  const now = new Date().toISOString();
  const record: SocialPostRecord = {
    id: existing?.id ?? newSocialId(),
    key,
    productSlug: row.slug,
    productName: row.name,
    productPrice: row.price,
    productCategory: row.category,
    imageUrl: hero,
    postImageUrl,
    kind: "promo_poster",
    language: "hinglish",
    caption,
    engine,
    state: "pending_approval",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    generatedAt: now,
    rejectedReason: undefined,
  };
  await saveSocialPost(record);
  await notifySocialCard(record);
  return { post: record, created: true, engine };
}

/* --------------------------------- helpers --------------------------------- */

function assertState(state: SocialState, expected: SocialState, action: string): void {
  if (state !== expected) {
    throw new Error(`Cannot ${action}: post is ${state.replace("_", " ")}, expected ${expected.replace("_", " ")}`);
  }
}

async function requirePost(id: string): Promise<SocialPostRecord> {
  const { getSocialPost } = await import("@/lib/marketing/ai-store");
  const post = await getSocialPost(id);
  if (!post) throw new Error("Social post not found");
  return post;
}

async function metaSecrets(): Promise<{
  secrets: Awaited<ReturnType<typeof import("@/lib/marketing/secrets").loadPipelineSecrets>>;
  missing: string[];
}> {
  const { loadPipelineSecrets } = await import("@/lib/marketing/secrets");
  const s = await loadPipelineSecrets();
  const missing = [
    !s.metaPageToken && "meta_page_access_token",
    !s.fbPageId && "meta_fb_page_id",
    !s.igUserId && "meta_ig_user_id",
  ].filter(Boolean) as string[];
  return { secrets: s, missing };
}

/**
 * Meta needs a PUBLIC https URL. Supabase mode: product images may be local
 * /api/media paths → upload the bytes to the social-media bucket first.
 * Demo mode: TEST MODE only (no public URL possible without a tunnel).
 */
async function ensurePublicImageUrl(post: SocialPostRecord): Promise<string> {
  const { isSupabaseBackend } = await import("@/lib/backend/env");
  // The branded card (when composed) is what followers see — prefer it.
  if (post.postImageUrl && /^https:\/\//i.test(post.postImageUrl)) return post.postImageUrl;
  if (/^https:\/\//i.test(post.imageUrl)) return post.imageUrl;
  if (!isSupabaseBackend()) {
    throw new Error(
      "Product image is local (demo mode) — Meta needs a public https URL. Run with SOCIAL_TEST_MODE=true, or switch to the Supabase backend.",
    );
  }
  if (post.publicImageUrl) return post.publicImageUrl;
  const { fetchImageBytes } = await import("@/lib/marketing/storage");
  const { bytes, contentType } = await fetchImageBytes(post.imageUrl);
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const stored = await uploadPipelineAsset(
    "social-media",
    `${post.productSlug}-${post.kind}.${ext}`,
    bytes,
    contentType,
  );
  return stored.url;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Telegram sendPhoto needs an absolute URL; local paths get the site origin. */
function absolutiseImageUrl(url: string): string | undefined {
  if (/^https?:\/\//i.test(url)) return url;
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}${url}`;
}
