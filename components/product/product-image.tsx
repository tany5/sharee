/**
 * Server-only image resolver.
 * Rendering order for a product:
 *   1. real photo at public/products/<slug>/1.jpg (drop photography in and it wins)
 *   2. the "worn" model photo from the photography map (lib/photos.ts)
 *   3. deterministic generative fabric artwork
 * Do not import into client files.
 */
import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import SareeArt from "@/components/product/saree-art";
import { artForProduct } from "@/lib/art";
import { productPhoto } from "@/lib/photos";
import { cx } from "@/lib/utils";

const cache = new Map<string, boolean>();

function hasPhoto(slug: string): boolean {
  if (cache.has(slug)) return cache.get(slug)!;
  const base = join(process.cwd(), "public", "products", slug);
  const exists = [".jpg", ".jpeg", ".png", ".webp"].some((ext) =>
    existsSync(join(base, `1${ext}`)),
  );
  cache.set(slug, exists);
  return exists;
}

export interface ProductImageProps {
  slug: string;
  name: string;
  colorway: string;
  category: string;
  /** Photographic alt text tail. */
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** Show the ₹199 badge on the artwork (PDP main image). */
  priceBadge?: boolean;
}

export function ProductImage({
  slug,
  name,
  colorway,
  category,
  className,
  sizes = "(min-width: 1024px) 25vw, 50vw",
  priority,
}: ProductImageProps) {
  const alt = `${name} saree at ₹199 — ${colorway.toLowerCase()}`;

  if (hasPhoto(slug)) {
    return (
      <div className={cx("relative aspect-[3/4] overflow-hidden bg-surface", className)}>
        <Image
          src={`/products/${slug}/1.jpg`}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover"
        />
      </div>
    );
  }

  // Worn model shot (free Pexels photography) for the seeded catalogue.
  const modelPhoto = productPhoto(slug);
  if (modelPhoto) {
    return (
      <div className={cx("relative aspect-[3/4] overflow-hidden bg-surface", className)}>
        <Image
          src={modelPhoto}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover object-top"
        />
      </div>
    );
  }

  return (
    <div className={cx("relative aspect-[3/4] overflow-hidden", className)}>
      <SareeArt
        spec={artForProduct(slug, colorway, category)}
        label={alt}
        crop="portrait"
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
