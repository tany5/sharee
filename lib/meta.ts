import type { Metadata } from "next";
import type { Product } from "@/lib/types";
import { SITE } from "@/lib/site";

export function pageUrl(path: string): URL {
  return new URL(path, SITE.url);
}

interface PageMetaInput {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
}

/** Metadata for standard pages. */
export function pageMetadata({
  title,
  description,
  path,
  type = "website",
}: PageMetaInput): Metadata {
  const url = pageUrl(path);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url,
      type,
      siteName: SITE.name,
      locale: "en_IN",
      images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
    },
    robots: { index: true, follow: true },
  };
}

/**
 * Metadata for utility pages that must never appear in search results
 * (cart, checkout, account, order status). Still reachable via links, so
 * `follow` stays on — only indexing is blocked.
 */
export function utilityMetadata(opts: Omit<PageMetaInput, "type">): Metadata {
  return {
    ...pageMetadata(opts),
    robots: { index: false, follow: true },
  };
}

/** Metadata for a product page. */
export function productMetadata(product: Product): Metadata {
  const path = `/sarees/${product.slug}`;
  return pageMetadata({
    title: `${product.name} — ${SITE.tagline}`,
    description: product.description,
    path,
    type: "website",
  });
}

export function categoryMetadata(
  name: string,
  blurb: string,
  path: string,
): Metadata {
  return pageMetadata({
    title: `${name} — ${SITE.tagline}`,
    description: `${blurb} ${SITE.promise} Shop ${name.toLowerCase()} online at ₹199 with free shipping over ₹999.`,
    path,
  });
}

/** JSON-LD product schema string for <script type="application/ld+json">. */
export function productJsonLd(product: Product): string {
  const url = pageUrl(`/sarees/${product.slug}`).toString();
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: [`${url}og-image`],
    sku: product.id,
    brand: { "@type": "Brand", name: SITE.name },
    category: product.category.replace("-sarees", " Sarees"),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "INR",
      price: product.price,
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
    },
  });
}

export function storeJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    name: SITE.name,
    legalName: SITE.legalName,
    description: `${SITE.tagline}. ${SITE.promise}`,
    url: SITE.url,
    email: SITE.email,
    sameAs: [SITE.facebookUrl, SITE.instagramUrl],
    address: {
      "@type": "PostalAddress",
      streetAddress: "Chakpara Dagabagan, Liluah",
      addressLocality: "Howrah",
      addressRegion: "West Bengal",
      postalCode: "711204",
      addressCountry: "IN",
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: SITE.phone,
      email: SITE.email,
      contactType: "customer service",
      areaServed: "IN",
      availableLanguage: ["en", "bn", "hi"],
    },
  });
}
