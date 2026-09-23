import { NextResponse } from "next/server";
import { getProducts, type SortKey } from "@/lib/data/queries";
import { LISTING_PAGE_SIZE } from "@/lib/listing";
import type { Product } from "@/lib/types";

/** Public card payload — the storefront grid never needs the full row. */
export interface ProductCardPayload {
  slug: string;
  name: string;
  category: string;
  colorway: string;
  price: number;
  rating: number;
  reviewCount: number;
  tags: string[];
  image?: string;
  images?: string[];
}

const SORTS = new Set(["popular", "newest", "rating"]);
const MAX_LIMIT = 24;
const DEFAULT_LIMIT = LISTING_PAGE_SIZE;

function toCard(p: Product): ProductCardPayload {
  return {
    slug: p.slug,
    name: p.name,
    category: p.category,
    colorway: p.colorway,
    price: p.price,
    rating: p.rating,
    reviewCount: p.reviewCount,
    tags: p.tags,
    image: p.images?.[0],
    images: p.images,
  };
}

/**
 * GET /api/products?category=&q=&color=&tag=&sort=&limit=&offset=
 * Returns lightweight card payloads for infinite-scroll listing pages.
 * Server-revalidated like everything else in the storefront — the client
 * never computes prices or availability. Demo-mode addresses/badges are
 * intentionally omitted: this route is pure catalogue data.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const rawLimit = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
  const rawOffset = Number(searchParams.get("offset") ?? 0);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.floor(rawLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const offset = Number.isFinite(rawOffset) ? Math.max(Math.floor(rawOffset), 0) : 0;

  const rawSort = (searchParams.get("sort") ?? "popular").trim();
  const sort: SortKey = SORTS.has(rawSort) ? (rawSort as SortKey) : "popular";

  const text = (v: string | null) => v?.trim() || undefined;
  const products = await getProducts({
    category: text(searchParams.get("category")),
    q: text(searchParams.get("q")),
    color: text(searchParams.get("color")),
    tag: text(searchParams.get("tag")),
    sort,
    limit: limit + 1, // fetch one extra to detect hasMore without a count query
    offset,
  });

  const hasMore = products.length > limit;
  return NextResponse.json(
    {
      ok: true,
      items: products.slice(0, limit).map(toCard),
      hasMore,
      nextOffset: offset + limit,
    },
    {
      // Infinite pages are disposable; the underlying lists stay cached in the
      // catalogue data cache, so short edge caching here is safe.
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    },
  );
}
