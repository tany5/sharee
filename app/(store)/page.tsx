import {
  ArrowRight,
  IndianRupee,
  RotateCcw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { InstagramIcon } from "@/components/icons/brand";
import { getCategories, getFeatured, getNewArrivals } from "@/lib/data/queries";
import { SITE } from "@/lib/site";
import { Hero } from "@/components/home/hero";
import { CategoriesRail } from "@/components/home/categories-rail";
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
      <Hero />

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
        <div className="mt-6">
          <CategoriesRail categories={categories} />
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
