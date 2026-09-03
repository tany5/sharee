import { describe, expect, it } from "vitest";
import {
  addItemToCart,
  cartCount,
  lineKey,
  MAX_QTY_PER_ITEM,
  removeItem,
  setItemQty,
  shippingFor,
  summarizeCart,
  totalsFor,
} from "@/lib/cart";
import type { CartItem } from "@/lib/types";

const base: CartItem = { slug: "a", qty: 1, color: "Maroon" };

describe("cart line operations", () => {
  it("adds a new line", () => {
    expect(addItemToCart([], base)).toEqual([base]);
  });

  it("merges into an existing line with the same slug+colour", () => {
    const next = addItemToCart([base], { slug: "a", qty: 2, color: "Maroon" });
    expect(next).toEqual([{ ...base, qty: 3 }]);
    expect(next).toHaveLength(1);
  });

  it("keeps same product with different colour as separate lines", () => {
    const next = addItemToCart([base], { slug: "a", qty: 1, color: "Teal" });
    expect(next).toHaveLength(2);
  });

  it("caps quantity at the per-item maximum", () => {
    const next = addItemToCart([], { slug: "a", qty: 9, color: "Maroon" });
    expect(next[0].qty).toBe(MAX_QTY_PER_ITEM);
    const merged = addItemToCart([{ ...base, qty: 4 }], {
      slug: "a",
      qty: 2,
      color: "Maroon",
    });
    expect(merged[0].qty).toBe(MAX_QTY_PER_ITEM);
  });

  it("setItemQty clamps and can remove when qty <= 0", () => {
    expect(setItemQty([base], "a", "Maroon", 0)).toEqual([]);
    expect(setItemQty([base], "a", "Maroon", 99)[0].qty).toBe(MAX_QTY_PER_ITEM);
  });

  it("removeItem only removes the matching line", () => {
    const two = addItemToCart([base], { slug: "b", qty: 1, color: "Green" });
    const removed = removeItem(two, "a", "Maroon");
    expect(removed).toHaveLength(1);
    expect(removed[0].slug).toBe("b");
  });

  it("counts total units, not lines", () => {
    expect(cartCount([{ slug: "a", qty: 2, color: "Maroon" }, { slug: "b", qty: 3, color: "Green" }])).toBe(5);
  });

  it("lineKey distinguishes colour variants", () => {
    expect(lineKey("a", "Maroon")).not.toBe(lineKey("a", "Teal"));
  });
});

describe("shipping + totals (rule: free at/above ₹999)", () => {
  it("charges the flat fee below the threshold", () => {
    expect(shippingFor(0)).toBe(49);
    expect(shippingFor(199)).toBe(49);
    expect(shippingFor(998)).toBe(49);
  });

  it("is free at and above the threshold", () => {
    expect(shippingFor(999)).toBe(0);
    expect(shippingFor(1194)).toBe(0);
  });

  it("totalsFor adds shipping correctly", () => {
    expect(totalsFor(199)).toEqual({ subtotal: 199, shipping: 49, total: 248 });
    expect(totalsFor(1194)).toEqual({ subtotal: 1194, shipping: 0, total: 1194 });
  });
});

describe("summarizeCart", () => {
  // `priceOf` receives the full line so callers may prefer the snapshot price.
  const priceOf = (line: CartItem) => (line.slug === "a" ? 199 : 299);

  it("computes lines, subtotal and shipping", () => {
    const s = summarizeCart(
      [
        { slug: "a", qty: 2, color: "Maroon" },
        { slug: "b", qty: 1, color: "Green" },
      ],
      priceOf,
    );
    expect(s.subtotal).toBe(697);
    expect(s.shipping).toBe(49);
    expect(s.total).toBe(746);
    expect(s.lines.map((l) => l.total)).toEqual([398, 299]);
  });

  it("charges shipping below ₹999 even for larger baskets", () => {
    const s = summarizeCart([{ slug: "a", qty: 5, color: "Maroon" }], priceOf);
    expect(s.subtotal).toBe(995); // 5 × 199 — still below the threshold
    expect(s.total).toBe(995 + 49);
  });

  it("applies free shipping at/above ₹999", () => {
    const s = summarizeCart([{ slug: "a", qty: 6, color: "Maroon" }], priceOf);
    expect(s.subtotal).toBe(1194);
    expect(s.shipping).toBe(0);
    expect(s.total).toBe(1194);
  });
});
