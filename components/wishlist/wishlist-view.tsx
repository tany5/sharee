"use client";

import Link from "next/link";
import { ArrowRight, Heart, ShoppingCart, Trash2 } from "lucide-react";
import { PRODUCT_INDEX } from "@/lib/data/catalog";
import { SITE } from "@/lib/site";
import { useCart, useWishlist } from "@/components/store/providers";
import { ButtonLink, EmptyState } from "@/components/ui";
import { WornThumb } from "@/components/product/worn-image";
import { trackAddToCart } from "@/lib/analytics";
import { formatINR } from "@/lib/format";

function prettySlug(slug: string): string {
  return slug.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

export function WishlistView() {
  const { slugs, toggle } = useWishlist();
  const { add } = useCart();

  const items = slugs;
  const labelFor = (slug: string) =>
    PRODUCT_INDEX[slug]?.name ?? prettySlug(slug);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Heart size={30} />}
        title="Your wishlist is empty"
        body="Tap the heart on any saree to save it here — perfect for planning your next order at ₹199."
        action={
          <ButtonLink href="/sarees" size="lg">
            Browse Sarees <ArrowRight size={17} />
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((slug) => {
        const meta = PRODUCT_INDEX[slug];
        const name = labelFor(slug);
        return (
          <div
            key={slug}
            className="group overflow-hidden rounded-2xl border border-line bg-surface"
          >
            <Link
              href={`/sarees/${slug}`}
              className="relative block aspect-[3/4] overflow-hidden"
            >
              <WornThumb
                slug={slug}
                colorway={meta?.colorway}
                category={meta?.category}
                name={name}
                className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"
              />
            </Link>
            <div className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                {(meta?.category ?? "saree").replace("-sarees", "")} saree
              </p>
              <Link
                href={`/sarees/${slug}`}
                className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug text-ink hover:text-accent"
              >
                {name}
              </Link>
              <div className="mt-2 flex items-center justify-between">
                <p className="font-display text-xl font-bold text-ink">
                  {formatINR(SITE.price)}
                </p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggle(slug)}
                    aria-label={`Remove ${name} from wishlist`}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      add(slug, meta?.colorway ?? "Maroon", 1, {
                        name,
                        price: SITE.price,
                      });
                      trackAddToCart(slug, name);
                    }}
                    aria-label={`Add ${name} to cart`}
                    className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-xs font-bold text-btntext transition-opacity hover:opacity-90"
                  >
                    <ShoppingCart size={14} /> Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
