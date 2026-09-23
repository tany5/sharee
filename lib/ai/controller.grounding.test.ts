import { describe, expect, it } from "vitest";
import { classifyIntent } from "@/lib/ai/intent/classifier";
import { handleQuestion } from "@/lib/ai/controller";

/**
 * Regression tests for the "prompt leakage / duplicate greeting" incident:
 * internal context labels must never reach the customer, business enquiries
 * like "become a seller" must route to knowledge (not product search), and
 * empty product searches produce a customer-phrased reply.
 */

function stubFetch(items: unknown[] = []) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ ok: true, items }), { status: 200 })) as typeof fetch;
}

function noDeps() {
  return { modelReady: false, isAuthenticated: false, knownProductSlugs: [] };
}

/** Internal labels that must NEVER appear in a customer-visible answer. */
const LEAK_PATTERNS = [/KNOWLEDGE:/, /PRODUCT RESULTS:/, /ORDER:/, /Tell the customer/, /\[\d+\] [^:]+: /];

describe("no internal prompt leakage in deterministic answers", () => {
  const questions = [
    "how much is shipping?",
    "what is your return policy?",
    "do you accept UPI?",
    "I want to become a seller",
    "what is TheTanti?",
    "show me sarees",
    "how can I contact support",
    "where can I find the track page",
    "hi",
  ];

  for (const q of questions) {
    it(`clean answer for: "${q}"`, async () => {
      stubFetch();
      const r = await handleQuestion(q, noDeps());
      for (const pattern of LEAK_PATTERNS) {
        expect(r.turn.text).not.toMatch(pattern);
      }
    });
  }
});

describe("business enquiries route to knowledge, not product search", () => {
  it("classifies seller/vendor/bulk questions as CONTACT", () => {
    expect(classifyIntent("I want to become a seller").intent).toBe("CONTACT");
    expect(classifyIntent("do you do wholesale").intent).toBe("CONTACT");
    expect(classifyIntent("bulk order for a wedding").intent).toBe("CONTACT");
  });

  it("seller enquiry answers with the single-brand policy + contact", async () => {
    stubFetch();
    const r = await handleQuestion("I want to become a seller", noDeps());
    expect(r.turn.intent).toBe("CONTACT");
    expect(r.turn.text).toMatch(/single-brand|thetanti\.com|WhatsApp/i);
  });
});

describe("empty product search stays honest and phrased for humans", () => {
  it("no-match reply suggests broadening, never leaks tool text", async () => {
    stubFetch([]);
    const r = await handleQuestion("show me sarees", noDeps());
    expect(r.turn.text).toMatch(/couldn't find/i);
    expect(r.turn.text).toContain("₹199");
    expect(r.turn.text).not.toContain("Tell the customer");
  });

  it("matched products introduce the cards in natural language", async () => {
    stubFetch([
      {
        slug: "blue-saree",
        name: "Blue Saree",
        category: "silk-sarees",
        colorway: "Blue",
        price: 199,
        rating: 4.5,
        reviewCount: 8,
        tags: [],
      },
    ]);
    const r = await handleQuestion("show me blue sarees", noDeps());
    expect(r.turn.text).toMatch(/match/i);
    const cards = r.turn.blocks?.find((b) => b.kind === "product-cards");
    expect(cards).toBeDefined();
  });
});

describe("GENERAL replies consult brand knowledge", () => {
  it("plain 'hi' gets a helpful, non-empty answer without labels", async () => {
    const r = await handleQuestion("hi", noDeps());
    expect(r.turn.text.length).toBeGreaterThan(0);
    expect(r.turn.text).not.toMatch(/KNOWLEDGE:|PRODUCT RESULTS:/);
  });
});
