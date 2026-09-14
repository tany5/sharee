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

export interface PromoCaptionInput {
  productName: string;
  category: string;
  fabric?: string;
  price: number;
  productUrl: string;
  seed?: number;
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
    "Caption must be Banglish only: Bengali words in Latin script mixed with simple English. Do not use Hinglish words like sirf, kariye, aapke, roz, aaram. Do not use emoji/icons.",
    "Caption should be friendly, simple and SEO optimized with natural keywords like Bengali saree, daily wear saree, budget saree, festive saree, cotton/silk if provided.",
    "Return ONLY minified JSON with this exact shape:",
    '{"palette":"BRIGHT_POP","selling_points":["2-4 from the pool"],"background_prompt":"one short comma-separated SD prompt for the background only, no people, no text","hero_side":"right|left","caption":"warm 2-3 sentence Instagram/Facebook caption in conversational Banglish, simple SEO keywords, honest, no invented offers, no emoji","hashtags":["6 niche hashtags starting with #"]}',
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
    caption: `${productName} apnar everyday look er jonno simple, sundor choice. Daily wear saree hishebe halka feel, easy drape, aar budget-friendly style.`,
    hashtags: ["#TheTanti", "#Saree199", "#DailyWearSaree", "#SareeLove", "#BudgetFashion", "#SareeStyle"],
  };
}

function titleCaseWords(value: string): string {
  return value
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function pickBySeed<T>(items: readonly T[], seed: number, step: number): T {
  return items[Math.abs(Math.trunc(seed * step + step)) % items.length] ?? items[0];
}

export function buildPromoBanglishCaption(input: PromoCaptionInput): {
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
} {
  const seed = input.seed ?? Date.now();
  const category = titleCaseWords(input.category || "saree");
  const fabric = input.fabric?.trim();
  const fabricText = fabric ? `${fabric} feel` : "soft fabric feel";
  const hook = pickBySeed(
    [
      `${input.productName} at flat ₹${input.price}`,
      `Bengali saree style, simple price ₹${input.price}`,
      `Daily wear saree for only ₹${input.price}`,
      `Pujo theke daily wear, one saree ₹${input.price}`,
      `Budget-friendly saree look at ₹${input.price}`,
      `Apnar notun saree pick at ₹${input.price}`,
    ],
    seed,
    3,
  );
  const body = pickBySeed(
    [
      `${input.productName} niye asun apnar wardrobe e ekta fresh Bengali saree look. ${fabricText}, easy drape, daily wear saree hishebe khub practical.`,
      `Simple, sundor, aar pocket-friendly. Ei ${category.toLowerCase()} design ta office, bari ba chhoto occasion er jonno bhalo lage.`,
      `Apnar everyday styling er jonno ekta neat saree choice. Rich colour mood, clean border detail, aar comfortable drape mile ekdom ready-to-wear feel.`,
      `Bengali aesthetics er sathe modern comfort. Ei saree ta daily wear, festive visit, ba family get-together er jonno easy pick.`,
      `${input.productName} holo budget saree lovers der jonno smart option. Dekhte elegant, porte sohoj, aar flat ₹${input.price} price ta clear.`,
      `Soft look, graceful drape, aar simple styling. Apni jodi affordable Bengali saree online khujchen, eta ekta bhalo pick.`,
    ],
    seed,
    5,
  );
  const cta = pickBySeed(
    [
      `Dekhun ekhane: ${input.productUrl}`,
      `Apnar saree ekhane dekhun: ${input.productUrl}`,
      `Order korte visit korun: ${input.productUrl}`,
      `Full details ekhane: ${input.productUrl}`,
    ],
    seed,
    7,
  );
  const hashtags = [
    "#TheTanti",
    "#BengaliSaree",
    "#DailyWearSaree",
    "#Saree199",
    "#BudgetSaree",
    category.toLowerCase().includes("silk") ? "#SilkSaree" : "#SareeOnline",
  ];
  return { hook, body, cta, hashtags };
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
