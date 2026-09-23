/**
 * Async data-access layer for storefront pages. Pages only talk to these
 * functions, which resolve through the active backend facade — the demo
 * database (so admin edits appear in the store on refresh) or Supabase.
 *
 * In Supabase mode the two catalogue lists (active products, categories) are
 * served from the cross-request data cache (lib/data/catalogue-cache.ts), so
 * a page view does ZERO database round trips when the cache is warm, and all
 * filtering/sorting/lookups below are just in-memory work on that snapshot.
 */
import {
  storeCategories,
  storeProductBySlug,
  storeProducts,
} from "@/lib/backend";
import { isSupabaseBackend } from "@/lib/backend/env";
import {
  cachedActiveProducts,
  cachedCategories,
} from "@/lib/data/catalogue-cache";
import type { Category, CategoryWithCount, Product } from "@/lib/types";

/** Active products — cached snapshot in Supabase mode, live reads in demo. */
async function allProducts(): Promise<Product[]> {
  if (isSupabaseBackend()) {
    return (await cachedActiveProducts()) as unknown as Product[];
  }
  return storeProducts();
}

/** All categories — cached snapshot in Supabase mode, live reads in demo. */
async function allCategories(): Promise<Category[]> {
  if (isSupabaseBackend()) return cachedCategories();
  return storeCategories();
}

export type SortKey = "popular" | "newest" | "rating";

export interface ProductFilter {
  category?: string;
  q?: string;
  color?: string;
  tag?: string;
  sort?: SortKey;
  offset?: number;
  limit?: number;
}

export async function getCategories(): Promise<CategoryWithCount[]> {
  const [list, products] = await Promise.all([allCategories(), allProducts()]);
  return list.map((c) => ({
    ...c,
    count: products.filter((p) => p.category === c.slug).length,
  }));
}

export async function getProducts(filter: ProductFilter = {}): Promise<Product[]> {
  const { category, q, color, tag, sort = "popular", limit, offset } = filter;
  let list = await allProducts();

  if (category) list = list.filter((p) => p.category === category);
  if (tag) list = list.filter((p) => p.tags.includes(tag));
  if (color) {
    const needle = color.toLowerCase();
    list = list.filter((p) =>
      p.colors.some((c) => c.toLowerCase().includes(needle)),
    );
  }
  if (q) {
    const needle = q.toLowerCase().trim();
    if (needle) {
      const haystacks = [
        (p: Product) => p.name,
        (p: Product) => p.description,
        (p: Product) => p.fabric,
        (p: Product) => p.occasion,
      ];
      list = list.filter((p) =>
        haystacks.some((fn) => fn(p).toLowerCase().includes(needle)),
      );
    }
  }

  switch (sort) {
    case "newest":
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case "rating":
      list.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
      break;
    default:
      list.sort(
        (a, b) =>
          b.reviewCount - a.reviewCount ||
          b.rating - a.rating ||
          a.name.localeCompare(b.name),
      );
  }

  const start = typeof offset === "number" && offset > 0 ? Math.floor(offset) : 0;
  const sliced = start > 0 ? list.slice(start) : list;
  return typeof limit === "number" ? sliced.slice(0, limit) : sliced;
}
/**
 * Total matching products for an infinite listing, without materialising the
 * whole result set. Uses the same filters and cached catalogue snapshot as
 * getProducts, so the count and the pages can never disagree.
 */
export async function countProducts(
  filter: Omit<ProductFilter, "limit" | "offset"> = {},
): Promise<number> {
  const { category, q, color, tag } = filter;
  const list = await allProducts();

  let n = 0;
  for (const p of list) {
    if (category && p.category !== category) continue;
    if (tag && !p.tags.includes(tag)) continue;
    if (color) {
      const needle = color.toLowerCase();
      if (!p.colors.some((c) => c.toLowerCase().includes(needle))) continue;
    }
    if (q) {
      const needle = q.toLowerCase().trim();
      if (needle) {
        const haystacks = [p.name, p.description, p.fabric, p.occasion];
        if (!haystacks.some((h) => h.toLowerCase().includes(needle))) continue;
      }
    }
    n += 1;
  }
  return n;
}


export async function getProductBySlug(
  slug: string,
): Promise<Product | undefined> {
  // Supabase mode: the cached catalogue snapshot avoids a DB round trip and
  // dedupes the metadata + page double lookup; demo keeps the direct read.
  if (isSupabaseBackend()) {
    return (await allProducts()).find((p) => p.slug === slug);
  }
  return storeProductBySlug(slug);
}

export async function getFeatured(limit = 8): Promise<Product[]> {
  return getProducts({ tag: "bestseller", limit });
}

export async function getNewArrivals(limit = 8): Promise<Product[]> {
  return getProducts({ tag: "new", sort: "newest", limit });
}

export async function getRelated(
  product: Product,
  limit = 4,
): Promise<Product[]> {
  const pool = await allProducts();
  const sameCategory = pool.filter(
    (p) => p.category === product.category && p.slug !== product.slug,
  );
  const sameColor = pool.filter(
    (p) =>
      p.category !== product.category &&
      p.slug !== product.slug &&
      p.colors.some((c) => product.colors.includes(c)),
  );
  return [...sameCategory, ...sameColor].slice(0, limit);
}

/** Distinct base colours present in the catalogue (for the filter UI). */
export async function getFilterColors(): Promise<string[]> {
  const set = new Set<string>();
  for (const p of await allProducts()) for (const c of p.colors) set.add(c);
  return [...set];
}
