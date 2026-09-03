/**
 * Async data-access layer for storefront pages. Pages only talk to these
 * functions, which resolve through the active backend facade — the demo
 * database (so admin edits appear in the store on refresh) or Supabase.
 */
import {
  storeCategories,
  storeProductBySlug,
  storeProducts,
} from "@/lib/backend";
import type { CategoryWithCount, Product } from "@/lib/types";

export type SortKey = "popular" | "newest" | "rating";

export interface ProductFilter {
  category?: string;
  q?: string;
  color?: string;
  tag?: string;
  sort?: SortKey;
  limit?: number;
}

export async function getCategories(): Promise<CategoryWithCount[]> {
  const [list, products] = await Promise.all([storeCategories(), storeProducts()]);
  return list.map((c) => ({
    ...c,
    count: products.filter((p) => p.category === c.slug).length,
  }));
}

export async function getProducts(filter: ProductFilter = {}): Promise<Product[]> {
  const { category, q, color, tag, sort = "popular", limit } = filter;
  let list = await storeProducts();

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

  return typeof limit === "number" ? list.slice(0, limit) : list;
}

export async function getProductBySlug(
  slug: string,
): Promise<Product | undefined> {
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
  const pool = await storeProducts();
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
  for (const p of await storeProducts()) for (const c of p.colors) set.add(c);
  return [...set];
}
