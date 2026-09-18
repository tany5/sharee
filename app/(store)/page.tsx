import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCategories, getFeatured, getNewArrivals, getProducts } from "@/lib/data/queries";
import { SITE } from "@/lib/site";
import { Hero } from "@/components/home/hero";
import { CategoriesRail } from "@/components/home/categories-rail";
import { ReviewsSection } from "@/components/home/reviews-section";
import { InstagramGrid } from "@/components/home/instagram-grid";
import { BusinessBanner } from "@/components/home/business-banner";
import {
  CollectionTiles,
  PromoBanner,
  ShopByColour,
} from "@/components/home/extra-sections";
import { ProductGrid } from "@/components/product/product-grid";
import { SectionHeading } from "@/components/ui";
import { TrustStrip } from "@/components/home/trust-strip";
import { pageMetadata, storeJsonLd } from "@/lib/meta";
import { cx } from "@/lib/utils";

export const metadata = pageMetadata({
  title: `Sarees for Daily Use — All ₹199 with FREE Shipping | ${SITE.name}`,
  description: `${SITE.motto} Every saree — cotton, silk, printed, chiffon, georgette & fancy — just ₹199, made for everyday wear. FREE shipping all over India (₹49 fee waived), easy returns, COD. Quality checked before dispatch.`,
  path: "/",
});

/** Section-level "View all →" affordance. */
function ViewAll({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent transition-colors hover:text-accent2"
    >
      {label} <ArrowRight size={15} />
    </Link>
  );
}

export default async function HomePage() {
  // Five per row on desktop — the editorial layout shows a single clean row.
  const [categories, bestSellers, taggedNew] = await Promise.all([
    getCategories(),
    getFeatured(5),
    getNewArrivals(5),
  ]);

  // If nothing in the catalogue carries the "new" tag yet, fall back to the
  // genuinely newest items rather than showing an empty row. Best Sellers is
  // never faked — the section is hidden when no product is marked bestseller.
  const newArrivals = taggedNew.length
    ? taggedNew
    : await getProducts({ sort: "newest", limit: 5 });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: storeJsonLd() }}
      />

      {/* ------------------------------- Hero ------------------------------- */}
      <Hero />

      {/* --------------------------- Trust promises -------------------------- */}
      <TrustStrip />

      {/* ---------------------------- Categories ---------------------------- */}
      <section
        aria-label="Shop by category"
        className="tt-container py-12 lg:py-20"
      >
        <SectionHeading
          kicker="Shop by category"
          title="Find your saree"
          action={<ViewAll href="/categories" label="View all categories" />}
        />
        <div className="mt-7 lg:mt-9">
          <CategoriesRail categories={categories} />
        </div>
      </section>

      {/* ---------------------------- Best sellers -------------------------- */}
      {bestSellers.length > 0 && (
        <section
          aria-label="Best sellers"
          className="border-y border-line bg-bg2"
        >
          <div className="tt-container py-12 lg:py-20">
            <SectionHeading
              kicker="Trending now"
              title="Best Sellers"
              action={<ViewAll href="/sarees?tag=bestseller" label="View all" />}
            />
            <div className="mt-7 lg:mt-9">
              <ProductGrid products={bestSellers} />
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------- New arrivals -------------------------- */}
      {newArrivals.length > 0 && (
        <section
          aria-label="New arrivals"
          className={cx(
            "tt-container py-12 lg:py-20",
            bestSellers.length > 0 && "border-t border-line lg:border-t-0",
          )}
        >
          <SectionHeading
            kicker="New collections"
            title="New Arrivals"
            action={<ViewAll href="/sarees" label="View all" />}
          />
          <div className="mt-7 lg:mt-9">
            <ProductGrid products={newArrivals} />
          </div>
        </section>
      )}

      {/* ---------------------------- Shop by colour ------------------------- */}
      <ShopByColour />      

      {/* ------------------------- Category split tiles ---------------------- */}
      <CollectionTiles />

      {/* --------------------------- Promo banner ---------------------------- */}
      <PromoBanner />

      {/* ------------------------------ Reviews ----------------------------- */}
      <ReviewsSection />

      {/* -------------------------- Business banner -------------------------- */}
      <BusinessBanner />

      {/* ----------------------------- Instagram ---------------------------- */}
      <InstagramGrid />
    </>
  );
}
