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

describe("shipping + totals (rule: shipping is always free)", () => {
  it("is free for every cart value — no threshold", () => {
    expect(shippingFor(0)).toBe(0);
    expect(shippingFor(199)).toBe(0);
    expect(shippingFor(998)).toBe(0);
    expect(shippingFor(9999)).toBe(0);
  });

  it("totalsFor adds shipping correctly (always ₹0)", () => {
    expect(totalsFor(199)).toEqual({ subtotal: 199, shipping: 0, total: 199 });
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
    expect(s.shipping).toBe(0);
    expect(s.total).toBe(697);
    expect(s.lines.map((l) => l.total)).toEqual([398, 299]);
  });

  it("keeps larger baskets free with no shipping added", () => {
    const s = summarizeCart([{ slug: "a", qty: 6, color: "Maroon" }], priceOf);
    expect(s.subtotal).toBe(1194);
    expect(s.shipping).toBe(0);
    expect(s.total).toBe(1194);
  });
});
