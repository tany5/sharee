/**
 * Product details tool — looks up ONE product by slug via the existing
 * /api/products endpoint (q=slug matches names; the catalogue search also
 * matches slugs through the server query). Slug shape is validated; unknown
 * slugs return a clean "not found" rather than a guess.
 */
import type { ChatProduct } from "@/lib/ai/types/chat";
import { runProductSearch, validateProductSearchInput } from "./product-search";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: unknown): slug is string {
  return typeof slug === "string" && slug.length <= 100 && SLUG_RE.test(slug);
}

/** Fetch a single product card by slug (or undefined). */
export async function runProductDetails(rawSlug: unknown): Promise<ChatProduct | undefined> {
  if (!isValidSlug(rawSlug)) return undefined;
  // The public API's q filter matches product names/descriptions, so ask for
  // the exact slug text and then match exactly — no invented products.
  const input = validateProductSearchInput({ q: rawSlug, limit: 8 });
  const items = await runProductSearch(input);
  return items.find((p) => p.slug === rawSlug);
}
