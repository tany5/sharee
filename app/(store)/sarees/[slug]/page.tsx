import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  getCategories,
  getProductBySlug,
  getRelated,
} from "@/lib/data/queries";
import { ProductPage } from "@/components/product/product-page";
import { productJsonLd, productMetadata } from "@/lib/meta";

interface Params {
  slug: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  return productMetadata(product);
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const [product, categories] = await Promise.all([
    getProductBySlug(slug),
    getCategories(),
  ]);
  if (!product) notFound();

  const related = await getRelated(product, 4);
  const category = categories.find((c) => c.slug === product.category);

  return (
    <div className="pb-6 md:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: productJsonLd(product) }}
      />

      {/* Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className="mx-auto max-w-7xl px-4 pt-5 sm:px-6"
      >
        <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
          <li><Link href="/" className="hover:text-ink2">Home</Link></li>
          <li aria-hidden><ChevronRight size={12} /></li>
          <li><Link href="/sarees" className="hover:text-ink2">All Sarees</Link></li>
          {category && (
            <>
              <li aria-hidden><ChevronRight size={12} /></li>
              <li>
                <Link href={`/categories/${category.slug}`} className="hover:text-ink2">
                  {category.name}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden><ChevronRight size={12} /></li>
          <li className="max-w-[200px] truncate text-ink2 sm:max-w-none">
            {product.name}
          </li>
        </ol>
      </nav>

      <ProductPage product={product} related={related} />
    </div>
  );
}
