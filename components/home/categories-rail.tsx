"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { CategoryWithCount } from "@/lib/types";
import { categoryPhoto } from "@/lib/photos";

/**
 * Arrow-driven category carousel: prev/next buttons page through the rail and
 * a small track shows how far you've scrolled — no scrolling by swipe needed.
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
    const w = (card ? card.offsetWidth : 300) + 16;
    el.scrollBy({ left: dir * w, behavior: "smooth" });
  }, []);

  return (
    <div>
      <div
        ref={railRef}
        onScroll={onScroll}
        aria-label="Browse categories"
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/categories/${c.slug}`}
            data-rail-card
            className="group w-[68vw] max-w-[280px] shrink-0 snap-start sm:w-[42vw] sm:max-w-[300px] md:w-[300px] lg:w-[320px]"
          >
            <div className="relative aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-line/80 transition-shadow group-hover:shadow-lg group-hover:shadow-ink/10">
              {categoryPhoto(c.slug) && (
                <Image
                  src={categoryPhoto(c.slug)!}
                  alt={`${c.name} — woman wearing the saree`}
                  fill
                  sizes="(min-width: 1024px) 24vw, 60vw"
                  className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.05]"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e6d5b6]">
                  {c.count} styles
                </p>
                <p className="font-display text-[15px] font-bold leading-tight text-white">
                  {c.name}
                </p>
                <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#f0e2cd]">
                  Explore <ArrowRight size={11} />
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous categories"
          className="hidden h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink2 shadow-sm transition-colors hover:border-accent/60 hover:text-ink sm:flex"
        >
          <ChevronLeft size={16} strokeWidth={2.2} />
        </button>
        <div
          aria-hidden
          className="relative h-1 w-36 overflow-hidden rounded-full bg-line sm:w-44"
        >
          <span
            className="absolute top-0 h-full rounded-full bg-accent transition-[left] duration-150 ease-out"
            style={{ left: `calc(${progress * 100}% - ${progress * 16}px)`, width: 16 }}
          />
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next categories"
          className="hidden h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink2 shadow-sm transition-colors hover:border-accent/60 hover:text-ink sm:flex"
        >
          <ChevronRight size={16} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}