/**
 * Promo poster PLANNER — Ollama (qwen2.5:7b, local) decides captions/metadata.
 * When Puter is configured, Puter creates the full square ad creative;
 * otherwise the renderer (poster-image.ts) produces a local fallback poster.
 *
 * HARD RULES (owner spec):
 *   - Ollama NEVER generates the image and NEVER renders text.
 *   - Price/offer/CTA come from the CAMPAIGN constants below — never from the
 *     model — so ₹199 can never be misspelled or wrong.
 *   - Selling points must come from the approved pool (no invented claims).
 *   - Palettes must be one of the fixed brand palettes.
 *   - If Ollama is down or returns junk, fallbackPromoPlan() keeps the flow
 *     deterministic and safe.
 */
import "server-only";
import { ollamaEnabled, ollamaJson } from "@/lib/marketing/ollama";

/** Campaign constants — the ONLY source for offer text (Rule 16). */
export const PROMO_CAMPAIGN = {
  brand: "TheTanti",
  tagline: "Sarees for real life",
  offer: "OUR SAREE",
  price: 199,
  currency: "₹",
  priceLabel: "FLAT",
  cta: "SHOP NOW",
} as const;

/** Approved selling-point pool — nothing outside this may be rendered. */
export const PROMO_POINTS_POOL = [
  "Beautiful Designs",
  "Everyday Styles",
  "Budget Friendly",
  "Sarees for Every Occasion",
  "New Arrivals",
  "Easy Cash on Delivery",
  "Shipping Included",
] as const;

export const PROMO_PALETTES = [
  "BRIGHT_POP",
  "ROYAL_GOLD",
  "PINK_MAGENTA",
  "YELLOW_RED",
  "BLUE_GOLD",
  "FESTIVE",
] as const;

export type PromoPalette = (typeof PROMO_PALETTES)[number];

/** The poster kind supported by the renderer (spec: start with ONE). */
export const PROMO_TYPE = "bright_promo";

export interface PromoPlan {
  creativeType: typeof PROMO_TYPE;
  palette: PromoPalette;
  /** 2–4 selling points, all verified members of PROMO_POINTS_POOL. */
  sellingPoints: string[];
  /** Prompt for the AI BACKGROUND only (no text, no model face). */
  backgroundPrompt: string;
  /** Where the model/hero sits — right like the reference, or left. */
  heroSide: "left" | "right";
  caption: string;
  hashtags: string[];
  engine: string;
}

const POINT_SET = new Set<string>(PROMO_POINTS_POOL);

function okPalette(v: unknown): v is PromoPalette {
  return typeof v === "string" && (PROMO_PALETTES as readonly string[]).includes(v);
}

function cleanPoints(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  for (const item of list) {
    const s = String(item ?? "").trim();
    if (s && POINT_SET.has(s) && !out.includes(s)) out.push(s);
    if (out.length >= 4) break;
  }
  return out;
}

function cleanHashtags(raw: unknown, max: number): string[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  for (const item of list) {
    let s = String(item ?? "").trim();
    if (!s) continue;
    if (!s.startsWith("#")) s = `#${s.replace(/^#+/, "")}`;
    s = s.replace(/[^#A-Za-z0-9_]/g, "");
    if (s.length > 2 && !out.includes(s)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/** System + user prompts for the planner call. */
export function promoPlannerSystem(): string {
  return [
    `You are the creative director for ${PROMO_CAMPAIGN.brand}, an Indian saree webstore.`,
    `The campaign offer is fixed: ${PROMO_CAMPAIGN.offer} ${PROMO_CAMPAIGN.currency}${PROMO_CAMPAIGN.price} ${PROMO_CAMPAIGN.priceLabel}.`,
    "You ONLY plan the visual concept and captions. You never render images or text.",
    "Return ONLY minified JSON, no markdown, no commentary.",
  ].join(" ");
}

export function promoPlannerUser(input: {
  productName: string;
  category: string;
  fabric?: string;
  heroKind: string;
}): string {
  return [
    `Product: ${input.productName}. Category: ${input.category.replace(/-/g, " ")}.${input.fabric ? ` Fabric: ${input.fabric}.` : ""}`,
    `Hero image: ${input.heroKind} (already generated — do not plan to regenerate it).`,
    "Plan one bright, high-contrast Indian ecommerce promo.",
    "When a full AI image provider is available, it will decide the model, saree styling, background and layout.",
    "When the local fallback renderer is used, background must be a simple vibrant gradient/studio scene that never competes with the saree.",
    "Pick selling_points ONLY from this pool: " + PROMO_POINTS_POOL.join(" | ") + ".",
    "Pick palette ONLY from: " + PROMO_PALETTES.join(" | ") + ".",
    "Return ONLY minified JSON with this exact shape:",
    '{"palette":"BRIGHT_POP","selling_points":["2-4 from the pool"],"background_prompt":"one short comma-separated SD prompt for the background only, no people, no text","hero_side":"right|left","caption":"warm 2-3 sentence Instagram/Facebook caption in conversational Hinglish, honest, no invented offers","hashtags":["6 niche hashtags starting with #"]}',
  ].join("\n");
}

/** Validate + repair a planner reply. Throws on unusable output. */
export function parsePromoPlan(text: string): Omit<PromoPlan, "engine"> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Planner returned no JSON object");
  const raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;

  if (!okPalette(raw.palette)) throw new Error("Planner: palette missing or not allowed");
  const sellingPoints = cleanPoints(raw.selling_points);
  if (sellingPoints.length < 2) throw new Error("Planner: fewer than 2 approved selling points");
  const caption = String(raw.caption ?? "").trim();
  if (caption.length < 20) throw new Error("Planner: caption too short");
  const hashtags = cleanHashtags(raw.hashtags, 6);
  if (hashtags.length < 4) throw new Error("Planner: too few usable hashtags");

  const bgRaw = String(raw.background_prompt ?? "").trim();
  // Strip anything that smells like text/model requests — the renderer owns text.
  const backgroundPrompt = bgRaw
    .replace(/text|words|letters|typography|price|₹|rs\.?|rupees|numbers/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/(,\s*){2,}/g, ", ")
    .trim();
  if (backgroundPrompt.length < 10) throw new Error("Planner: background_prompt unusable");

  const heroSide = String(raw.hero_side ?? "right").toLowerCase() === "left" ? "left" : "right";

  return {
    creativeType: PROMO_TYPE,
    palette: raw.palette,
    sellingPoints,
    backgroundPrompt,
    heroSide,
    caption,
    hashtags,
  };
}

/** Deterministic plan — used when Ollama is off/unreachable/junk. */
export function fallbackPromoPlan(productName: string): Omit<PromoPlan, "engine"> {
  return {
    creativeType: PROMO_TYPE,
    palette: "BRIGHT_POP",
    sellingPoints: ["Shipping Included", "Beautiful Designs", "Everyday Styles"],
    backgroundPrompt:
      "vibrant marigold yellow studio backdrop, soft warm gradient, subtle magenta light glow, clean ecommerce advertising background, bright even lighting, no people, no text",
    heroSide: "right",
    caption: `${productName} — sirf ₹199 mein! Roz ke liye comfortable, poore din aaram. Order kariye aaj hi.`,
    hashtags: ["#TheTanti", "#Saree199", "#DailyWearSaree", "#SareeLove", "#BudgetFashion", "#SareeStyle"],
  };
}

/**
 * Plan via local Ollama; falls back to the deterministic plan on ANY failure.
 * Never throws.
 */
export async function planPromo(input: {
  productName: string;
  category: string;
  fabric?: string;
  heroKind: string;
}): Promise<PromoPlan> {
  if (ollamaEnabled()) {
    try {
      const text = await ollamaJson({
        system: promoPlannerSystem(),
        prompt: promoPlannerUser(input),
        temperature: 0.85,
        numPredict: 480,
      });
      return { ...parsePromoPlan(text), engine: `ollama:${process.env.OLLAMA_TEXT_MODEL?.trim() || "qwen2.5:7b"}` };
    } catch (err) {
      console.warn("[promo] planner failed, using deterministic plan:", (err as Error).message);
    }
  }
  return { ...fallbackPromoPlan(input.productName), engine: "plan-fallback" };
}
