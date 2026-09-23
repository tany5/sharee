/**
 * Chat controller — orchestrates one user turn:
 *
 *   question → intent → [tool calls] → knowledge retrieval → context
 *            → local LLM (streamed) OR deterministic fallback reply
 *
 * Pure dependency-injected functions so the UI hook stays thin and the whole
 * routing logic is unit-testable without a browser.
 */
import { classifyIntent } from "@/lib/ai/intent/classifier";
import { extractProductFilters } from "@/lib/ai/intent/rules";
import { searchKnowledge, type SearchOptions } from "@/lib/ai/rag/search";
import {
  buildKnowledgeContext,
  describeOrderStatus,
  describeProducts,
} from "@/lib/ai/rag/context";
import { SYSTEM_PROMPT } from "@/lib/ai/prompts/system";
import { runProductSearch, validateProductSearchInput } from "@/lib/ai/tools/product-search";
import { runOrderStatus } from "@/lib/ai/tools/order-status";
import type {
  ChatProduct,
  Intent,
  MessageBlock,
} from "@/lib/ai/types/chat";

export interface ControllerDeps {
  /** Runs the local LLM. Absent/failed → deterministic fallback answers. */
  generate?: (prompt: string, onToken: (t: string) => void) => Promise<string>;
  /** Signals the local model is loaded and usable. */
  modelReady: boolean;
  /** The signed-in customer (from AuthProvider) — order tool guard. */
  isAuthenticated: boolean;
  /** Product slugs already surfaced in this chat (for cart parsing). */
  knownProductSlugs: string[];
}

export interface AssistantTurn {
  /** Final text shown in the bubble. */
  text: string;
  blocks?: MessageBlock[];
  /** "local" = on-device answer (knowledge/LLM); "live" = used website APIs. */
  origin: "local" | "live";
  /** Knowledge chunk titles used (UI transparency badge). */
  sources: string[];
  intent: Intent;
}

/* ------------------------------ helpers -------------------------------- */

function productsToBlocks(products: ChatProduct[], queryLabel: string): MessageBlock[] {
  return products.length > 0
    ? [{ kind: "product-cards", products, queryLabel }]
    : [];
}

const NAV_LINKS: Record<string, { label: string; href: string }[]> = {
  SHIPPING: [{ label: "Shipping policy", href: "/shipping-policy" }],
  RETURNS: [{ label: "Return policy", href: "/return-policy" }],
  PAYMENTS: [{ label: "Payment options", href: "/terms-and-conditions" }],
  CONTACT: [{ label: "Contact us", href: "/contact" }],
  ORDER_STATUS: [{ label: "Track an order", href: "/track" }],
  WEBSITE_NAVIGATION: [
    { label: "All sarees", href: "/sarees" },
    { label: "Categories", href: "/categories" },
    { label: "My account", href: "/account" },
  ],
  CART: [{ label: "Go to cart", href: "/cart" }],
};

/** Knowledge categories per intent — retrieval scoping. */
const INTENT_KNOWLEDGE: Partial<Record<Intent, string>> = {
  SHIPPING: "shipping",
  RETURNS: "returns",
  PAYMENTS: "payments",
  CONTACT: "contact",
  FAQ: "faq",
  ORDER_STATUS: "orders",
  GENERAL: "brand",
  WEBSITE_NAVIGATION: "website",
};

/* ------------------------------ controller ------------------------------ */

export interface HandleQuestionResult {
  turn: AssistantTurn;
  /** Slugs surfaced by this turn (the UI adds them to knownProductSlugs). */
  productSlugs: string[];
}

export async function handleQuestion(
  question: string,
  deps: ControllerDeps,
  onToken?: (t: string) => void,
): Promise<HandleQuestionResult> {
  const { intent } = classifyIntent(question);
  const blocks: MessageBlock[] = [];
  const slugs: string[] = [];
  let context = "";
  const sources: string[] = [];

  /* 1. Tool phase — fetch real data BEFORE any prompt is built. */
  let products: ChatProduct[] = [];
  let queryLabel = "";
  let orderSummary: string | null = null;

  if (intent === "PRODUCT_SEARCH" || intent === "CATEGORY_SEARCH" || intent === "PRODUCT_DETAILS") {
    const filters = extractProductFilters(question);
    queryLabel = filters.queryLabel;
    try {
      const validated = validateProductSearchInput(filters);
      products = await runProductSearch(validated);
      slugs.push(...products.map((p) => p.slug));
      blocks.push(...productsToBlocks(products, queryLabel));
    } catch {
      // Tool failure must not break the turn — knowledge may still answer.
      products = [];
    }
  }

  if (intent === "ORDER_STATUS") {
    if (!deps.isAuthenticated) {
      // Never leak order data to unauthenticated users.
      return {
        turn: {
          text:
            "You're not signed in, so I can't see your orders. Sign in at /account to view them, " +
            "or track any order at /track using your order number and the phone you ordered with.",
          blocks: NAV_LINKS.ORDER_STATUS ? [{ kind: "links", links: NAV_LINKS.ORDER_STATUS }] : [],
          origin: "live",
          sources: [],
          intent,
        },
        productSlugs: [],
      };
    }
    const result = await runOrderStatus();
    if (result.ok && result.orders.length > 0) {
      const latest = result.orders[0];
      blocks.push({
        kind: "order-status",
        order: {
          ...latest,
          tracking: latest.tracking ?? null,
        },
      });
      orderSummary = describeOrderStatus({
        ...latest,
        tracking: latest.tracking ?? null,
      });
    } else if (result.ok) {
      orderSummary =
        "You have no orders on your account yet. Explore sarees at /sarees — everything is ₹199 with free shipping!";
    } else {
      orderSummary = result.message;
    }
  }

  /* 2. Knowledge retrieval — always, for grounding. Scoping to the intent's
        category keeps answers tight, but a scoped miss falls back to the full
        base so cross-category chunks (e.g. seller enquiries living under
        "faq") are still found. */
  const category = INTENT_KNOWLEDGE[intent];
  let scored = searchKnowledge(
    question,
    category ? { category: category as SearchOptions["category"] } : {},
  );
  if (scored.length === 0 && category) {
    scored = searchKnowledge(question);
  }
  const built = buildKnowledgeContext(scored);
  if (built.knowledge) {
    context += (context ? "\n" : "") + `KNOWLEDGE:\n${built.knowledge}`;
    sources.push(...built.sources);
  }
  if (products.length > 0) {
    context += (context ? "\n\n" : "") + `PRODUCT RESULTS:\n${describeProducts(products, queryLabel)}`;
  } else if (intent === "PRODUCT_SEARCH") {
    context +=
      (context ? "\n\n" : "") +
      `PRODUCT RESULTS:\n${describeProducts([], queryLabel)}`;
  }
  if (orderSummary) {
    context += (context ? "\n\n" : "") + `ORDER:\n${orderSummary}`;
  }

  /* 3. Answer phase — local LLM with context, or deterministic fallback. */
  if (deps.modelReady && deps.generate && context) {
    const prompt = `${SYSTEM_PROMPT}\n\n=== CONTEXT (the only facts you may use) ===\n${context}\n=== END CONTEXT ===\n\nCustomer question: ${question}\n\nYour answer (plain sentences, never repeat context labels like "KNOWLEDGE:" or "PRODUCT RESULTS:"):`;
    try {
      const text = await deps.generate(prompt, (t) => onToken?.(t));
      if (text.trim().length > 0) {
        return { turn: { text: text.trim(), blocks, origin: "local", sources, intent }, productSlugs: slugs };
      }
    } catch {
      /* fall through to deterministic reply */
    }
  }

  /* 4. Deterministic fallback — compose a HUMAN answer from parts,
        never dump raw context (labels like "PRODUCT RESULTS:" must not
        reach the customer, model or no model). */
  const knowledgeOnly = built.knowledge.replace(/\[\d+\] [^:]+: /g, "");
  const parts: string[] = [];
  if (orderSummary) parts.push(orderSummary);
  if (knowledgeOnly) parts.push(knowledgeOnly);
  if (products.length > 0) {
    parts.push(
      `Here ${products.length === 1 ? "is" : "are"} ${products.length} match${products.length === 1 ? "" : "es"} from the catalogue 👇`,
    );
  }

  let text: string;
  if (parts.length > 0) {
    text = parts.join("\n\n");
  } else if (intent === "PRODUCT_SEARCH" && queryLabel) {
    text = `I couldn't find sarees matching "${queryLabel}" right now. Try a broader search — every saree is ₹199 with free shipping!`;
  } else if (intent === "CART") {
    text =
      "Open any saree and tap the cart button to add it, or view your cart at /cart. I can help you find sarees too!";
  } else if (intent === "GENERAL") {
    text =
      "Hi! I can help you find sarees, check shipping and returns, or track your order. What are you looking for?";
  } else {
    text =
      "I'm here mainly to help with TheTanti products, orders, shipping and shopping. " +
      "Ask me about sarees, prices, delivery or your order!";
  }

  if (NAV_LINKS[intent] && intent !== "ORDER_STATUS") {
    blocks.push({ kind: "links", links: NAV_LINKS[intent] });
  }

  return {
    turn: { text, blocks, origin: sources.length > 0 || products.length > 0 ? "live" : "local", sources, intent },
    productSlugs: slugs,
  };
}
