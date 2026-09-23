/**
 * Deterministic intent rules — pure data + pure functions, unit-testable.
 * Simple requests (shipping cost, track order) must never cost LLM inference.
 */
import type { Intent } from "@/lib/ai/types/chat";
import { formatINR } from "@/lib/format";
import type { ExtractedProductQuery } from "./types";

export interface IntentRule {
  intent: Intent;
  /** Keyword/phrase triggers, lowercase; multi-word = phrase match. */
  patterns: string[];
  /** Rule weight — more specific rules beat generic ones. */
  weight: number;
}

/** Ordered later = lower priority when weights tie (first wins). */
export const INTENT_RULES: IntentRule[] = [
  {
    intent: "ORDER_STATUS",
    weight: 10,
    patterns: [
      "where is my order",
      "order status",
      "track my order",
      "track order",
      "my order",
      "delivery status",
      "when will my order",
      "has my order",
      "order yet",
      "shipment status",
      "kothay order",
      "order kothay",
    ],
  },
  {
    intent: "CART",
    weight: 9,
    patterns: [
      "add to cart",
      "my cart",
      "in cart",
      "checkout",
      "cart items",
      "view cart",
      "remove from cart",
      "buy this",
      "add this",
    ],
  },
  {
    // Seller/vendor/business enquiries — MUST beat PRODUCT_SEARCH's
    // "i want" catch-all, so they sit earlier with a higher weight.
    intent: "CONTACT",
    weight: 10,
    patterns: [
      "become a seller",
      "sell on thetanti",
      "sell with",
      "i am a seller",
      "vendor",
      "supplier",
      "wholesale",
      "bulk order",
      "dropship",
      "collaboration",
      "collab with",
      "partnership",
      "reseller",
    ],
  },
  {
    intent: "PRODUCT_SEARCH",
    weight: 8,
    patterns: [
      "show me",
      "show",
      "looking for",
      "i want",
      "i need",
      "suggest",
      "recommend",
      "any saree",
      "which saree",
      "under",
      "below",
      "less than",
      "cheaper",
      "budget",
      "in stock",
      "available sarees",
      "browse",
    ],
  },
  {
    intent: "PRODUCT_DETAILS",
    weight: 8,
    patterns: [
      "price of",
      "cost of",
      "how much is",
      "tell me about",
      "details of",
      "details for",
      "what is the price",
      "fabric of",
      "about this saree",
      "about that saree",
    ],
  },
  {
    intent: "CATEGORY_SEARCH",
    weight: 7,
    patterns: [
      "categories",
      "category",
      "types of sarees",
      "what kind",
      "collections",
      "silk sarees list",
      "list of",
    ],
  },
  {
    intent: "SHIPPING",
    weight: 10,
    patterns: [
      "shipping",
      "delivery charge",
      "delivery time",
      "how long delivery",
      "shipping cost",
      "shipping fee",
      "courier",
      "when will it arrive",
      "when will it reach",
      "dispatch",
      "shipping free",
    ],
  },
  {
    intent: "RETURNS",
    weight: 9,
    patterns: [
      "return",
      "returns",
      "refund",
      "exchange",
      "money back",
      "send back",
      "damaged",
      "cancel my order",
      "cancellation",
      "replace",
    ],
  },
  {
    intent: "PAYMENTS",
    weight: 9,
    patterns: [
      "payment",
      "pay online",
      "upi",
      "gpay",
      "phonepe",
      "paytm",
      "card accepted",
      "cards accepted",
      "net banking",
      "netbanking",
      "cod",
      "cash on delivery",
      "razorpay",
      "is it safe",
      "secure",
    ],
  },
  {
    intent: "CONTACT",
    weight: 8,
    patterns: [
      "contact",
      "phone number",
      "whatsapp",
      "email",
      "customer care",
      "talk to",
      "speak to",
      "human",
      "call you",
      "grievance",
    ],
  },
  {
    intent: "WEBSITE_NAVIGATION",
    weight: 7,
    patterns: [
      "website",
      "which page",
      "where can i find",
      "where do i find",
      "navigate",
      "take me to",
      "link for",
      "open the",
      "policy page",
      "track page",
    ],
  },
  {
    intent: "FAQ",
    weight: 6,
    patterns: [
      "size",
      "sizes",
      "blouse",
      "offer",
      "coupon",
      "discount",
      "sale",
      "promo code",
      "how to order",
      "how do i order",
      "account",
      "login",
      "sign up",
      "register",
      "quality",
      "wash",
      "care",
    ],
  },
  {
    intent: "GENERAL",
    weight: 3,
    patterns: ["hello", "hi", "hey", "thanks", "thank you", "help", "what can you do"],
  },
];

/** Best matching rule for a query, or null when nothing matches. */
export function matchRules(normalizedQuery: string): { intent: Intent; score: number } | null {
  let best: { intent: Intent; score: number } | null = null;
  for (const rule of INTENT_RULES) {
    for (const pattern of rule.patterns) {
      const hit = pattern.includes(" ")
        ? normalizedQuery.includes(pattern)
        : new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(normalizedQuery);
      if (!hit) continue;
      // Phrases score higher than single words within the same rule.
      const score = rule.weight + (pattern.includes(" ") ? 1 : 0);
      if (!best || score > best.score) best = { intent: rule.intent, score };
    }
  }
  return best;
}

/* ------------------- product filter extraction ------------------- */

const COLOR_WORDS = [
  "red", "maroon", "pink", "blush", "green", "blue", "teal", "yellow", "mustard",
  "black", "white", "cream", "ivory", "beige", "purple", "plum", "orange",
  "rust", "brown", "gold", "golden", "silver", "indigo", "navy",
] as const;

const CATEGORY_WORDS: Record<string, string> = {
  cotton: "cotton-sarees",
  silk: "silk-sarees",
  banarasi: "silk-sarees",
  kanjeevaram: "silk-sarees",
  printed: "printed-sarees",
  floral: "printed-sarees",
  chiffon: "chiffon-sarees",
  georgette: "georgette-sarees",
  fancy: "fancy-sarees",
  party: "fancy-sarees",
  designer: "fancy-sarees",
};

/** "₹1,000", "1000", "rupees 999" → 1000. */
function parseRupeeAmount(raw: string): number | undefined {
  const m = raw.match(/(?:₹|rs\.?|rupees|taka)?\s*([\d][\d,]{0,9})/i);
  if (!m) return undefined;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

/**
 * Extract product filters from natural language.
 * Pure and deterministic: "red sarees under 1500" →
 * { color: "red", maxPrice: 1500, category: undefined, queryLabel: "Red sarees under ₹1,500" }.
 */
export function extractProductFilters(rawQuery: string): ExtractedProductQuery {
  const q = rawQuery.toLowerCase();

  let color: string | undefined;
  for (const c of COLOR_WORDS) {
    if (new RegExp(`\\b${c}\\b`).test(q)) {
      color = c;
      break;
    }
  }

  let category: string | undefined;
  for (const [word, slug] of Object.entries(CATEGORY_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(q)) {
      category = slug;
      break;
    }
  }

  let maxPrice: number | undefined;
  const under = q.match(/\b(?:under|below|less than|upto|up to|max(?:imum)?)\s*(?:₹|rs\.?|rupees)?\s*([\d][\d,]{0,9})/);
  if (under) maxPrice = parseRupeeAmount(under[1]);

  let minPrice: number | undefined;
  const above = q.match(/\b(?:above|over|more than|min(?:imum)?)\s*(?:₹|rs\.?|rupees)?\s*([\d][\d,]{0,9})/);
  if (above) minPrice = parseRupeeAmount(above[1]);

  // Free-text search term: strip command words + known filter phrases.
  const qTerm = rawQuery
    .toLowerCase()
    .replace(/\b(show|me|find|search|looking|for|i|want|need|any|suggest|recommend|please|a|an|the)\b/g, " ")
    .replace(/\b(saree|sarees)\b/g, " ")
    .replace(/\b(under|below|less than|above|over|more than|upto|up to)\s*[\d,]+/g, " ")
    .replace(/\b(₹|rs\.?|rupees)\s*[\d,]+/g, " ")
    .replace(new RegExp(`\\b(${COLOR_WORDS.join("|")})\\b`, "g"), " ")
    .replace(new RegExp(`\\b(${Object.keys(CATEGORY_WORDS).join("|")})\\b`, "g"), " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 3)
    .join(" ");

  const labelBits: string[] = [];
  if (color) labelBits.push(color[0].toUpperCase() + color.slice(1));
  if (category) labelBits.push(category.replace(/-sarees$/, "").replace(/-/g, " "));
  labelBits.push("sarees");
  let queryLabel = labelBits.join(" ");
  if (maxPrice !== undefined) queryLabel += ` under ${formatINR(maxPrice)}`;
  if (minPrice !== undefined) queryLabel += ` above ${formatINR(minPrice)}`;

  return {
    q: qTerm || undefined,
    category,
    color,
    maxPrice,
    minPrice,
    queryLabel,
  };
}
