/**
 * Async data-access layer. Pages only talk to these functions, never to
 * catalogue arrays directly.
 *
 * Reads resolve through the demo database (so admin edits appear in the store
 * on refresh) with a fallback to the seed catalogue. Swapping this layer for
 * Supabase later (supabase/migrations/0001_init.sql) leaves pages untouched.
 */
import type { CategoryWithCount, Product } from "@/lib/types";
import { CATEGORIES, PRODUCTS } from "@/lib/data/catalog";
import {
  publicProducts,
  publicProductBySlug,
  categories,
  isDbInitialised,
} from "@/lib/demo/db";

export type SortKey = "popular" | "newest" | "rating";

export interface ProductFilter {
  category?: string;
  q?: string;
  color?: string;
  tag?: string;
  sort?: SortKey;
  limit?: number;
}

/** Source products (demo DB when initialised, seed catalogue otherwise). */
function allProducts(): Product[] {
  if (!isDbInitialised()) return PRODUCTS;
  return publicProducts();
}

export async function getCategories(): Promise<CategoryWithCount[]> {
  const list = isDbInitialised() ? categories() : CATEGORIES;
  const products = allProducts();
  return list.map((c) => ({
    ...c,
    count: products.filter((p) => p.category === c.slug).length,
  }));
}

export async function getProducts(filter: ProductFilter = {}): Promise<Product[]> {
  const { category, q, color, tag, sort = "popular", limit } = filter;
  let list = allProducts();

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
  try {
    const fromDb = publicProductBySlug(slug);
    if (fromDb) return fromDb;
  } catch {
    /* fall through */
  }
  return PRODUCTS.find((p) => p.slug === slug);
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
  const pool = allProducts();
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
  for (const p of allProducts()) for (const c of p.colors) set.add(c);
  return [...set];
}
