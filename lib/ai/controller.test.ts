import { describe, expect, it, vi } from "vitest";
import { handleQuestion } from "./controller";
import type { ControllerDeps } from "./controller";

function deps(overrides: Partial<ControllerDeps> = {}): ControllerDeps {
  return {
    modelReady: false,
    isAuthenticated: false,
    knownProductSlugs: [],
    ...overrides,
  };
}

describe("chat controller", () => {
  it("REFUSES order lookups for unauthenticated users (security)", async () => {
    const result = await handleQuestion("where is my order?", deps({ isAuthenticated: false }));
    expect(result.turn.intent).toBe("ORDER_STATUS");
    expect(result.turn.text).toContain("not signed in");
    expect(result.turn.blocks?.some((b) => b.kind === "order-status")).toBe(false);
  });

  it("returns product cards from the tool for product searches", async () => {
    const fakeProducts = [
      {
        slug: "red-silk-saree",
        name: "Red Silk Saree",
        category: "silk-sarees",
        colorway: "Red",
        price: 199,
        rating: 4.5,
        reviewCount: 12,
        tags: [],
      },
    ];
    // Stub the network boundary the same way the UI would fetch it.
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, items: fakeProducts }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await handleQuestion("show me red sarees under 999", deps());
    const card = result.turn.blocks?.find((b) => b.kind === "product-cards");
    expect(card).toBeDefined();
    if (card?.kind === "product-cards") {
      expect(card.products[0].slug).toBe("red-silk-saree");
      expect(card.products[0].price).toBe(199); // server truth, not invented
      expect(card.queryLabel).toContain("Red");
    }
    vi.unstubAllGlobals();
  });

  it("answers shipping questions from knowledge without a model", async () => {
    const result = await handleQuestion("how much is shipping?", deps());
    expect(result.turn.intent).toBe("SHIPPING");
    expect(result.turn.text.toLowerCase()).toContain("free");
    expect(result.turn.sources.length).toBeGreaterThan(0);
  });

  it("answers brand questions from knowledge without a model", async () => {
    const result = await handleQuestion("what is TheTanti?", deps());
    expect(result.turn.text).toContain("₹199");
  });

  it("does NOT answer off-topic questions with invented knowledge", async () => {
    const result = await handleQuestion("tell me something about quantum physics", deps());
    expect(result.turn.text).toContain("TheTanti");
    expect(result.turn.text.toLowerCase()).not.toContain("quantum");
  });

  it("uses the LLM when ready and streams through onToken", async () => {
    const seenTokens: string[] = [];
    const result = await handleQuestion(
      "what is your return policy?",
      deps({
        modelReady: true,
        generate: async (_prompt, onToken) => {
          onToken("You");
          onToken(" have");
          seenTokens.push("streamed");
          return "You have 7 days to return, free pickup.";
        },
      }),
      (t) => seenTokens.push(t),
    );
    expect(seenTokens).toContain("You");
    expect(seenTokens).toContain("streamed");
    expect(result.turn.text).toContain("7 days");
    expect(result.turn.origin).toBe("local");
  });

  it("falls back to deterministic knowledge when the LLM errors", async () => {
    const result = await handleQuestion(
      "what is your return policy?",
      deps({
        modelReady: true,
        generate: async () => {
          throw new Error("worker crashed");
        },
      }),
    );
    expect(result.turn.text.toLowerCase()).toContain("7-day");
  });
});
