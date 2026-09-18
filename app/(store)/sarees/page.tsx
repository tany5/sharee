import Link from "next/link";
import { SearchX } from "lucide-react";
import {
  getCategories,
  getFilterColors,
  getProducts,
  type SortKey,
} from "@/lib/data/queries";
import { SITE } from "@/lib/site";
import { ProductGrid } from "@/components/product/product-grid";
import {
  ListingSearch,
  SearchEvent,
  SortSelect,
} from "@/components/product/listing-tools";
import { ButtonLink, EmptyState } from "@/components/ui";
import { pageMetadata } from "@/lib/meta";
import { swatchFor } from "@/lib/color-dots";
import { cx } from "@/lib/utils";

export const metadata = pageMetadata({
  title: `All Sarees ₹199 — Daily Use Sarees, FREE Shipping | ${SITE.name}`,
  description: `Browse every saree at ${SITE.tagline} — made for daily use. Cotton, silk, printed, chiffon, georgette and fancy sarees at ₹199 flat, with FREE shipping across India (₹49 fee waived), easy returns and COD.`,
  path: "/sarees",
});

const SORTS: Record<string, SortKey> = {
  popular: "popular",
  newest: "newest",
  rating: "rating",
};

interface ListingParams {
  q?: string;
  category?: string;
  color?: string;
  tag?: string;
  sort?: string;
}

function toQuery(p: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) sp.set(k, v);
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export default async function SareesPage({
  searchParams,
}: {
  searchParams: Promise<ListingParams>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim();
  const category = sp.category?.trim();
  const color = sp.color?.trim();
  const tag = sp.tag?.trim();
  const sort: SortKey = SORTS[sp.sort ?? ""] ?? "popular";

  const [products, categories, colors] = await Promise.all([
    getProducts({ category, q, color, tag, sort }),
    getCategories(),
    getFilterColors(),
  ]);

  const filtersActive = Boolean(q || category || color || tag);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <SearchEvent q={q} />

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
            {SITE.tagline}
          </p>
          <h1 className="mt-1 text-3xl text-ink sm:text-4xl">All Sarees</h1>
          <p className="mt-1.5 text-sm text-ink2">
            {products.length} style{products.length === 1 ? "" : "s"}
            {q ? ` for “${q}”` : ""} · every saree {SITE.tagline.toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ListingSearch initial={q} />
          <SortSelect value={sort} />
        </div>
      </div>

      {/* Category chips */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/sarees"
          className={cx(
            "rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors",
            !category
              ? "border-accent bg-accent text-[#fffdf6]"
              : "border-line bg-surface text-ink2 hover:border-accent/60",
          )}
        >
          All
        </Link>
        {categories.map((c) => {
          const active = category === c.slug;
          const href = `/sarees${toQuery({ category: active ? undefined : c.slug, q, color, tag })}`;
          return (
            <Link
              key={c.slug}
              href={href}
              className={cx(
                "rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors",
                active
                  ? "border-accent bg-accent text-[#fffdf6]"
                  : "border-line bg-surface text-ink2 hover:border-accent/60",
              )}
            >
              {c.short}
            </Link>
          );
        })}
      </div>

      {/* Colour filter */}
      <div className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-2">
        <span className="mr-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
          Colour
        </span>
        {colors.map((c) => {
          const active = color === c;
          return (
            <Link
              key={c}
              href={`/sarees${toQuery({ color: active ? undefined : c, q, category, tag })}`}
              aria-label={`Filter by ${c}`}
              title={c}
              aria-pressed={active}
              className={cx(
                "flex h-9 w-9 items-center justify-center rounded-full border transition-all",
                active
                  ? "border-accent ring-2 ring-accent/50"
                  : "border-line hover:border-accent/60",
              )}
            >
              <span
                className="h-6 w-6 rounded-full"
                style={{ backgroundColor: swatchFor(c) }}
              />
            </Link>
          );
        })}
        {filtersActive && (
          <Link
            href="/sarees"
            className="ml-2 rounded-full px-3 py-1.5 text-[13px] font-semibold text-accent underline underline-offset-4"
          >
            Clear filters
          </Link>
        )}
      </div>

      {/* Results */}
      <div className="mt-8">
        {products.length === 0 ? (
          <EmptyState
            icon={<SearchX size={30} />}
            title="No sarees match those filters"
            body="Try a different colour or category — every saree in the store is still just ₹199."
            action={
              <ButtonLink href="/sarees" variant="outline">
                Show all sarees
              </ButtonLink>
            }
          />
        ) : (
          <ProductGrid products={products} cols="wide" />
        )}
      </div>
    </div>
  );
}
