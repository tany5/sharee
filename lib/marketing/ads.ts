/**
 * Ads Director — PURE logic for the two-step paid Meta ad flow.
 *
 *   draft → pending_approval → approved → staged →
 *     (Meta ad object created PAUSED) → pending_activation →
 *     (SECOND approval) → active      (any pre-publish step → rejected)
 *
 * RULE: no advertisement can spend money without a SECOND explicit approval.
 * The first approval only lets the ad be created on Meta in PAUSED state.
 * Pure functions only — the engine wires them to Ollama + Graph API.
 */

export type AdState =
  | "draft"
  | "pending_approval"
  | "approved"
  | "staged"
  | "pending_activation"
  | "active"
  | "paused"
  | "rejected";

export const AD_STATES: AdState[] = [
  "draft",
  "pending_approval",
  "approved",
  "staged",
  "pending_activation",
  "active",
  "paused",
  "rejected",
];

export const AD_STATE_LABEL: Record<AdState, string> = {
  draft: "Draft",
  pending_approval: "Awaiting 1st approval",
  approved: "Approved (not yet on Meta)",
  staged: "Created on Meta — PAUSED",
  pending_activation: "Awaiting 2nd approval",
  active: "ACTIVE (spending)",
  paused: "Paused on Meta",
  rejected: "Rejected",
};

export function canTransitionAd(from: AdState, to: AdState): boolean {
  switch (to) {
    case "pending_approval":
      return from === "draft";
    case "approved":
      return from === "pending_approval";
    case "staged":
      return from === "approved";
    case "pending_activation":
      return from === "staged";
    case "active":
      return from === "pending_activation"; // the SECOND approval gate
    case "paused":
      return from === "active" || from === "pending_activation";
    case "rejected":
      return from === "draft" || from === "pending_approval";
    case "draft":
      return from === "pending_approval";
    default:
      return false;
  }
}

/** True when the ad exists on Meta but can never spend without more action. */
export function isAdHarmless(state: AdState): boolean {
  return state === "draft" || state === "pending_approval" || state === "approved";
}

export type AdObjective = "OUTCOME_TRAFFIC" | "OUTCOME_ENGAGEMENT" | "OUTCOME_SALES";
export type AdLanguage = "hinglish" | "banglish";
export type AdDestination = "website" | "whatsapp";

/** Daily budget in whole rupees (Meta API uses minor units ×100 internally). */
export interface AdCopyData {
  headline: string;
  primaryText: string;
  cta: string;
  hashtags: string[];
}

export interface AdRecord {
  id: string;
  /** Idempotency key — one ad per product+objective+language. */
  key: string;
  productSlug: string;
  productName: string;
  productPrice: number;
  productCategory: string;
  /** The EXISTING product image promoted (never a new generation). */
  imageUrl: string;
  /** Public HTTPS URL (Supabase) used for Meta creative — resolved at staging. */
  publicImageUrl?: string;
  objective: AdObjective;
  destination: AdDestination;
  destinationUrl: string;
  language: AdLanguage;
  copy: AdCopyData;
  /** Daily budget, whole rupees. */
  dailyBudgetInr: number;
  engine: string;
  state: AdState;
  createdAt: string;
  updatedAt: string;
  generatedAt?: string;
  firstApprovedAt?: string;
  stagedAt?: string;
  secondApprovedAt?: string;
  activatedAt?: string;
  rejectedReason?: string;
  /** Meta ids after staging (idempotent retries reuse these). */
  metaCampaignId?: string;
  metaAdsetId?: string;
  metaCreativeId?: string;
  metaAdId?: string;
  /** Current Meta effective status, synced from the API when available. */
  metaStatus?: string;
  stagingError?: string;
}

export const AD_OBJECTIVES: AdObjective[] = [
  "OUTCOME_TRAFFIC",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_SALES",
];

export const AD_OBJECTIVE_LABEL: Record<AdObjective, string> = {
  OUTCOME_TRAFFIC: "Traffic",
  OUTCOME_ENGAGEMENT: "Engagement",
  OUTCOME_SALES: "Sales",
};

/** Whole-rupee bounds for the daily budget (sanity guard, configurable). */
export const AD_MIN_DAILY_BUDGET_INR = 50;
export const AD_MAX_DAILY_BUDGET_INR = 1000;

export function validateDailyBudget(inr: number): void {
  if (!Number.isFinite(inr) || !Number.isInteger(inr)) {
    throw new Error("Daily budget must be a whole number of rupees");
  }
  if (inr < AD_MIN_DAILY_BUDGET_INR || inr > AD_MAX_DAILY_BUDGET_INR) {
    throw new Error(
      `Daily budget must be between ₹${AD_MIN_DAILY_BUDGET_INR} and ₹${AD_MAX_DAILY_BUDGET_INR}`,
    );
  }
}

/** Meta minor units (paise) — Graph API budget fields. */
export function dailyBudgetMinorUnits(inr: number): number {
  validateDailyBudget(inr);
  return inr * 100;
}

export function adKey(
  productSlug: string,
  objective: AdObjective,
  language: AdLanguage,
): string {
  return `${productSlug}:${objective}:${language}`;
}

/* --------------------------------- prompts --------------------------------- */

export function adSystemPrompt(): string {
  return [
    "You are the Growth Engineer for TheTanti, an Indian saree webstore where every saree costs a flat ₹199.",
    "You write Meta (Facebook/Instagram) ad copy: one headline, one primary text, one call to action.",
    "Audience: Indian women aged 30-55 and adult children buying budget-friendly gifts.",
    "Tone: homely, warm, respectful. Short spoken-style sentences. No fake urgency, no invented discounts or claims.",
    "Cash on Delivery and daily comfort are the core promises.",
  ].join(" ");
}

export interface AdPromptInput {
  productName: string;
  productCategory: string;
  price: number;
  fabric?: string;
  productUrl: string;
  objective: AdObjective;
  language: AdLanguage;
}

export function adUserPrompt(input: AdPromptInput): string {
  const fabric = input.fabric?.trim() || "soft breathable fabric";
  const objectiveNote: Record<AdObjective, string> = {
    OUTCOME_TRAFFIC: "Optimise the copy for link clicks to the product page.",
    OUTCOME_ENGAGEMENT: "Optimise the copy for likes/comments/shares on the post.",
    OUTCOME_SALES: "Optimise the copy for purchases; mention Cash on Delivery.",
  };
  const langNote: Record<AdLanguage, string> = {
    hinglish:
      "Conversational Hinglish (Hindi words in Latin script mixed with English), e.g. 'aapke', 'roz', 'aaram se'.",
    banglish:
      "Conversational Banglish (Bengali words in Latin script mixed with English), e.g. 'apnar', 'khub', 'sohoj'.",
  };
  return [
    `Saree: ${input.productName}. Category: ${input.productCategory.replace(/-/g, " ")}. Fabric: ${fabric}. Price: ₹${input.price} (flat, never changes).`,
    `Landing page: ${input.productUrl}`,
    `Objective: ${objectiveNote[input.objective]}`,
    `Language style: ${langNote[input.language]}`,
    "headline must be under 40 characters. primaryText under 125 characters (before the link). cta is one short imperative line.",
    "Return ONLY minified JSON with this exact shape (no markdown, no commentary):",
    '{"headline":"under 40 chars","primaryText":"under 125 chars, warm and honest","cta":"one short imperative line","hashtags":["exactly 4 hashtags starting with #"]}',
  ].join("\n");
}

export function parseAdReply(text: string): AdCopyData {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Ad model returned no JSON object");
  const raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;

  const headline = String(raw.headline ?? "").trim();
  const primaryText = String(raw.primaryText ?? "").trim();
  const cta = String(raw.cta ?? "").trim();
  const hashtags = (Array.isArray(raw.hashtags) ? raw.hashtags : [])
    .map((h) => {
      const s = String(h).trim();
      return s ? (s.startsWith("#") ? s : `#${s.replace(/^#+/, "")}`) : "";
    })
    .filter(Boolean)
    .slice(0, 4);

  if (!headline || headline.length > 60) throw new Error("Ad reply: headline missing or too long");
  if (!primaryText || primaryText.length > 220) throw new Error("Ad reply: primary text missing or too long");
  if (!cta) throw new Error("Ad reply: cta missing");
  if (hashtags.length < 2) throw new Error("Ad reply: too few hashtags");

  return { headline, primaryText, cta, hashtags };
}

/** Deterministic template ad copy — used when Ollama is unavailable. */
export function fallbackAdCopy(input: AdPromptInput): AdCopyData {
  if (input.language === "banglish") {
    return {
      headline: `${input.productName} — ₹${input.price}`,
      primaryText: `Soft ${input.fabric?.trim() || "saree"} — khub comfort for daily wear. Cash on Delivery available.`,
      cta: "Order korun",
      hashtags: ["#Saree199", "#TheTanti", "#DailyWearSaree", "#SareeLove"],
    };
  }
  return {
    headline: `${input.productName} — ₹${input.price}`,
    primaryText: `Soft ${input.fabric?.trim() || "saree"} — poore din aaram. Cash on Delivery available all India.`,
    cta: "Order kariye",
    hashtags: ["#Saree199", "#TheTanti", "#DailyWearSaree", "#SareeLove"],
  };
}

/* --------------------------- Meta payload builders --------------------------- */

/**
 * Meta campaign payload. Special-ad-category safe (no credit/employment
 * targeting) and intentionally minimal: one campaign per ad record so
 * activation pauses/isolates exactly one spend surface.
 */
export function buildCampaignParams(name: string, objective: AdObjective): Record<string, string> {
  return { name, objective, status: "PAUSED", special_ad_categories: "[]" };
}

export function buildAdsetParams(opts: {
  name: string;
  campaignId: string;
  dailyBudgetMinor: number;
  country: string;
  ageMin: number;
  ageMax: number;
}): Record<string, string> {
  const targeting = {
    geo_locations: { countries: [opts.country] },
    age_min: opts.ageMin,
    age_max: opts.ageMax,
  };
  return {
    name: opts.name,
    campaign_id: opts.campaignId,
    daily_budget: String(opts.dailyBudgetMinor),
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting: JSON.stringify(targeting),
    status: "PAUSED",
  };
}

/** Single-image ad creative — Meta fetches the public HTTPS URL itself. */
export function buildCreativeParams(
  name: string,
  pageId: string,
  imageUrl: string,
  copy: AdCopyData,
  link: string,
  ctaType: string,
): Record<string, string> {
  const objectStorySpec = {
    page_id: pageId,
    link_data: {
      message: [copy.primaryText, "", copy.cta, "", copy.hashtags.join(" ")].join("\n"),
      link: link,
      picture: imageUrl,
      call_to_action: { type: ctaType, value: { link } },
    },
  };
  return {
    name,
    object_story_spec: JSON.stringify(objectStorySpec),
    degrees_of_freedom_spec: JSON.stringify({ creative_features_spec: { standard_enhancements: { enroll_status: "OPT_OUT" } } }),
  };
}

export function buildAdParams(name: string, adsetId: string, creativeId: string): Record<string, string> {
  return { name, adset_id: adsetId, creative: JSON.stringify({ creative_id: creativeId }), status: "PAUSED" };
}

/** Safe default CTA type per destination. */
export function ctaTypeFor(destination: AdDestination): string {
  return destination === "whatsapp" ? "WHATSAPP_MESSAGE" : "SHOP_NOW";
}

/**
 * TEST MODE guard — Meta calls are simulated and clearly marked.
 * Enable with ADS_TEST_MODE=true (default true so a fresh install can never
 * create campaign objects or spend).
 */
export function isAdsTestMode(): boolean {
  const raw = process.env.ADS_TEST_MODE?.trim().toLowerCase();
  if (raw === undefined || raw === "") return true;
  return raw === "true" || raw === "1";
}
