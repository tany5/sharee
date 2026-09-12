"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  RotateCcw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { formatINR } from "@/lib/format";
import { SITE } from "@/lib/site";
import { cx } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Banner photography of women wearing sarees, crossfaded in the      */
/*  editorial image column (public/banner, WebP-optimized).            */
/* ------------------------------------------------------------------ */

const SLIDES = [
  {
    src: "/banner/banner-pujo-red-full.webp",
    alt: "Bengali woman wearing a red silk saree in a Durga Puja setting",
    position: "82% 50%",
    mobilePosition: "72% 50%",
  },
  {
    src: "/banner/banner-everyday-teal-full.webp",
    alt: "Bengali woman wearing a teal cotton saree on a home veranda",
    position: "80% 50%",
    mobilePosition: "70% 50%",
  },
  {
    src: "/banner/banner-jamdani-indigo-full.webp",
    alt: "Bengali woman wearing an indigo Jamdani saree in a warm home interior",
    position: "78% 50%",
    mobilePosition: "68% 50%",
  },
  {
    src: "/banner/banner-handloom-mustard-full.webp",
    alt: "Bengali woman wearing a mustard handloom silk saree near a window",
    position: "82% 50%",
    mobilePosition: "72% 50%",
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
    s: "Across West Bengal",
  },
];

function CtaButtons() {
  const base =
    "inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-pill px-4 text-[13px] font-semibold tracking-wide shadow-lg shadow-black/20 transition-colors duration-200 sm:min-h-12 sm:gap-2 sm:px-7 sm:text-[15px]";
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <Link
        href="/sarees"
        className={cx(
          base,
          "bg-accent text-white hover:bg-accent-light sm:px-7",
        )}
      >
        Shop All Sarees <ArrowRight size={17} />
      </Link>
      <Link
        href="/categories"
        className={cx(
          base,
          "border border-white/35 bg-white/10 text-white backdrop-blur hover:border-white/60 hover:bg-white/[0.16] sm:px-7",
        )}
      >
        Explore <span className="hidden sm:inline">Collection</span>
      </Link>
    </div>
  );
}

export function Hero() {
  const [index, setIndex] = useState(0);
  const activeSlide = SLIDES[index];
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [compactHero, setCompactHero] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = (e: MediaQueryListEvent) => setCompactHero(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 6500);
    return () => clearInterval(id);
  }, [reducedMotion]);

  return (
    <section
      className="relative isolate h-[650px] min-h-[620px] overflow-hidden bg-[#120b08] text-white sm:h-[760px] lg:h-[780px] lg:max-h-[calc(100svh-1rem)] xl:h-[100vh]"
      aria-label="All sarees at one simple price"
    >
      {/* -------------------------- Full banner art ------------------------- */}
      <div className="absolute inset-0">
        <Image
          key={activeSlide.src}
          src={activeSlide.src}
          alt=""
          fill
          sizes="100vw"
          priority
          className={cx(
            "object-cover opacity-80 transition-transform duration-[1400ms] ease-out sm:opacity-65 motion-reduce:transition-none",
            !reducedMotion && "scale-[1.005]",
          )}
          style={{ objectPosition: compactHero ? activeSlide.mobilePosition : activeSlide.position }}
          aria-hidden
        />
      </div>

      {/* A layered scrim keeps copy readable while the photo still bleeds behind it. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(17,8,5,0.88)_0%,rgba(24,11,7,0.76)_27%,rgba(40,20,12,0.45)_51%,rgba(40,20,12,0.16)_73%,rgba(24,11,7,0.08)_100%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_78%_48%,rgba(255,232,188,0.18),transparent_34%),linear-gradient(0deg,rgba(12,7,5,0.78)_0%,rgba(12,7,5,0.16)_36%,rgba(12,7,5,0.08)_100%)]"
      />

      {/* ---------------------------- Banner copy --------------------------- */}
      <div className="tt-container relative z-10 flex h-full flex-col justify-center pb-[6.25rem] pt-[6.75rem] sm:pb-18 sm:pt-[8.5rem] lg:pb-20 lg:pt-[9rem]">
        <div className="tt-rise max-w-[50rem]">
          <p className="tt-eyebrow flex items-center gap-2.5 text-goldlight sm:gap-3">
            Pujo ready · Everyday sarees
            <span aria-hidden className="h-px w-8 bg-goldlight/60 sm:w-14" />
          </p>

          <h1 className="mt-4 max-w-[36rem] font-display font-bold leading-[0.98] text-[#fff7ec] drop-shadow-[0_5px_24px_rgba(0,0,0,0.55)] sm:mt-5 lg:max-w-[44rem]">
            <span className="block whitespace-nowrap text-[34px] min-[420px]:text-[38px] sm:text-[62px] lg:text-[72px] xl:text-[82px]">
              Sarees for
            </span>
            <span className="block whitespace-nowrap text-[34px] min-[420px]:text-[38px] sm:text-[62px] lg:text-[72px] xl:text-[82px]">
              real life.
            </span>
          </h1>

          <p className="mt-4 max-w-[21rem] text-[14px] leading-6 text-[#f2dec7]/90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)] sm:mt-5 sm:max-w-[34rem] sm:text-[17px] sm:leading-8">
            {SITE.supporting}
          </p>

          {/* Price — the commercial headline of the page. */}
          <div className="mt-5 flex flex-col gap-2 sm:mt-6">
            <p className="tt-eyebrow flex items-center gap-3 text-[#f2dec7]/85">
              All sarees
              <span aria-hidden className="h-px w-8 bg-goldlight/50" />
            </p>
            <div className="flex items-center gap-3">
              <span className="font-display text-[52px] font-bold leading-none text-goldlight drop-shadow-[0_4px_18px_rgba(0,0,0,0.45)] sm:text-[70px] lg:text-[82px]">
                {formatINR(SITE.price)}
              </span>
              <span className="rounded-pill bg-accent px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white shadow-md shadow-black/25 sm:text-xs">
                Flat
              </span>
            </div>
          </div>

          <div className="mt-6 sm:mt-7">
            <CtaButtons />
          </div>

          <div className="mt-7 grid max-w-[42rem] grid-cols-3 gap-1.5 rounded-3xl border border-white/12 bg-black/22 p-2 text-[#f6ebdf] shadow-2xl shadow-black/25 backdrop-blur-md sm:gap-3 sm:p-3">
            {HERO_PROMISES.map(({ Icon, t, s }) => (
              <div key={t} className="flex min-w-0 items-center gap-1.5 px-1 py-2 sm:gap-2.5 sm:px-3">
                <Icon size={16} className="shrink-0 text-goldlight sm:size-5" strokeWidth={1.8} />
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-bold sm:text-[14px]">{t}</span>
                  <span className="block truncate text-[8px] text-[#e4cdb7]/75 sm:text-[12px]">{s}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Slide picker, treated like a small story strip over the image. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20">
        <div className="tt-container flex justify-end">
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-pill border border-white/15 bg-black/22 p-1.5 shadow-2xl shadow-black/30 backdrop-blur-md sm:gap-2 sm:p-2">
            {SLIDES.map((s, i) => (
              <button
                key={s.src}
                type="button"
                aria-label={`Show banner ${i + 1} of ${SLIDES.length}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={cx(
                  "relative h-9 w-12 overflow-hidden rounded-[10px] border transition-all duration-300 sm:h-12 sm:w-16 sm:rounded-[14px]",
                  i === index
                    ? "border-white shadow-[0_0_0_2px_rgba(255,255,255,0.28)]"
                    : "border-white/20 opacity-70 hover:opacity-100",
                )}
              >
                <Image
                  src={s.src}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                  style={{ objectPosition: s.position }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Editorial aside — right edge, desktop only, never competing with H1 */}
      <p
        aria-hidden
        className="absolute right-8 top-[24%] z-20 hidden max-w-[9rem] font-display text-2xl italic leading-snug text-[#fff7ec]/90 [text-shadow:0_2px_18px_rgba(0,0,0,0.55)] lg:block xl:text-[28px]"
      >
        Simple.
        <br />
        Beautiful.
        <br />
        Yours.
      </p>
    </section>
  );
}
