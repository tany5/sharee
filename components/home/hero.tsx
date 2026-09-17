"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { formatINR } from "@/lib/format";
import { SITE } from "@/lib/site";
import { cx } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Banner photography of women wearing sarees, shown in a rounded     */
/*  showcase card beside the copy (public/banner, WebP-optimized).     */
/* ------------------------------------------------------------------ */

const SLIDES = [
  {
    src: "/banner/banner-pujo-portrait.webp",
    alt: "Bengali woman wearing a red silk saree in a Durga Puja setting",
    position: "50% 30%",
  },
  {
    src: "/banner/banner-teal-portrait.webp",
    alt: "Bengali woman wearing a teal cotton saree on a home veranda",
    position: "50% 25%",
  },
  {
    src: "/banner/banner-jamdani-portrait.webp",
    alt: "Bengali woman wearing an indigo Jamdani saree in a warm home interior",
    position: "50% 28%",
  },
  {
    src: "/banner/banner-mustard-portrait.webp",
    alt: "Bengali woman wearing a mustard handloom silk saree near a window",
    position: "50% 30%",
  },
];

const HERO_PROMISES = [
  {
    Icon: ShieldCheck,
    t: "Quality Checked",
    s: "Before every dispatch",
  },
  {
    Icon: RotateCcw,
    t: "7-day returns",
    s: "Easy support",
  },
  {
    Icon: Truck,
    t: "Free shipping",
    s: "Across All over India",
  },
];

/**
 * Pink balloons with knots and curved strings drifting up the right side of
 * the hero. Purely decorative (aria-hidden); deterministic values so SSR and
 * client render identically.
 */
function Balloons() {
  const balloons = [
    { size: 84, right: 3, delay: 0, dur: 30, sway: 22, op: 0.75 },
    { size: 44, right: 17, delay: 7, dur: 24, sway: -16, op: 0.68 },
    { size: 120, right: 7, delay: 15, dur: 38, sway: 30, op: 0.6 },
    { size: 30, right: 26, delay: 4, dur: 20, sway: -12, op: 0.78 },
    { size: 62, right: 12, delay: 22, dur: 28, sway: 18, op: 0.7 },
    { size: 24, right: 33, delay: 11, dur: 18, sway: 12, op: 0.8 },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {balloons.map((b, i) => (
        <span
          key={i}
          className="tt-balloon"
          style={
            {
              width: b.size,
              height: b.size * 1.18,
              right: `${b.right}%`,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.dur}s`,
              "--balloon-sway": `${b.sway}px`,
              "--balloon-opacity": b.op,
              "--balloon-size": `${b.size}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function Hero() {
  const [index, setIndex] = useState(0);
  const activeSlide = SLIDES[index];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 6500);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      className="relative isolate overflow-hidden bg-[linear-gradient(140deg,#ffeef5_0%,#fff7fa_42%,#ffe4ef_100%)]"
      aria-label="All sarees at one simple price"
    >
      {/* Soft decorative glow + drifting pink balloons (top-right focus) */}
      <div
        aria-hidden
        className="absolute -right-24 -top-24 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,rgba(226,68,143,0.14),transparent_65%)]"
      />
      <div
        aria-hidden
        className="absolute -left-32 bottom-0 h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(circle,rgba(216,107,164,0.12),transparent_65%)]"
      />
      <Balloons />

      <div className="tt-container relative grid items-center gap-8 py-8 sm:py-12 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:py-16">
        {/* ------------------------------ Copy ------------------------------ */}
        <div className="tt-rise">
          <p className="tt-eyebrow flex items-center gap-2.5 sm:gap-3">
            Pujo ready · Everyday sarees
            <span aria-hidden className="h-px w-8 bg-accent/50 sm:w-14" />
          </p>

          <h1 className="mt-4 font-display font-bold leading-[1.02] text-ink sm:mt-5">
            <span className="block text-[38px] sm:text-[56px] lg:text-[64px]">
              Sarees for
            </span>
            <span className="block text-[38px] sm:text-[56px] lg:text-[64px]">
              everyday life.
            </span>
          </h1>

          <p className="mt-4 max-w-[26rem] text-[15px] leading-7 text-ink2 sm:mt-5 sm:max-w-[30rem] sm:text-[17px] sm:leading-8">
            {SITE.supporting}
          </p>

          {/* Price — the commercial headline of the page. */}
          <div className="mt-5 flex flex-col gap-1.5 sm:mt-6">
            <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink2">
              All sarees
              <span aria-hidden className="h-px w-8 bg-accent/40" />
            </p>
            <div className="flex items-center gap-3">
              <span className="font-display text-[56px] font-bold leading-none text-accentdeep sm:text-[72px] lg:text-[80px]">
                {formatINR(SITE.price)}
              </span>
              <span className="rounded-pill bg-accent px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white shadow-md shadow-accent/25 sm:text-xs">
                Flat
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2.5 sm:mt-7 sm:gap-3">
            <Link
              href="/sarees"
              className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-pill bg-accent px-6 text-[14px] font-semibold tracking-wide text-white shadow-lg shadow-accent/30 transition-colors duration-200 hover:bg-accent-light sm:min-h-12 sm:px-8 sm:text-[15px]"
            >
              Shop All Sarees <ArrowRight size={17} />
            </Link>
            <Link
              href="/categories"
              className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-pill border border-accentdeep/35 px-6 text-[14px] font-semibold tracking-wide text-accentdeep transition-colors duration-200 hover:bg-accent/10 sm:min-h-12 sm:px-8 sm:text-[15px]"
            >
              Explore{" "}
              <span className="hidden sm:inline">Collection</span>
            </Link>
          </div>

          {/* All three promises stay visible as compact cards. */}
          <div className="mt-7 grid max-w-[34rem] grid-cols-3 gap-2 sm:gap-3">
            {HERO_PROMISES.map(({ Icon, t, s }) => (
              <div
                key={t}
                className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface px-2 py-3 text-center shadow-sm sm:flex-row sm:gap-2.5 sm:rounded-xl sm:px-3 sm:text-left"
              >
                <Icon
                  size={20}
                  className="shrink-0 text-accent"
                  strokeWidth={1.8}
                />
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-bold text-ink sm:text-[13px]">
                    {t}
                  </span>
                  <span className="hidden truncate text-[10px] text-ink2 min-[420px]:block sm:text-[11px]">
                    {s}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* --------------------------- Photo card --------------------------- */}
        <div className="relative">
          <div className="group relative aspect-[3/4] overflow-hidden rounded-[28px] shadow-xl shadow-accent/15 ring-1 ring-accent/15 sm:aspect-[4/5] lg:aspect-[4/4.6]">
            {/* All slides stacked; opacity crossfades between them. */}
            {SLIDES.map((s, i) => (
              <Image
                key={s.src}
                src={s.src}
                alt={i === index ? s.alt : ""}
                fill
                sizes="(min-width: 1024px) 46vw, 92vw"
                priority={i === 0}
                className={cx(
                  "object-cover transition-opacity duration-700 [filter:saturate(1.16)_contrast(1.03)]",
                  i === index ? "opacity-100" : "opacity-0",
                )}
                style={{ objectPosition: s.position }}
              />
            ))}

            {/* Edge arrows — white pills, mid-height of the photo */}
            <button
              type="button"
              aria-label="Previous banner"
              onClick={() =>
                setIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length)
              }
              className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-pill border border-white/40 bg-black/25 text-white shadow-lg backdrop-blur-md transition-colors duration-200 hover:bg-accent sm:h-11 sm:w-11"
            >
              <ChevronLeft size={20} strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Next banner"
              onClick={() => setIndex((i) => (i + 1) % SLIDES.length)}
              className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-pill border border-white/40 bg-black/25 text-white shadow-lg backdrop-blur-md transition-colors duration-200 hover:bg-accent sm:h-11 sm:w-11"
            >
              <ChevronRight size={20} strokeWidth={2} />
            </button>

            {/* Floating price chip */}
            <span className="absolute left-4 top-4 rounded-pill bg-white/92 px-3.5 py-1.5 text-[12px] font-bold text-accentdeep shadow-md backdrop-blur sm:text-[13px]">
              {formatINR(SITE.price)} · Flat
            </span>
          </div>

          {/* Slide picker — thumbnails under the photo */}
          <div className="mt-2.5 flex items-center justify-center gap-1.5 sm:mt-3 sm:gap-2">
            {SLIDES.map((s, i) => (
              <button
                key={s.src}
                type="button"
                aria-label={`Show banner ${i + 1} of ${SLIDES.length}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={cx(
                  "relative h-8 w-11 overflow-hidden rounded-lg border transition-all duration-300 sm:h-12 sm:w-16 sm:rounded-xl",
                  i === index
                    ? "border-accent shadow-[0_0_0_2px_rgba(226,68,143,0.25)]"
                    : "border-line opacity-70 hover:opacity-100",
                )}
              >
                <Image
                  src={s.src}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover [filter:saturate(1.16)]"
                  style={{ objectPosition: s.position }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
