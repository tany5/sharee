"use client";

import SareeArt from "@/components/product/saree-art";
import { artForProduct } from "@/lib/art";
import { productPhotoThumb } from "@/lib/photos";
import { cx } from "@/lib/utils";

/**
 * Basket/order thumbnails: shows the woman-wearing-the-saree photo for any
 * product in the photography map, otherwise the fabric artwork. Pure render —
 * safe in client components.
 */
export function WornThumb({
  slug,
  colorway,
  category,
  name,
  image,
  className,
}: {
  slug: string;
  colorway?: string;
  category?: string;
  name?: string;
  image?: string;
  className?: string;
}) {
  const photo = image ?? productPhotoThumb(slug);
  const label = `${name ?? "Saree"} at ₹199`;
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={label}
        loading="lazy"
        className={cx("object-cover object-top", className)}
      />
    );
  }
  return (
    <SareeArt
      spec={artForProduct(slug, colorway ?? "Maroon", category ?? "cotton-sarees")}
      label={label}
      crop="portrait"
      className={className}
    />
  );
}
