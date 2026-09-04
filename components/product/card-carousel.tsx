"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SareeArt from "@/components/product/saree-art";
import type { ArtSpec } from "@/lib/art";
import { cx } from "@/lib/utils";

export type CardSlide =
  | { kind: "img"; src: string; alt: string }
  | { kind: "art"; spec: ArtSpec; label: string };

/**
 * Mini carousel for the product-card image area. While hovered it cycles the
 * saree's images (2 worn shots + fabric-only art) on a short interval, with
 * prev/next arrows and a small counter. Leaving the card resets to slide 0.
 */
export function CardCarousel({
  slides,
  className,
}: {
  slides: CardSlide[];
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [suppressClick, setSuppressClick] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;
  const many = count > 1;

  useEffect(() => {
    if (!many || !hovering) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), 2200);
    return () => clearInterval(id);
  }, [many, hovering, count]);

  const go = (dir: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIndex((i) => (i + dir + count) % count);
  };

  // Touch swipe (mobile has no arrows): horizontal drag cycles the photos,
  // and the following tap is suppressed so it doesn't open the product page.
  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 40) {
      setIndex((i) => (i + (dx < 0 ? 1 : -1) + count) % count);
      setSuppressClick(true);
      window.setTimeout(() => setSuppressClick(false), 350);
    }
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (suppressClick) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div
      className={cx("absolute inset-0 touch-pan-y", className)}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => {
        setHovering(false);
        setIndex(0);
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClickCapture={onClickCapture}
    >
      {slides.map((s, i) => (
        <div
          key={i}
          className={cx(
            "absolute inset-0 transition-opacity duration-500",
            i === index ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {s.kind === "img" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.src}
              alt={s.alt}
              loading="lazy"
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <SareeArt
              spec={s.spec}
              label={s.label}
              crop="portrait"
              className="h-full w-full"
            />
          )}
        </div>
      ))}

      {many && (
        <>
          <button
            type="button"
            onClick={go(-1)}
            aria-label="Previous image"
            className={cx(
              "absolute left-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface/95 text-ink shadow-md backdrop-blur transition-all duration-200 hover:scale-105 hover:bg-surface lg:flex",
              hovering ? "opacity-100" : "opacity-0",
            )}
          >
            <ChevronLeft size={16} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={go(1)}
            aria-label="Next image"
            className={cx(
              "absolute right-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface/95 text-ink shadow-md backdrop-blur transition-all duration-200 hover:scale-105 hover:bg-surface lg:flex",
              hovering ? "opacity-100" : "opacity-0",
            )}
          >
            <ChevronRight size={16} strokeWidth={2.2} />
          </button>
          <span
            aria-hidden
            className={cx(
              "absolute bottom-2 right-2 z-10 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur transition-opacity duration-200",
              hovering ? "opacity-100" : "opacity-0",
            )}
          >
            {index + 1}/{count}
          </span>
        </>
      )}
    </div>
  );
}