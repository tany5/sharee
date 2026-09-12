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
        "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
        isNew
          ? "bg-[#5d350e]/90 text-[#f6ebd9]"
          : "bg-[#878a5d]/90 text-[#fffdf6]",
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
    <div className="group relative">
      <Link
        href={`/sarees/${product.slug}`}
        className="block focus:outline-none"
        aria-label={product.name}
      >
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-line/80 transition-shadow group-hover:shadow-lg group-hover:shadow-ink/10">
          <CardCarousel slides={slides} />
          {product.tags.length > 0 && (
            <span className="absolute left-2.5 top-2.5 z-10">
              <TagBadge tag={product.tags[0]} />
            </span>
          )}
        </div>

        <div className="mt-3 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            {product.category.replace("-sarees", "").replace("-", " ")} saree
          </p>
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">
            {product.name}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Stars rating={product.rating} size={13} />
            <span>({product.reviewCount})</span>
          </div>
          <p className="font-display text-xl font-bold text-ink">
            {formatINR(product.price)}
            <span className="ml-1 align-middle text-[10px] font-normal text-muted">
              incl. taxes
            </span>
          </p>
        </div>
      </Link>

      {/* Wishlist */}
      <button
        type="button"
        onClick={() => toggle(product.slug)}
        aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        aria-pressed={wished}
        className={cx(
          "absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 shadow-sm backdrop-blur transition-all hover:scale-105",
          wished ? "text-[#b3261e]" : "text-ink2 hover:text-ink",
        )}
      >
        <Heart size={17} className={wished ? "fill-current" : ""} />
      </button>

      {/* Quick add — the + rotates into a cart icon on hover, with a tooltip */}
      <button
        type="button"
        onClick={quickAdd}
        aria-label={`Add ${product.name} to cart`}
        className={cx(
          "group/qa absolute bottom-2.5 right-2.5 z-20 flex h-10 w-10 items-center justify-center rounded-full shadow-md transition-all duration-300",
          justAdded
            ? "bg-[#5f7a4d] text-white hover:scale-105"
            : "bg-[#5d350e] text-[#f6ebd9] hover:scale-105",
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
            "pointer-events-none absolute right-full top-1/2 mr-2.5 hidden -translate-y-1/2 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold shadow-lg transition-all duration-200 md:block",
            "bg-ink text-btntext",
            justAdded
              ? "opacity-100"
              : "translate-x-1 opacity-0 group-hover/qa:translate-x-0 group-hover/qa:opacity-100",
          )}
        >
          {justAdded ? "Added to cart ✓" : "Add to cart"}
        </span>
      </button>
    </div>
  );
}
