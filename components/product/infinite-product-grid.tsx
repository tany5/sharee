"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/types";
import { LISTING_PAGE_SIZE } from "@/lib/listing";
import {
  ProductCard,
  type ProductCardData,
} from "@/components/product/product-card";
import { cx } from "@/lib/utils";

export interface ListingQuery {
  category?: string;
  q?: string;
  color?: string;
  tag?: string;
  sort?: string;
}

interface PageResponse {
  ok: boolean;
  items: ProductCardData[];
  hasMore: boolean;
  nextOffset: number;
}

function toCard(p: Product): ProductCardData {
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

function toQuery(query: ListingQuery, offset: number): string {
  const sp = new URLSearchParams();
  sp.set("limit", String(LISTING_PAGE_SIZE));
  sp.set("offset", String(offset));
  if (query.category) sp.set("category", query.category);
  if (query.q) sp.set("q", query.q);
  if (query.color) sp.set("color", query.color);
  if (query.tag) sp.set("tag", query.tag);
  if (query.sort) sp.set("sort", query.sort);
  return sp.toString();
}

/**
 * Infinite listing grid: server renders the first page (SEO + no-JS intact),
 * then an IntersectionObserver sentinel fetches further pages from
 * /api/products until the catalogue is exhausted. Works on mobile and
 * desktop — the observer only depends on the sentinel entering the viewport.
 * Filter/sort changes remount via the parent `key` prop, so counts never mix.
 * Rendered only when the result set exceeds one page (LISTING_PAGE_SIZE);
 * shorter lists use the static ProductGrid — zero client JS needed.
 */
export function InfiniteProductGrid({
  initial,
  total,
  initialHasMore,
  query,
}: {
  initial: Product[];
  total: number;
  initialHasMore: boolean;
  query: ListingQuery;
  /** Remount on every filter/sort change via the parent `key` prop. */
}) {
  const [items, setItems] = useState<ProductCardData[]>(() =>
    initial.map(toCard),
  );
  const [nextOffset, setNextOffset] = useState(initial.length);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const queryRef = useRef(query);
  queryRef.current = query;

  const loadMore = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/products?${toQuery(queryRef.current, nextOffset)}`, {
        headers: { accept: "application/json", "cache-control": "no-cache" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as PageResponse;
      if (!data.ok) throw new Error("bad payload");
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.slug));
        return [...prev, ...data.items.filter((p) => !seen.has(p.slug))];
      });
      setNextOffset(data.nextOffset);
      // An empty page always ends the list, so a bad payload can never spin.
      setHasMore(data.hasMore && data.items.length > 0);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [nextOffset, loading]);

  // Scroll trigger: load the next page whenever the sentinel comes into view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    if (typeof IntersectionObserver !== "undefined") {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) loadMore();
        },
        { rootMargin: "600px 0px" },
      );
      observer.observe(el);
      return () => observer.disconnect();
    }
    // Fallback for environments without IntersectionObserver (older browsers).
    const onScroll = () => {
      if (el.getBoundingClientRect().top < window.innerHeight - 300) {
        loadMore();
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [loadMore]);

  /**
   * Keep filling. IntersectionObserver only fires on change, so once a page is
   * appended the sentinel can stay on screen (tall monitors, short rows) and
   * never fire again — the list would stall at 24 of 76. This re-checks after
   * every render and keeps pulling pages until the sentinel is safely below
   * the fold, so scrolling always continues to the end of the catalogue.
   */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || loading || !hasMore || failed) return;
    if (el.getBoundingClientRect().top <= window.innerHeight + 600) {
      loadMore();
    }
  }, [items.length, loading, hasMore, failed, loadMore]);

  const shown = items.length;

  return (
    <>
      <div
        className={cx(
          "grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-4 md:gap-x-5",
          "md:grid-cols-3 xl:grid-cols-4",
        )}
      >
        {items.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>

      <p className="mt-6 text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        {shown < total
          ? `Showing ${shown} of ${total} styles`
          : `You have seen all ${total} styles`}
      </p>

      {/* Sentinel: triggers the next page as it comes into view (and keeps
          filling until the list ends). */}
      {shown < total && (
        <div
          ref={sentinelRef}
          className="flex min-h-[48px] items-center justify-center gap-3 py-4"
        >
          {loading ? (
            <div
              className="flex w-full flex-row items-center gap-3"
              aria-hidden
            >
              <span className="inline-flex h-5 w-5 animate-spin rounded-full border border-current border-t0 border-current" />
              <span>Loading more…</span>
            </div>
          ) : failed ? (
            <button
              type="button"
              onClick={loadMore}
              className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-accent"
            >
              Couldn’t load more — tap to retry
            </button>
          ) : null}
        </div>
      )}
    </>
  );
}
