import { describe, expect, it } from "vitest";
import { validateProductSearchInput } from "./product-search";
import { parseCartRequest } from "./cart";

describe("product search tool validation (never trust tool args)", () => {
  it("accepts valid filters", () => {
    const v = validateProductSearchInput({ q: "banarasi", category: "silk-sarees", color: "red", maxPrice: 1000, limit: 4 });
    expect(v.q).toBe("banarasi");
    expect(v.category).toBe("silk-sarees");
    expect(v.maxPrice).toBe(1000);
  });

  it("rejects unknown category slugs (never guesses)", () => {
    const v = validateProductSearchInput({ category: "../../../etc/passwd" });
    expect(v.category).toBeUndefined();
  });

  it("rejects non-numeric prices like 'hello'", () => {
    const v = validateProductSearchInput({ maxPrice: "hello" });
    expect(v.maxPrice).toBeUndefined();
  });

  it("clamps and rounds price/limit values", () => {
    const v = validateProductSearchInput({ maxPrice: 1000.7, limit: 999 });
    expect(v.maxPrice).toBe(1001);
    expect(v.limit).toBe(8); // MAX_LIMIT
  });

  it("rejects inverted price ranges", () => {
    expect(() => validateProductSearchInput({ minPrice: 500, maxPrice: 100 })).toThrow();
  });

  it("truncates over-long free text", () => {
    const v = validateProductSearchInput({ q: "a".repeat(500) });
    expect(v.q?.length).toBe(60);
  });

  it("throws on non-object input", () => {
    expect(() => validateProductSearchInput("red sarees")).toThrow();
    expect(() => validateProductSearchInput(null)).toThrow();
  });
});

describe("cart tool", () => {
  it("accepts a known slug", () => {
    expect(parseCartRequest("banarasi-silk-saree", ["banarasi-silk-saree"])).toEqual({
      ok: true,
      slug: "banarasi-silk-saree",
    });
  });

  it("rejects unknown products instead of inventing an add", () => {
    const r = parseCartRequest("totally-made-up-thing", ["banarasi-silk-saree"]);
    expect(r.ok).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(parseCartRequest(42).ok).toBe(false);
  });
});
