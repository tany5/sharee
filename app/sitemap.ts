import type { MetadataRoute } from "next";
import { PRODUCTS, CATEGORIES } from "@/lib/data/catalog";
import { SITE } from "@/lib/site";

const STATIC: Array<[string, string]> = [
  ["", "0.9"],
  ["/sarees", "0.9"],
  ["/categories", "0.8"],
  ["/about", "0.4"],
  ["/contact", "0.4"],
  ["/shipping-policy", "0.3"],
  ["/return-policy", "0.3"],
  ["/privacy-policy", "0.2"],
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = STATIC.map(([path, priority]) => ({
    url: new URL(path, SITE.url).toString(),
    lastModified: now,
    changeFrequency: path === "" || path === "/sarees" ? "daily" : "weekly",
    priority: Number(priority),
  }));

  for (const c of CATEGORIES) {
    pages.push({
      url: new URL(`/categories/${c.slug}`, SITE.url).toString(),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }
  for (const p of PRODUCTS) {
    pages.push({
      url: new URL(`/sarees/${p.slug}`, SITE.url).toString(),
      lastModified: new Date(p.createdAt),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }
  return pages;
}
