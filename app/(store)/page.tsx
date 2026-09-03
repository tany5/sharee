import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  IndianRupee,
  RotateCcw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { InstagramIcon } from "@/components/icons/brand";
import { getCategories, getFeatured, getNewArrivals } from "@/lib/data/queries";
import { SITE } from "@/lib/site";
import { categoryPhoto, HERO_PHOTO } from "@/lib/photos";
import { ProductGrid } from "@/components/product/product-grid";
import { ButtonLink, Ornament, SectionHeading, Stars } from "@/components/ui";
import { formatINR } from "@/lib/format";
import { pageMetadata, storeJsonLd } from "@/lib/meta";

export const metadata = pageMetadata({
  title: `Shop ${SITE.tagline} Online`,
  description:
    `${SITE.tagline} — ${SITE.promise} Cotton, silk, printed, chiffon, georgette and fancy sarees. Quality assured, easy returns, COD, free shipping over ₹999.`,
  path: "/",
});

const REVIEWS = [
  {
    name: "Riya S.",
    place: "Kolkata",
    text: "Three Banarasi sarees for less than the price of one elsewhere. The zari and fall genuinely surprised me.",
  },
  {
    name: "Meera K.",
    place: "Chennai",
    text: "Ordered on Monday, wore it to my cousin's engagement on Friday. Beautiful drape, zero regrets.",
  },
  {
    name: "Sneha P.",
    place: "Pune",
    text: "At ₹199 I expected a compromise. This was the opposite — rich colours and soft fabric. Bought three more.",
  },
];

export default async function HomePage() {
  const [categories, bestSellers, newArrivals] = await Promise.all([
    getCategories(),
    getFeatured(8),
    getNewArrivals(4),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: storeJsonLd() }}
      />

      {/* ------------------------------- Hero ------------------------------- */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_75%_at_82%_18%,rgba(135,138,93,0.18),transparent_62%),radial-gradient(45%_65%_at_8%_88%,rgba(136,102,68,0.14),transparent_60%)]"
        />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:py-20">
          {/* Copy */}
          <div className="relative z-10 text-center lg:text-left">
            <p className="inline-flex items-center gap-2 rounded-full border border-bronze/40 bg-surface px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-bronze">
              <span className="h-1.5 w-1.5 rotate-45 bg-bronze" aria-hidden />
              Beautiful sarees · one simple price
            </p>

            <h1 className="mt-5 font-display font-bold leading-[0.92] text-ink">
              <span className="block text-[40px] sm:text-6xl lg:text-[64px]">
                All Sarees
              </span>
              <span className="mt-1 block text-[92px] tracking-tight text-accent sm:text-[130px] lg:text-[150px]">
                {formatINR(SITE.price)}
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-md text-lg leading-7 text-ink2 lg:mx-0">
              Beautiful sarees. One simple price. Quality weaves worn by real
              women, delivered across India — no markups, no confusion.
            </p>

            {/* Trust badges */}
            <div className="mx-auto mt-7 flex max-w-md items-stretch justify-center divide-x divide-line/70 lg:mx-0 lg:justify-start">
              {[
                { Icon: ShieldCheck, t: "Quality Assured", s: "Best fabric & finishing" },
                { Icon: RotateCcw, t: "Easy Returns", s: "7-day hassle-free" },
                { Icon: Truck, t: "Fast Delivery", s: "Across India" },
              ].map(({ Icon, t, s }) => (
                <div key={t} className="flex flex-1 flex-col items-center gap-1 px-2 text-center lg:flex-row lg:gap-2.5 lg:px-4 lg:text-left">
                  <Icon size={20} className="shrink-0 text-bronze" strokeWidth={1.7} />
                  <div>
                    <p className="text-[12px] font-bold leading-tight text-ink">{t}</p>
                    <p className="text-[10px] text-muted">{s}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <ButtonLink href="/sarees" size="lg" className="min-w-56">
                Shop All Sarees <ArrowRight size={18} />
              </ButtonLink>
              <ButtonLink href="/categories" size="lg" variant="outline">
                Explore Collections
              </ButtonLink>
            </div>

            {/* Social proof */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 lg:justify-start">
              <div className="flex items-center gap-2.5">
                <div className="flex -space-x-2.5">
                  {[1, 2, 3].map((n) => (
                    <span
                      key={n}
                      aria-hidden
                      className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-bg bg-accent/25 text-[11px] font-bold text-ink"
                    >
                      {["R", "S", "A"][n - 1]}
                    </span>
                  ))}
                </div>
                <div className="text-left">
                  <p className="text-[13px] font-bold leading-tight text-ink">
                    10,000+ happy customers
                  </p>
                  <p className="text-[11px] text-muted">loved across India ♥</p>
                </div>
              </div>
              <div className="h-8 w-px bg-line" aria-hidden />
              <div className="text-left">
                <Stars rating={4.8} size={14} />
                <p className="mt-0.5 text-[11px] text-muted">
                  <strong className="text-ink">4.8/5</strong> · 2,500+ reviews
                </p>
              </div>
            </div>
          </div>

          {/* Worn photo — a woman in a maroon-gold saree */}
          <div className="relative mx-auto w-full max-w-[320px] sm:max-w-[360px] lg:max-w-[430px]">
            <div
              aria-hidden
              className="absolute -inset-8 rounded-full bg-bronze/20 blur-3xl"
            />
            {/* Ornament frame */}
            <div
              aria-hidden
              className="absolute -left-3 -top-3 h-16 w-16 rotate-12 rounded-br-[2.5rem] border-r-2 border-t-2 border-bronze/60"
            />
            <div className="relative aspect-[3/4.2] overflow-hidden rounded-t-[999px] rounded-b-[2rem] ring-1 ring-line shadow-2xl shadow-ink/25">
              <Image
                src={HERO_PHOTO}
                alt="Woman wearing a maroon and gold Banarasi saree — all sarees at ₹199"
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 80vw"
                className="object-cover object-top"
              />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" aria-hidden />
              {/* ₹199 badge on the photo */}
              <span className="absolute left-4 top-4 rounded-full bg-surface/95 px-4 py-2 font-display text-xl font-bold text-ink shadow-lg backdrop-blur">
                {formatINR(SITE.price)}
                <span className="ml-1.5 text-[11px] font-sans font-bold uppercase tracking-widest text-bronze">
                  All sarees
                </span>
              </span>
              <span className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-[#7c2d3a]/95 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-[#f9eeda] shadow-lg backdrop-blur">
                <BadgeCheck size={14} /> Worn, styled & verified
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------- Value props --------------------------- */}
      <section className="border-y border-line bg-surface/60">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-6 px-4 py-7 sm:px-6 md:grid-cols-4">
          {[
            { Icon: IndianRupee, t: "All Sarees ₹199", s: "One simple price" },
            { Icon: ShieldCheck, t: "Quality Assured", s: "Best fabric & finishing" },
            { Icon: RotateCcw, t: "Easy Returns", s: "7-day hassle-free" },
            { Icon: Truck, t: "Fast Delivery", s: "3–5 days, all India" },
          ].map(({ Icon, t, s }) => (
            <div key={t} className="flex items-center gap-3 md:justify-center">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Icon size={21} strokeWidth={1.7} />
              </span>
              <div>
                <p className="text-[13px] font-bold text-ink">{t}</p>
                <p className="text-xs text-muted">{s}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------- Categories ---------------------------- */}
      <section className="mx-auto mt-14 max-w-7xl px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <SectionHeading kicker="Shop by category" title="Find your weave" className="mb-0" />
          <ButtonLink
            href="/categories"
            variant="ghost"
            size="sm"
            className="mb-1 hidden sm:inline-flex"
          >
            View all <ArrowRight size={15} />
          </ButtonLink>
        </div>
        <div className="-mx-4 mt-6 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-6">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/categories/${c.slug}`}
              className="group w-[58vw] max-w-[240px] shrink-0 snap-start sm:w-[40vw] md:w-auto md:max-w-none"
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-line/80 transition-shadow group-hover:shadow-lg group-hover:shadow-ink/10">
                {categoryPhoto(c.slug) && (
                  <Image
                    src={categoryPhoto(c.slug)!}
                    alt={`${c.name} — woman wearing the saree`}
                    fill
                    sizes="(min-width: 1024px) 16vw, 40vw"
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
      </section>

      {/* --------------------------- Best sellers -------------------------- */}
      <section className="mx-auto mt-14 max-w-7xl px-4 sm:px-6">
        <div className="flex items-end justify-between">
          <SectionHeading kicker="Customer favourites" title="Best Sellers" className="mb-0" />
          <ButtonLink
            href="/sarees?tag=bestseller"
            variant="ghost"
            size="sm"
            className="mb-1 hidden sm:inline-flex"
          >
            View all <ArrowRight size={15} />
          </ButtonLink>
        </div>
        <div className="mt-6">
          <ProductGrid products={bestSellers} />
        </div>
      </section>

      {/* --------------------------- New arrivals -------------------------- */}
      <section className="mx-auto mt-14 max-w-7xl px-4 sm:px-6">
        <div className="flex items-end justify-between">
          <SectionHeading kicker="Just landed" title="New Arrivals" className="mb-0" />
          <ButtonLink
            href="/sarees?tag=new"
            variant="ghost"
            size="sm"
            className="mb-1 hidden sm:inline-flex"
          >
            View all <ArrowRight size={15} />
          </ButtonLink>
        </div>
        <div className="mt-6">
          <ProductGrid products={newArrivals} />
        </div>
      </section>

      {/* ------------------------------ Reviews ---------------------------- */}
      <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
        <div className="rounded-[2rem] border border-line bg-surface px-5 py-10 sm:px-10">
          <div className="text-center">
            <Ornament className="mb-5" />
            <h2 className="text-2xl text-ink sm:text-3xl">
              Real customers, real sarees
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink2">
              Every order is quality-checked before it ships. Here is what
              buyers say about their {formatINR(SITE.price)} sarees.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {REVIEWS.map((r) => (
              <figure key={r.name} className="rounded-2xl border border-line bg-bg/60 p-5">
                <Stars rating={5} size={13} />
                <blockquote className="mt-3 text-sm leading-6 text-ink2">“{r.text}”</blockquote>
                <figcaption className="mt-4 text-[13px] font-bold text-ink">
                  {r.name} <span className="font-normal text-muted">· {r.place}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------- Instagram ---------------------------- */}
      <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-5 rounded-[2rem] border border-bronze/35 bg-gradient-to-br from-surface via-surface to-bronze/10 px-6 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
            <InstagramIcon width={26} height={26} strokeWidth={1.7} />
          </span>
          <h2 className="text-2xl text-ink sm:text-3xl">@ambikasarees</h2>
          <p className="max-w-md text-sm leading-6 text-ink2">
            Tag your look with <strong className="text-ink">#AmbikaSarees</strong> —
            the best daily-wear drapes from our community, featured every week.
          </p>
          <ButtonLink
            href="https://www.instagram.com/"
            size="md"
            variant="outline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Follow us on Instagram
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
