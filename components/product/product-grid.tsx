import type { Product } from "@/lib/types";
import { ProductCard, type ProductCardData } from "@/components/product/product-card";
import { cx } from "@/lib/utils";

export function ProductGrid({
  products,
  cols = "auto",
  className,
}: {
  products: Product[];
  /** "auto" = compact responsive grid; "wide" = roomier for section pages. */
  cols?: "auto" | "wide";
  className?: string;
}) {
  return (
    <div
      className={cx(
        // Mobile 2-up (12px gutters), tablet 4-up, desktop 5-up — matches the
        // editorial homepage rows. "wide" stays roomier for listing pages.
        "grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-4 md:gap-x-5",
        cols === "wide"
          ? "md:grid-cols-3 xl:grid-cols-4"
          : "md:grid-cols-4 xl:grid-cols-5",
        className,
      )}
    >
      {products.map((p) => {
        const card: ProductCardData = {
          slug: p.slug,
          name: p.name,
          category: p.category,
          colorway: p.colorway,
          price: p.price,
          rating: p.rating,
          reviewCount: p.reviewCount,
          tags: p.tags,
          image: p.images?.[0],
          images: p.images,
        };
        return <ProductCard key={p.slug} product={card} />;
      })}
    </div>
  );
}
