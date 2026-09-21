import type { MetadataRoute } from "next";
import { PRODUCTS, CATEGORIES } from "@/lib/data/catalog";
import { isSupabaseBackend } from "@/lib/backend/env";
import {
  cachedActiveProducts,
  cachedCategories,
} from "@/lib/data/catalogue-cache";
import { SITE } from "@/lib/site";
import type { Category, Product } from "@/lib/types";

const STATIC: Array<[string, string]> = [
  ["", "0.9"],
  ["/sarees", "0.9"],
  ["/categories", "0.8"],
  ["/about", "0.4"],
  ["/contact", "0.4"],
  ["/shipping-policy", "0.3"],
  ["/return-policy", "0.3"],
  ["/privacy-policy", "0.2"],
  ["/terms-and-conditions", "0.2"],
];

/**
 * The sitemap must reflect the LIVE catalogue, not the seed data — the seed
 * slugs 404 in production once the admin replaces the demo catalogue (that
 * exact mismatch put 28 dead URLs into Google). In Supabase mode the lists
 * come from the cached public catalogue; the seed catalogue is only the
 * demo-mode / failure fallback so the sitemap never errors.
 */
async function liveCatalogue(): Promise<{
  categories: Category[];
  products: Pick<Product, "slug" | "createdAt">[];
}> {
  if (!isSupabaseBackend()) {
    return { categories: CATEGORIES, products: PRODUCTS };
  }
  try {
    const [categories, products] = await Promise.all([
      cachedCategories(),
      cachedActiveProducts(),
    ]);
    return { categories, products };
  } catch (err) {
    console.error("[sitemap] live catalogue fetch failed, using seed fallback", err);
    return { categories: CATEGORIES, products: PRODUCTS };
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = STATIC.map(([path, priority]) => ({
    url: new URL(path, SITE.url).toString(),
    lastModified: now,
    changeFrequency: path === "" || path === "/sarees" ? "daily" : "weekly",
    priority: Number(priority),
  }));

  const { categories, products } = await liveCatalogue();

  for (const c of categories) {
    pages.push({
      url: new URL(`/categories/${c.slug}`, SITE.url).toString(),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }
  for (const p of products) {
    pages.push({
      url: new URL(`/sarees/${p.slug}`, SITE.url).toString(),
      lastModified: p.createdAt ? new Date(p.createdAt) : now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }
  return pages;
}
