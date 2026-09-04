import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  getCategories,
  getProducts,
  type SortKey,
} from "@/lib/data/queries";
import { isSupabaseBackend } from "@/lib/backend/env";
import { SITE } from "@/lib/site";
import { ProductGrid } from "@/components/product/product-grid";
import { SortSelect } from "@/components/product/listing-tools";
import { categoryMetadata } from "@/lib/meta";
import { cx } from "@/lib/utils";

interface Params {
  slug: string;
}

const SORTS: Record<string, SortKey> = {
  popular: "popular",
  newest: "newest",
  rating: "rating",
};

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const categories = await getCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) return {};
  return categoryMetadata(
    category.name,
    category.blurb,
    `/categories/${category.slug}`,
  );
}

export async function generateStaticParams() {
  // The Supabase backend needs an HTTP request (cookies → auth/RLS), so it
  // cannot run at build time. In Supabase mode the catalogue is also
  // admin-managed, so nothing is prerendered — pages render on demand
  // (dynamicParams defaults to true). Demo mode prerenders from the seed.
  if (isSupabaseBackend()) return [];
  const categories = await getCategories();
  return categories.map((c) => ({ slug: c.slug }));
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { slug } = await params;
  const { sort: sortParam } = await searchParams;
  const sort: SortKey = SORTS[sortParam ?? ""] ?? "popular";

  const [categories, category, products] = await Promise.all([
    getCategories(),
    getCategories().then((cs) => cs.find((c) => c.slug === slug)),
    getProducts({ category: slug, sort }),
  ]);

  if (!category) notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-xs text-muted">
        <Link href="/" className="hover:text-ink2">Home</Link>
        <ChevronRight size={12} />
        <Link href="/categories" className="hover:text-ink2">Categories</Link>
        <ChevronRight size={12} />
        <span className="text-ink2">{category.name}</span>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
            {category.count} styles · {SITE.tagline}
          </p>
          <h1 className="mt-1 text-3xl text-ink sm:text-4xl">{category.name}</h1>
          <p className="mt-1.5 max-w-xl text-sm leading-6 text-ink2">
            {category.blurb} Every saree {SITE.tagline.toLowerCase()}, quality
            checked and delivered in 3–5 days.
          </p>
        </div>
        <SortSelect value={sort} />
      </div>

      {/* Sibling categories */}
      <div className="mt-6 flex flex-wrap gap-2">
        {categories.map((c) => {
          const active = c.slug === slug;
          return (
            <Link
              key={c.slug}
              href={`/categories/${c.slug}`}
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

      <div className="mt-8">
        <ProductGrid products={products} cols="wide" />
      </div>
    </div>
  );
}
