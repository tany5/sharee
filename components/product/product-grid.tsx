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
        "grid gap-x-4 gap-y-8",
        cols === "wide"
          ? "grid-cols-2 gap-x-5 md:grid-cols-3 xl:grid-cols-4"
          : "grid-cols-2 md:grid-cols-3 xl:grid-cols-4",
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
