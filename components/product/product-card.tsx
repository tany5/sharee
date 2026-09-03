"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Heart, Plus } from "lucide-react";
import { artForProduct } from "@/lib/art";
import SareeArt from "@/components/product/saree-art";
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

export function ProductCard({ product }: { product: ProductCardData }) {
  const { add } = useCart();
  const { has, toggle } = useWishlist();
  const [justAdded, setJustAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wished = has(product.slug);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const quickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    add(product.slug, product.colorway, 1, {
      name: product.name,
      price: product.price,
    });
    trackAddToCart(product.slug, product.name);
    setJustAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setJustAdded(false), 1400);
  };

  const art = artForProduct(product.slug, product.colorway, product.category);

  return (
    <div className="group relative">
      <Link
        href={`/sarees/${product.slug}`}
        className="block focus:outline-none"
        aria-label={product.name}
      >
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-line/80 transition-shadow group-hover:shadow-lg group-hover:shadow-ink/10">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image}
              alt={`${product.name} saree at ${formatINR(product.price)}`}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <SareeArt
              spec={art}
              label={`${product.name} saree at ${formatINR(product.price)}`}
              crop="portrait"
              className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"
            />
          )}
          {product.tags.length > 0 && (
            <span className="absolute left-2.5 top-2.5">
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

      {/* Quick add */}
      <button
        type="button"
        onClick={quickAdd}
        aria-label={`Add ${product.name} to cart`}
        className={cx(
          "absolute bottom-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-full shadow-md transition-all",
          justAdded
            ? "bg-[#5f7a4d] text-white"
            : "bg-[#5d350e] text-[#f6ebd9] hover:scale-105",
        )}
      >
        {justAdded ? <Check size={19} /> : <Plus size={20} strokeWidth={2.4} />}
      </button>
    </div>
  );
}
