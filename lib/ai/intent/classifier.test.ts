import { describe, expect, it } from "vitest";
import { classifyIntent } from "./classifier";
import { extractProductFilters } from "./rules";

describe("intent classification (deterministic rules)", () => {
  it("routes shipping questions to SHIPPING", () => {
    expect(classifyIntent("shipping price").intent).toBe("SHIPPING");
    expect(classifyIntent("how much is delivery charge?").intent).toBe("SHIPPING");
  });

  it("routes return questions to RETURNS", () => {
    expect(classifyIntent("how do I return?").intent).toBe("RETURNS");
    expect(classifyIntent("when will I get my refund").intent).toBe("RETURNS");
  });

  it("routes product searches to PRODUCT_SEARCH", () => {
    expect(classifyIntent("red saree under 1000").intent).toBe("PRODUCT_SEARCH");
    expect(classifyIntent("show cotton sarees").intent).toBe("PRODUCT_SEARCH");
    expect(classifyIntent("I want a silk saree for a wedding").intent).toBe("PRODUCT_SEARCH");
  });

  it("routes order questions to ORDER_STATUS", () => {
    expect(classifyIntent("where is my order?").intent).toBe("ORDER_STATUS");
    expect(classifyIntent("track my order TT123").intent).toBe("ORDER_STATUS");
  });

  it("routes payments, contact and cart intents", () => {
    expect(classifyIntent("is UPI accepted?").intent).toBe("PAYMENTS");
    expect(classifyIntent("cash on delivery available").intent).toBe("PAYMENTS");
    expect(classifyIntent("how can I contact support").intent).toBe("CONTACT");
    expect(classifyIntent("add this saree to my cart").intent).toBe("CART");
  });

  it("treats unrelated questions as UNKNOWN", () => {
    expect(classifyIntent("tell me something about quantum physics").intent).toBe("UNKNOWN");
  });
});

describe("product filter extraction", () => {
  it("extracts color and max price", () => {
    const f = extractProductFilters("show me red sarees under 1500");
    expect(f.color).toBe("red");
    expect(f.maxPrice).toBe(1500);
    expect(f.queryLabel).toContain("Red");
    expect(f.queryLabel).toContain("₹1,500");
  });

  it("extracts category and handles ₹ formatting", () => {
    const f = extractProductFilters("cotton sarees under ₹999");
    expect(f.category).toBe("cotton-sarees");
    expect(f.maxPrice).toBe(999);
  });

  it("maps fancy/party wording to the fancy category", () => {
    const f = extractProductFilters("party wear saree for wedding");
    expect(f.category).toBe("fancy-sarees");
  });

  it("extracts min price", () => {
    const f = extractProductFilters("silk sarees above 500");
    expect(f.category).toBe("silk-sarees");
    expect(f.minPrice).toBe(500);
  });
});
