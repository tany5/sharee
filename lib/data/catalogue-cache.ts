/**
 * Cross-request catalogue cache for the storefront (Supabase mode).
 *
 * Before this cache, every page view made several full-table Supabase round
 * trips through the request-scoped (cookie) client: a product page fetched
 * the product twice (metadata + page), the whole products table twice more
 * (category counts + related sarees) and the categories table once. With a
 * Mumbai→Supabase hop each time, first-byte times were 3+ seconds.
 *
 * Now the active-products list and the categories list are cached in the
 * Next.js data cache via a cookie-less anon client (RLS already allows
 * public catalogue reads). Warm requests do ZERO database round trips.
 *
 * Freshness rules:
 *   - Time-based safety net: revalidate every 5 minutes.
 *   - Instant invalidation: every admin mutation route calls
 *     revalidateCatalogue() (revalidateTag), so product/category edits show
 *     up immediately.
 *
 * Errors are NOT cached by unstable_cache — a failed fetch simply reruns on
 * the next request, so a Supabase hiccup never poisons the cache.
 */
import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { supabasePublic } from "@/lib/supabase/public";
import { toProduct, type CategoryRow, type ProductRow } from "@/lib/supabase/rows";
import type { Category } from "@/lib/types";
import type { DbProduct } from "@/lib/demo/db";

export const CATALOGUE_PRODUCTS_TAG = "products";
export const CATALOGUE_CATEGORIES_TAG = "categories";

/** Seconds before a cached snapshot is refreshed even without an admin edit. */
const REVALIDATE_SECONDS = 300;

async function fetchActiveProducts(): Promise<DbProduct[]> {
  const { data, error } = await supabasePublic()
    .from("products")
    .select("*")
    .eq("db_status", "active");
  if (error) throw new Error(`Could not load products: ${error.message}`);
  return (data as ProductRow[]).map(toProduct) as unknown as DbProduct[];
}

async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabasePublic()
    .from("categories")
    .select("*")
    .order("name");
  if (error) throw new Error(`Could not load categories: ${error.message}`);
  return (data as CategoryRow[]).map((r) => ({
    slug: r.slug,
    name: r.name,
    short: r.short,
    blurb: r.blurb,
  }));
}

/** Active catalogue products — cached across requests, tagged "products". */
export const cachedActiveProducts = unstable_cache(
  fetchActiveProducts,
  ["catalogue-active-products"],
  { tags: [CATALOGUE_PRODUCTS_TAG], revalidate: REVALIDATE_SECONDS },
);

/** All categories — cached across requests, tagged "categories". */
export const cachedCategories = unstable_cache(
  fetchCategories,
  ["catalogue-categories"],
  { tags: [CATALOGUE_CATEGORIES_TAG], revalidate: REVALIDATE_SECONDS },
);

/**
 * Instant invalidation for admin mutations (product/category create, update,
 * delete, marketing-pipeline writes). Call from route handlers only.
 */
export function revalidateCatalogue(): void {
  // { expire: 0 } = hard-expire immediately (not stale-while-revalidate), so
  // the very next storefront request re-reads the admin's changes.
  revalidateTag(CATALOGUE_PRODUCTS_TAG, { expire: 0 });
  revalidateTag(CATALOGUE_CATEGORIES_TAG, { expire: 0 });
}
