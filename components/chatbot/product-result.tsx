"use client";

/**
 * Compact product card rendered inside chat bubbles. Deliberately reuses the
 * site's art/photo helpers, cart provider and analytics — not a new visual
 * system, just a chat-sized sibling of components/product/product-card.tsx.
 */
import { useState } from "react";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { useCart } from "@/components/store/providers";
import { trackAddToCart } from "@/lib/analytics";
import { productPhotoAltThumb, productPhotoThumb } from "@/lib/photos";
import SareeArt from "@/components/product/saree-art";
import { artForProduct } from "@/lib/art";
import { formatINR } from "@/lib/format";
import { cx } from "@/lib/utils";
import type { ChatProduct } from "@/lib/ai/types/chat";

export function ProductResult({ product }: { product: ChatProduct }) {
  const { add } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const photo = productPhotoThumb(product.slug) ?? product.images?.[0] ?? product.image;
  const altPhoto = productPhotoAltThumb(product.slug);
  const art = artForProduct(product.slug, product.colorway, product.category);

  const quickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    add(product.slug, product.colorway, 1, {
      name: product.name,
      price: product.price,
      image: photo,
    });
    trackAddToCart(product.slug, product.name);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1400);
  };

  return (
    <div className="group relative w-36 shrink-0 overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-accent/40">
      <Link
        href={`/sarees/${product.slug}`}
        className="block focus:outline-none"
        aria-label={`${product.name}, ${formatINR(product.price)}`}
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-bg2">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <SareeArt spec={art} label={`${product.name} fabric artwork`} className="h-full w-full" />
          )}
        </div>
        <div className="space-y-0.5 p-2.5">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
            {product.category.replace("-sarees", "")}
          </p>
          <h4 className="line-clamp-2 text-[12px] font-medium leading-snug text-ink">
            {product.name}
          </h4>
          <p className="font-display text-[15px] font-semibold text-ink">
            {formatINR(product.price)}
          </p>
        </div>
      </Link>
      <button
        type="button"
        onClick={quickAdd}
        aria-label={`Add ${product.name} to cart`}
        className={cx(
          "absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-pill shadow-md transition-colors",
          justAdded ? "bg-success text-white" : "bg-accent text-white hover:bg-accent-light",
        )}
      >
        {justAdded ? <Check size={15} strokeWidth={2.4} /> : <Plus size={16} strokeWidth={2.4} />}
      </button>
      {/* altPhoto reserved for hover swap parity with grid cards */}
      <span className="hidden">{altPhoto}</span>
    </div>
  );
}
