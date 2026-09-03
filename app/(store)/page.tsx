import Link from "next/link";
import {
  ArrowRight,
  IndianRupee,
  RotateCcw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { InstagramIcon } from "@/components/icons/brand";
import {
  getCategories,
  getFeatured,
  getNewArrivals,
  getProductBySlug,
} from "@/lib/data/queries";
import { SITE } from "@/lib/site";
import { artForCategory } from "@/lib/art";
import { artForProduct } from "@/lib/art";
import SareeArt from "@/components/product/saree-art";
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

const HERO_SLUG = "beautiful-banarasi-silk-saree";

export default async function HomePage() {
  const [categories, bestSellers, newArrivals, heroProduct] = await Promise.all([
    getCategories(),
    getFeatured(8),
    getNewArrivals(4),
    getProductBySlug(HERO_SLUG),
  ]);

  const hero = heroProduct ?? bestSellers[0];

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
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_78%_20%,rgba(135,138,93,0.16),transparent_60%),radial-gradient(50%_70%_at_10%_85%,rgba(136,102,68,0.12),transparent_60%)]"
        />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.02fr_1fr] lg:gap-6 lg:py-16">
          {/* Copy */}
          <div className="relative z-10 text-center lg:text-left">
            <p className="inline-flex items-center gap-2 rounded-full border border-bronze/40 bg-surface px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-bronze">
              The Ambika promise
            </p>
            <h1 className="mt-5 font-display text-[44px] font-bold leading-[0.98] text-ink sm:text-6xl lg:text-[76px]">
              All Sarees
              <span className="mt-2 block text-accent">{formatINR(SITE.price)}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-md text-lg leading-7 text-ink2 lg:mx-0">
              Beautiful sarees. One simple price. Quality handloom weaves,
              delivered across India — no markups, no confusion.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <ButtonLink href="/sarees" size="lg" className="min-w-52">
                Shop All Sarees <ArrowRight size={18} />
              </ButtonLink>
              <ButtonLink href="/categories" size="lg" variant="outline">
                Explore Categories
              </ButtonLink>
            </div>

            <div className="mt-7 flex items-center justify-center gap-3 text-sm text-ink2 lg:justify-start">
              <Stars rating={4.8} size={15} />
              <span>
                <strong className="text-ink">4.8/5</strong> · 2,000+ happy
                customers
              </span>
            </div>
            <p className="mt-3 text-[13px] text-muted">
              COD available · Easy 7-day returns · Free shipping above ₹999
            </p>
          </div>

          {/* Visual */}
          <div className="relative mx-auto w-full max-w-[300px] sm:max-w-[340px] lg:max-w-[400px]">
            <div
              aria-hidden
              className="absolute -inset-6 rounded-full bg-bronze/15 blur-2xl"
            />
            <div className="relative aspect-[3/4.1] overflow-hidden rounded-t-[999px] ring-1 ring-line shadow-2xl shadow-ink/20">
              {hero && (
                <SareeArt
                  spec={artForProduct(hero.slug, hero.colorway, hero.category)}
                  label={`${hero.name} — saree at ₹199`}
                  className="absolute inset-0 h-full w-full"
                />
              )}
            </div>
            {/* floating chips */}
            <div className="absolute -left-6 top-16 hidden rounded-xl border border-line bg-surface px-4 py-3 shadow-lg shadow-ink/10 sm:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                Every saree
              </p>
              <p className="font-display text-2xl font-bold text-ink">
                {formatINR(SITE.price)}
              </p>
            </div>
            <div className="absolute -right-4 bottom-16 flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-lg shadow-ink/10">
              <Truck size={16} className="text-bronze" />
              <p className="text-xs font-semibold text-ink2">
                Free shipping <span className="text-muted">on ₹999+</span>
              </p>
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
                <SareeArt
                  spec={artForCategory(c.slug)}
                  label={`${c.name} collection`}
                  crop="portrait"
                  className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-[1.05]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
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
