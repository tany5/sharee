"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Heart, Plus, ShoppingCart } from "lucide-react";
import { artForProduct } from "@/lib/art";
import { productPhotoAltThumb, productPhotoThumb } from "@/lib/photos";
import { CardCarousel, type CardSlide } from "@/components/product/card-carousel";
import { Stars } from "@/components/ui";
import { useCart, useWishlist } from "@/components/store/providers";
import { trackAddToCart } from "@/lib/analytics";
import { formatINR } from "@/lib/format";
import { cx } from "@/lib/utils";

export interface ProductCardData {
  slug: string;
  name: string;
  category: string;
  colorway: string;
  price: number;
  rating: number;
  reviewCount: number;
  tags: string[];
  /** Optional real photo URL (uploaded / demo-DB image). */
  image?: string;
  /** Optional real gallery URLs (uploaded / AI-generated). */
  images?: string[];
}

function TagBadge({ tag }: { tag: string }) {
  const isNew = tag === "new";
  return (
    <span
      className={cx(
        "rounded-pill px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
        isNew
          ? "bg-accent text-white"
          : "border border-bronze/40 bg-surface/90 text-bronze backdrop-blur",
      )}
    >
      {tag === "new" ? "New" : "Bestseller"}
    </span>
  );
}

function imagePoseRank(url: string): number {
  const text = url.toLowerCase();
  if (/(^|[-_/])front[-_/.]/.test(text)) return 0;
  if (/(^|[-_/])side[-_/.]/.test(text)) return 1;
  if (/(^|[-_/])back[-_/.]/.test(text)) return 2;
  if (/(^|[-_/])full[-_]?saree[-_/.]/.test(text)) return 3;
  return 4;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const { add } = useCart();
  const { has, toggle } = useWishlist();
  const [justAdded, setJustAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wished = has(product.slug);
  const primaryImage = product.images?.[0] ?? product.image;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const quickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    add(product.slug, product.colorway, 1, {
      name: product.name,
      price: product.price,
      image: primaryImage,
    });
    trackAddToCart(product.slug, product.name);
    setJustAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setJustAdded(false), 1400);
  };

  // Every saree gets at least 3 images: the primary "worn" shot, a second
  // worn shot, and a fabric-only artwork. Admin-uploaded photos come first.
  const art = artForProduct(product.slug, product.colorway, product.category);
  const slides: CardSlide[] = [];
  const savedImages = product.images?.length
    ? [...product.images].sort((a, b) => imagePoseRank(a) - imagePoseRank(b))
    : product.image ? [product.image] : [];
  if (savedImages.length > 0) {
    for (const src of savedImages.slice(0, 5)) {
      slides.push({
        kind: "img",
        src,
        alt: `${product.name} saree at ${formatINR(product.price)}`,
      });
    }
  } else {
    const worn1 = productPhotoThumb(product.slug);
    const worn2 = productPhotoAltThumb(product.slug);
    if (worn1) {
      slides.push({
        kind: "img",
        src: worn1,
        alt: `${product.name} saree at ${formatINR(product.price)} — worn by a woman`,
      });
    }
    if (worn2) {
      slides.push({
        kind: "img",
        src: worn2,
        alt: `${product.name} saree at ${formatINR(product.price)} — worn by a woman, alternate shot`,
      });
    }
    slides.push({
      kind: "art",
      spec: art,
      label: `${product.name} saree at ${formatINR(product.price)} — the saree alone`,
    });
  }

  return (
    <div className="group relative overflow-hidden rounded-card border border-line bg-surface transition-colors duration-300 hover:border-accent/40">
      <Link
        href={`/sarees/${product.slug}`}
        className="block focus:outline-none"
        aria-label={product.name}
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-bg2 [&_img]:saturate-[1.12]">
          <CardCarousel slides={slides} />
          {product.tags.length > 0 && (
            <span className="absolute bottom-2.5 left-2.5 z-10">
              <TagBadge tag={product.tags[0]} />
            </span>
          )}
        </div>

        <div className="space-y-1.5 p-3 sm:p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
            {product.category.replace("-sarees", "").replace("-", " ")} saree
          </p>
          <h3 className="line-clamp-2 text-[14px] font-medium leading-snug text-ink sm:text-[15px]">
            {product.name}
          </h3>
          <p className="font-display text-[19px] font-semibold leading-none text-ink sm:text-xl">
            {formatINR(product.price)}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-muted sm:text-xs">
            <Stars rating={product.rating} size={12} />
            <span>({product.reviewCount})</span>
          </div>
        </div>
      </Link>

      {/* Action layer — matches the image box exactly so the controls never
          drift onto the copy below. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[4/5]">
        {/* Wishlist */}
        <button
          type="button"
          onClick={() => toggle(product.slug)}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={wished}
          className={cx(
            "pointer-events-auto absolute right-2.5 top-2.5 z-20 flex h-9 w-9 items-center justify-center rounded-pill border border-line bg-surface/90 shadow-sm backdrop-blur transition-colors",
            wished ? "text-accent" : "text-ink2 hover:text-ink",
          )}
        >
          <Heart size={16} className={wished ? "fill-current" : ""} />
        </button>

        {/* Quick add — the + rotates into a cart icon on hover, with a tooltip */}
        <button
          type="button"
          onClick={quickAdd}
          aria-label={`Add ${product.name} to cart`}
          className={cx(
            "group/qa pointer-events-auto absolute bottom-2.5 right-2.5 z-20 flex h-10 w-10 items-center justify-center rounded-pill shadow-md transition-all duration-300",
            justAdded
              ? "bg-success text-white hover:scale-105"
              : "bg-accent text-white hover:scale-105 hover:bg-accent-light",
          )}
        >
        {justAdded ? (
          <Check size={19} strokeWidth={2.4} />
        ) : (
          <span aria-hidden className="relative flex h-5 w-5 items-center justify-center">
            <Plus
              size={20}
              strokeWidth={2.4}
              className={cx(
                "absolute transition-all duration-300 ease-out",
                "rotate-0 opacity-100 group-hover/qa:rotate-90 group-hover/qa:scale-0 group-hover/qa:opacity-0",
              )}
            />
            <ShoppingCart
              size={19}
              strokeWidth={2.1}
              className={cx(
                "absolute transition-all duration-300 ease-out",
                "-rotate-90 scale-0 opacity-0 group-hover/qa:rotate-0 group-hover/qa:scale-100 group-hover/qa:opacity-100",
              )}
            />
          </span>
        )}
          {/* Tooltip */}
          <span
            aria-hidden
            className={cx(
              "pointer-events-none absolute right-full top-1/2 mr-2.5 hidden -translate-y-1/2 whitespace-nowrap rounded-pill px-3 py-1.5 text-[11px] font-semibold shadow-lg transition-all duration-200 md:block",
              "bg-ink text-bg",
              justAdded
                ? "opacity-100"
                : "translate-x-1 opacity-0 group-hover/qa:translate-x-0 group-hover/qa:opacity-100",
            )}
          >
            {justAdded ? "Added to cart ✓" : "Add to cart"}
          </span>
        </button>
      </div>
    </div>
  );
}
