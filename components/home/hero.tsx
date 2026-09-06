"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  RotateCcw,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react";
import { formatINR } from "@/lib/format";
import { SITE } from "@/lib/site";
import { cx } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Slides — banner photography of women wearing sarees, crossfaded in */
/*  the hero canvas (public/banner, WebP-optimized).                  */
/* ------------------------------------------------------------------ */

const SLIDES = [
  {
    src: "/banner/banner-1.webp",
    alt: "Woman wearing a maroon and gold Banarasi saree with gajra flowers",
  },
  {
    src: "/banner/banner-2.webp",
    alt: "Woman wearing an off-white saree with pink floral border",
  },
  {
    src: "/banner/banner-3.webp",
    alt: "Woman wearing a deep green silk saree with gold zari border",
  },
  {
    src: "/banner/banner-4.webp",
    alt: "Woman wearing a maroon silk saree with gold zari embroidery",
  },
  {
    src: "/banner/banner-5.webp",
    alt: "Woman wearing a golden silk saree, graceful drape",
  },
];

const AVATAR_LETTERS = ["R", "S", "A"];

/* ----------------------------- building blocks ----------------------------- */

function FeatureBadges() {
  const items = [
    { Icon: ShieldCheck, t: "Quality Assured", s: "Best fabric & finishing" },
    { Icon: RotateCcw, t: "Easy Returns", s: "7-day hassle-free" },
    { Icon: Truck, t: "Fast Delivery", s: "Across India" },
  ];
  return (
    <div className="flex items-stretch justify-center divide-x divide-white/15 lg:justify-start lg:divide-line">
      {items.map(({ Icon, t, s }) => (
        <div
          key={t}
          className="flex flex-col items-center gap-1 px-3 text-center sm:flex-row sm:gap-2.5 sm:px-5 sm:text-left"
        >
          <Icon
            size={20}
            strokeWidth={1.7}
            className="shrink-0 text-[#f4d9a4] lg:size-7 lg:text-bronze"
          />
          <div>
            <p className="text-[15px] font-bold leading-snug text-[#fdf3e3] sm:text-xl lg:text-2xl lg:text-ink lg:[text-shadow:0_1px_2px_rgba(59,28,5,0.35),0_0_18px_rgba(253,243,227,0.6)] dark:lg:[text-shadow:0_1px_3px_rgba(20,8,0,0.9),0_0_18px_rgba(20,8,0,0.55)]">
              {t}
            </p>
            <p className="text-[13px] leading-snug text-[#e5cfa4]/90 sm:text-base lg:text-[17px] lg:text-muted lg:[text-shadow:0_1px_2px_rgba(59,28,5,0.35),0_0_14px_rgba(253,243,227,0.55)] dark:lg:[text-shadow:0_1px_3px_rgba(20,8,0,0.9),0_0_14px_rgba(20,8,0,0.5)]">
              {s}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function CtaButtons() {
  const base =
    "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 text-sm font-bold tracking-wide transition-colors sm:h-12 sm:px-7 sm:text-[15px]";
  const primary =
    "bg-[#f7ead2] text-[#3b1c05] hover:bg-white lg:bg-btn lg:text-btntext lg:hover:opacity-90";
  const secondary =
    "border border-white/60 text-[#fdf3e3] hover:bg-white/10 lg:border-accent/60 lg:text-ink lg:hover:bg-accent/10";
  return (
    <div className="flex items-center justify-center gap-3 lg:justify-start">
      <Link href="/sarees" className={cx(base, primary, "flex-1 sm:flex-none")}>
        Shop All Sarees <ArrowRight size={17} />
      </Link>
      <Link
        href="/categories"
        className={cx(base, secondary, "flex-1 sm:flex-none")}
      >
        Explore Collections
      </Link>
    </div>
  );
}

/** "10,000+ happy customers · loved across India" proof chip. */
function SocialProof() {
  return (
    <div className="flex w-full max-w-2xl items-center justify-between gap-3 rounded-full border border-white/25 bg-black/25 py-3 pl-3 pr-5 backdrop-blur-md sm:gap-5 sm:pl-3.5 lg:border-line lg:bg-surface/95 lg:py-3 lg:shadow-lg lg:shadow-ink/5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex shrink-0 -space-x-3">
          {AVATAR_LETTERS.map((l) => (
            <span
              key={l}
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#3b2210] bg-[#f4d9a4]/90 text-xs font-bold text-[#4a2410] sm:h-11 sm:w-11 lg:border-bg lg:bg-accent/25 lg:text-ink"
            >
              {l}
            </span>
          ))}
        </div>
        <div className="min-w-0 text-left">
          <p className="truncate text-[15px] font-bold leading-tight text-[#fdf3e3] sm:text-[17px] lg:text-lg lg:text-ink">
            10,000+ Happy Customers
          </p>
          <p className="truncate text-[13px] leading-tight text-[#e5cfa4] sm:text-sm lg:text-[15px] lg:text-muted">
            Loved across India ♥
          </p>
        </div>
      </div>
      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        <span
          className="inline-flex items-center gap-0.5 text-[#f4d9a4] lg:text-bronze"
          role="img"
          aria-label="Rated 4.8 out of 5"
        >
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} size={15} className="fill-current" />
          ))}
        </span>
        <span className="whitespace-nowrap text-[13px] leading-tight text-[#e5cfa4] sm:text-sm lg:text-[15px] lg:text-muted">
          <strong className="text-[#fdf3e3] lg:text-ink">4.8/5</strong> · 2,500+
          reviews
        </span>
      </div>
    </div>
  );
}

/* --------------------------------- hero --------------------------------- */

export function Hero() {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % SLIDES.length),
      6000,
    );
    return () => clearInterval(id);
  }, [reducedMotion]);

  return (
    <section
      className="relative isolate flex flex-col overflow-hidden bg-bg min-h-[calc(100svh-10.875rem-env(safe-area-inset-bottom))] lg:min-h-[calc(100svh-9.4rem)]"
      aria-label="All sarees at one simple price"
    >
      {/* Photo canvas — full-bleed on every screen; on desktop a wide
          left-edge feather + theme wash keep the copy column readable
          while the photo still peeks through on the left. */}
      <div className="absolute inset-0">
        {SLIDES.map((s, i) => (
          <Image
            key={s.src}
            src={s.src}
            alt={s.alt}
            fill
            sizes="(min-width: 1024px) 100vw, 100vw"
            priority={i === 0}
            loading="eager"
            className={cx(
              "object-cover object-[62%_20%] transition-[opacity,transform] duration-[1600ms] ease-out motion-reduce:transition-none lg:object-[40%_20%] lg:[mask-image:linear-gradient(to_right,transparent_0%,black_26%,black_100%)] lg:[-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_26%,black_100%)]",
              i === index
                ? "scale-[1.05] opacity-100"
                : "scale-100 opacity-0",
            )}
          />
        ))}

        {/* Desktop-only wash: theme-tinted gradient under the copy column.
            Low z-index (below the copy, above the photo only on the far left)
            and kept to ~50% width so the photo stays visible on the left too.
            It just lifts the headline zone for readability. */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 z-[1] hidden w-[52%] bg-gradient-to-r from-bg via-bg/70 to-transparent lg:block dark:from-bg dark:via-bg/70 dark:to-transparent"
        />

        {/* Mobile: blend the photo into a deep warm scrim so copy stays legible */}
        <div
          aria-hidden
          className="absolute inset-0 z-[1] bg-gradient-to-t from-[#180b02] via-[#180b02]/60 via-35% to-[#180b02]/10 lg:hidden"
        />
      </div>

      {/* Slide indicator */}
      <div className="absolute right-4 top-4 z-30 flex items-center gap-1.5 lg:right-8 lg:top-6">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Show banner ${i + 1} of ${SLIDES.length}`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            className={cx(
              "h-1.5 rounded-full transition-all duration-500",
              i === index
                ? "w-6 bg-[#f7ead2] ring-1 ring-black/20"
                : "w-1.5 bg-[#f7ead2]/50 ring-1 ring-black/10 hover:bg-[#f7ead2]/80",
            )}
          />
        ))}
      </div>

      {/* Copy — bottom-anchored on mobile; on desktop spread top → bottom
          like the reference: tagline/headline up top, CTA + proof pinned low */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-4 pb-6 pt-2 sm:px-6 lg:justify-between lg:px-8 lg:pb-12 lg:pt-16">
        <div className="flex w-full flex-col items-center gap-4 text-center lg:max-w-2xl lg:items-start lg:gap-6 lg:text-left">
          {/* Tagline — editorial eyebrow: ornament above, plain text below
              (no pill), like the reference banner */}
          <div className="flex flex-col items-center gap-2 lg:items-start">
            <span
              aria-hidden
              className="flex items-center gap-2 text-[#f4d9a4] lg:text-accent"
            >
              <span className="h-px w-9 bg-current opacity-70" />
              <span className="h-1.5 w-1.5 rotate-45 border border-current bg-current/50" />
              <span className="h-px w-9 bg-current opacity-70" />
            </span>
            <p className="text-center text-[11px] font-bold uppercase tracking-[0.24em] text-[#f4d9a4] sm:text-xs lg:text-left lg:text-accent">
              Beautiful sarees · one simple price
            </p>
          </div>

          {/* Headline */}
          <h1
            className={cx(
              "font-display font-bold leading-[0.95]",
              "text-[#fdf3e3] lg:text-ink",
            )}
          >
            <span className="block text-[40px] sm:text-6xl lg:text-6xl xl:text-7xl">
              All Sarees
            </span>
            <span
              className={cx(
                "mt-0.5 block text-[88px] leading-[0.9] tracking-tight sm:text-[110px] lg:text-[140px] xl:text-[160px]",
                "text-[#f4d9a4] lg:text-accent",
              )}
            >
              {formatINR(SITE.price)}
            </span>
          </h1>

          <FeatureBadges />
        </div>

        {/* Bottom dock — action buttons + proof, pinned low on desktop, above
            the mobile nav on phones */}
        <div className="mx-auto mt-10 flex w-full flex-col items-center gap-4 sm:mt-12 sm:gap-5 lg:mx-0 lg:mt-16 lg:items-start">
          <CtaButtons />
          <SocialProof />
        </div>
      </div>
    </section>
  );
}
