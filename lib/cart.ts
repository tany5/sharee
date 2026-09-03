/**
 * Pure cart logic. No React, no storage — everything here is unit-tested and
 * safe to run on server and client alike. The server *never* trusts prices or
 * totals sent from the browser; it recomputes them from the catalogue.
 */
import { SITE } from "@/lib/site";
import type { CartItem } from "@/lib/types";

export const MAX_QTY_PER_ITEM = 5;

export function lineKey(slug: string, color: string): string {
  return `${slug}::${color}`;
}

/** Add qty of a product+color, merging into an existing matching line. */
export function addItemToCart(
  items: CartItem[],
  next: CartItem,
): CartItem[] {
  const key = lineKey(next.slug, next.color);
  const existing = items.find((i) => lineKey(i.slug, i.color) === key);
  if (!existing) return [...items, { ...next, qty: Math.min(next.qty, MAX_QTY_PER_ITEM) }];
  return items.map((i) =>
    lineKey(i.slug, i.color) === key
      ? { ...i, qty: Math.min(i.qty + next.qty, MAX_QTY_PER_ITEM) }
      : i,
  );
}

export function setItemQty(
  items: CartItem[],
  slug: string,
  color: string,
  qty: number,
): CartItem[] {
  const key = lineKey(slug, color);
  if (qty <= 0) return removeItem(items, slug, color);
  return items.map((i) =>
    lineKey(i.slug, i.color) === key
      ? { ...i, qty: Math.min(qty, MAX_QTY_PER_ITEM) }
      : i,
  );
}

export function removeItem(
  items: CartItem[],
  slug: string,
  color: string,
): CartItem[] {
  const key = lineKey(slug, color);
  return items.filter((i) => lineKey(i.slug, i.color) !== key);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.qty, 0);
}

/** Shipping: free at/above ₹999, flat fee below (brand promise). */
export function shippingFor(subtotal: number): number {
  return subtotal >= SITE.freeShippingThreshold ? 0 : SITE.shippingFee;
}

export interface Totals {
  subtotal: number;
  shipping: number;
  total: number;
}

export function totalsFor(subtotal: number): Totals {
  const shipping = shippingFor(subtotal);
  return { subtotal, shipping, total: subtotal + shipping };
}

export interface SummaryLine extends CartItem {
  price: number;
  total: number;
}

/**
 * Cart summary. `priceOf` receives the full line so callers can prefer the
 * price snapshot captured at add-time (admin-edited products) before falling
 * back to a lookup — see SITE.price for the classic single-price catalogue.
 */
export function summarizeCart(
  items: CartItem[],
  priceOf: (line: CartItem) => number,
): Totals & { lines: SummaryLine[] } {
  const lines = items.map((i) => {
    const price = priceOf(i);
    return { ...i, price, total: price * i.qty };
  });
  const subtotal = lines.reduce((sum, l) => sum + l.total, 0);
  return { lines, ...totalsFor(subtotal) };
}
