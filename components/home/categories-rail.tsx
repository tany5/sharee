"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CategoryWithCount } from "@/lib/types";
import { categoryPhoto } from "@/lib/photos";

/**
 * Short descriptors drawn from each category's existing blurb
 * (lib/data/catalog). Categories added later fall back to the first clause of
 * their own blurb, so no copy is invented here.
 */
const DESCRIPTORS: Record<string, string> = {
  "cotton-sarees": "Everyday comfort",
  "silk-sarees": "Timeless elegance",
  "printed-sarees": "Playful & stylish",
  "chiffon-sarees": "Featherlight flow",
  "georgette-sarees": "Light & graceful",
  "fancy-sarees": "For special days",
};

function descriptorFor(c: CategoryWithCount): string {
  return DESCRIPTORS[c.slug] ?? c.blurb.split(/[.,]/)[0];
}

/**
 * Category rail — five cards visible on desktop, a swipeable strip on mobile,
 * with arrow paging and a scroll-progress track.
 */
export function CategoriesRail({
  categories,
}: {
  categories: CategoryWithCount[];
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  const onScroll = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max > 0 ? Math.min(1, el.scrollLeft / max) : 0);
  }, []);

  const step = useCallback((dir: number) => {
    const el = railRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-rail-card]");
    const w = (card ? card.offsetWidth : 300) + 20;
    el.scrollBy({ left: dir * w, behavior: "smooth" });
  }, []);

  return (
    <div>
      <div
        ref={railRef}
        onScroll={onScroll}
        aria-label="Browse categories"
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 sm:gap-4 lg:gap-5"
      >
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/categories/${c.slug}`}
            data-rail-card
            className="group w-[62vw] max-w-[240px] shrink-0 snap-start sm:w-[40vw] sm:max-w-[260px] lg:w-[calc((100%-5rem)/5)] lg:max-w-none"
          >
            <div className="relative aspect-[4/5] overflow-hidden rounded-panel border border-line">
              {categoryPhoto(c.slug) && (
                <Image
                  src={categoryPhoto(c.slug)!}
                  alt={`${c.name} — woman wearing the saree`}
                  fill
                  sizes="(min-width: 1024px) 18vw, 55vw"
                  className="object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
                />
              )}
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 via-black/25 to-transparent"
              />
              <div className="absolute inset-x-0 bottom-0 p-3.5">
                <p className="font-display text-[17px] font-semibold leading-tight text-white">
                  {c.name}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-white/75">
                  {descriptorFor(c)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous categories"
          className="hidden h-9 w-9 items-center justify-center rounded-pill border border-line bg-surface text-ink2 transition-colors hover:border-accent/60 hover:text-ink sm:flex"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>
        <div
          aria-hidden
          className="relative h-1 w-36 overflow-hidden rounded-pill bg-line sm:w-44"
        >
          <span
            className="absolute top-0 h-full rounded-pill bg-accent transition-[left] duration-150 ease-out"
            style={{ left: `calc(${progress * 100}% - ${progress * 16}px)`, width: 16 }}
          />
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next categories"
          className="hidden h-9 w-9 items-center justify-center rounded-pill border border-line bg-surface text-ink2 transition-colors hover:border-accent/60 hover:text-ink sm:flex"
        >
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}