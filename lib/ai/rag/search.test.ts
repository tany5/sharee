import { describe, expect, it } from "vitest";
import { searchKnowledge } from "./search";
import { buildKnowledgeContext } from "./context";

describe("RAG keyword retrieval", () => {
  it("retrieves shipping chunks for shipping questions", () => {
    const hits = searchKnowledge("how much is shipping?");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].chunk.category).toBe("shipping");
    expect(hits[0].chunk.id).toBe("shipping-charges");
  });

  it("retrieves returns chunks for refund questions", () => {
    const hits = searchKnowledge("how do I return a saree?");
    expect(hits.some((h) => h.chunk.category === "returns")).toBe(true);
  });

  it("retrieves brand overview for 'what is TheTanti'", () => {
    const hits = searchKnowledge("what is TheTanti?");
    expect(hits[0]?.chunk.id).toBe("brand-overview");
  });

  it("retrieves payment chunks for UPI/COD questions", () => {
    expect(searchKnowledge("do you accept UPI?")[0]?.chunk.category).toBe("payments");
    expect(searchKnowledge("is cash on delivery available")[0]?.chunk.id).toBe("shipping-cod");
  });

  it("returns NOTHING for irrelevant questions (no fabricated grounding)", () => {
    expect(searchKnowledge("tell me something about quantum physics")).toEqual([]);
    expect(searchKnowledge("who won the cricket world cup")).toEqual([]);
    expect(searchKnowledge("how do I bake a cake")).toEqual([]);
  });

  it("scopes by category when asked", () => {
    const hits = searchKnowledge("how long does delivery take", { category: "shipping" });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.chunk.category === "shipping")).toBe(true);
  });

  it("context builder formats numbered extracts", () => {
    const hits = searchKnowledge("shipping cost");
    const ctx = buildKnowledgeContext(hits);
    expect(ctx.knowledge).toMatch(/^\[1\]/);
    expect(ctx.sources.length).toBe(hits.length);
    expect(buildKnowledgeContext([]).knowledge).toBe("");
  });
});
