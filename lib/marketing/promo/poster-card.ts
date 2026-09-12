/**
 * Bright promo poster LAYOUT — pure geometry + palette mapping for the
 * ₹199 campaign poster (rendered by poster-image.ts with sharp/SVG).
 *
 * Design language:
 *   vibrant studio background → sharp hero photo right → large clean offer
 *   text left → one CTA → 2-3 compact trust points.
 *
 * HARD RULES: text zones never fight the hero image; every colour comes
 * from a fixed palette; the price string is rendered EXACTLY as given.
 */
export const POSTER = {
  width: 1080,
  height: 1350,
  /** Sharp hero photo panel, sized for vertical reel/ad creatives. */
  hero: { x: 492, y: 188, w: 548, h: 1058, radius: 34 },
  /** Left text column safe area. */
  textX: 64,
  textMaxWidth: 500,
  banner: { x: 56, y: 278, w: 470, h: 360, skew: 0, rotate: 0 },
  offerSize: 58,
  priceSize: 182,
  flatSize: 42,
  pointsSize: 26,
  pointsY: 760,
  pointGap: 54,
  tickSize: 30,
  cta: { y: 1018, h: 76, size: 34, padX: 52 },
  brand: { size: 70, taglineSize: 24, x: 64, y: 100 },
  footer: { size: 22, y: 1276 },
  accentStroke: 10,
  decoRing: { cx: 0, cy: 0, r: 0 },
} as const;

export interface PosterPalette {
  bgTop: string;
  bgBottom: string;
  bgGlow: string;
  banner: string;
  bannerDeep: string;
  price: string;
  ink: string;
  soft: string;
  cta: string;
  ctaText: string;
  chipBg: string;
  chipText: string;
}

/** Fixed palettes (spec §45) — hex without '#'. */
export const POSTER_PALETTES: Record<string, PosterPalette> = {
  TERRACOTTA_EDITORIAL: {
    bgTop: "d96b38", bgBottom: "5b2415", bgGlow: "f6c37a",
    banner: "7c1f25", bannerDeep: "4f1115", price: "ffe071",
    ink: "fff5e6", soft: "fbe0bd", cta: "7c1f25", ctaText: "fff5e6",
    chipBg: "fff3e0", chipText: "7c1f25",
  },
  SALE_YELLOW: {
    bgTop: "ffd43b", bgBottom: "e14422", bgGlow: "fff2a6",
    banner: "a40d24", bannerDeep: "6f0817", price: "ffe648",
    ink: "fffff7", soft: "fff2cf", cta: "a40d24", ctaText: "fffff7",
    chipBg: "fffff7", chipText: "a40d24",
  },
  CREAM_BOTANICAL: {
    bgTop: "fff8e7", bgBottom: "f3dcc0", bgGlow: "ffffff",
    banner: "a9563d", bannerDeep: "6d251d", price: "b66b25",
    ink: "6d251d", soft: "9b6a3d", cta: "6d251d", ctaText: "fff8e7",
    chipBg: "f8e8d2", chipText: "6d251d",
  },
  DARK_LUXE: {
    bgTop: "26120c", bgBottom: "050302", bgGlow: "c58d38",
    banner: "c58d38", bannerDeep: "7a4b16", price: "f8c85e",
    ink: "fbf0d5", soft: "d9b77a", cta: "f8c85e", ctaText: "28130a",
    chipBg: "f8c85e", chipText: "28130a",
  },
  ROSE_FASHION: {
    bgTop: "f56b91", bgBottom: "75102d", bgGlow: "ffd1e0",
    banner: "9a103c", bannerDeep: "5b071f", price: "ffe15d",
    ink: "fffff7", soft: "ffe5ee", cta: "5b071f", ctaText: "fffff7",
    chipBg: "fffff7", chipText: "9a103c",
  },
  BLUE_GOLD_LUXE: {
    bgTop: "063a5a", bgBottom: "041b2a", bgGlow: "f7c968",
    banner: "f7c968", bannerDeep: "b38328", price: "fff0a6",
    ink: "fffff4", soft: "cfe9f6", cta: "f7c968", ctaText: "06233a",
    chipBg: "fffff4", chipText: "063a5a",
  },
  BRIGHT_POP: {
    bgTop: "fbac3f", bgBottom: "e8542f", bgGlow: "ffd977",
    banner: "d63649", bannerDeep: "a81f38", price: "ffd23f",
    ink: "ffffff", soft: "fff3e0", cta: "a81f38", ctaText: "ffffff",
    chipBg: "ffffff", chipText: "a81f38",
  },
  PINK_MAGENTA: {
    bgTop: "ff7ab8", bgBottom: "c2185b", bgGlow: "ffd1e8",
    banner: "8e1043", bannerDeep: "63082e", price: "ffe082",
    ink: "ffffff", soft: "ffe9f4", cta: "4a0d24", ctaText: "ffffff",
    chipBg: "ffffff", chipText: "8e1043",
  },
  YELLOW_RED: {
    bgTop: "ffc93c", bgBottom: "d93a1e", bgGlow: "ffe9a8",
    banner: "b31217", bannerDeep: "7c0b10", price: "fff3b0",
    ink: "ffffff", soft: "fff8e7", cta: "7c0b10", ctaText: "ffffff",
    chipBg: "ffffff", chipText: "b31217",
  },
  ROYAL_GOLD: {
    bgTop: "3f51b5", bgBottom: "1a237e", bgGlow: "c5cae9",
    banner: "b8860b", bannerDeep: "7a5800", price: "ffd700",
    ink: "ffffff", soft: "e8eaf6", cta: "0d1440", ctaText: "ffffff",
    chipBg: "ffd700", chipText: "1a237e",
  },
  BLUE_GOLD: {
    bgTop: "0288d1", bgBottom: "01579b", bgGlow: "b3e5fc",
    banner: "f9a825", bannerDeep: "b8860b", price: "fff8e1",
    ink: "ffffff", soft: "e1f5fe", cta: "013366", ctaText: "ffffff",
    chipBg: "ffffff", chipText: "01579b",
  },
  FESTIVE: {
    bgTop: "e91e63", bgBottom: "880e4f", bgGlow: "ffcdd2",
    banner: "ff6f00", bannerDeep: "b34700", price: "fff176",
    ink: "ffffff", soft: "fde7ef", cta: "4a0022", ctaText: "ffffff",
    chipBg: "fff176", chipText: "880e4f",
  },
};

export interface PosterText {
  brand: string;
  tagline: string;
  offer: string;
  price: string;
  flatLabel: string;
  sellingPoints: string[];
  cta: string;
  productLink: string;
  handle: string;
}

export interface PosterGeometry {
  width: number;
  height: number;
  hero: { x: number; y: number; w: number; h: number; radius: number };
  textX: number;
  textMaxWidth: number;
  banner: { x: number; y: number; w: number; h: number; skew: number; rotate: number };
  offerLines: string[];
  offerSize: number;
  offerY: number;
  price: { text: string; size: number; x: number; y: number; rotate: number };
  flat: { text: string; size: number; x: number; y: number };
  points: { items: string[]; size: number; y: number; gap: number };
  cta: { text: string; x: number; y: number; w: number; h: number; size: number; radius: number };
  brand: { text: string; tagline: string; x: number; y: number; size: number; taglineSize: number };
  footer: { text: string; size: number; y: number };
  decoRing: { cx: number; cy: number; r: number };
  accentStroke: number;
}

/** Rough width estimate for the system font stack at a given size. */
export function posterTextWidth(text: string, size: number): number {
  return text.length * size * 0.56;
}

/** Split "ALL SAREES" into banner lines that fit the banner width. */
export function offerLines(offer: string, maxWidth: number, size: number): string[] {
  const words = offer.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (posterTextWidth(cand, size) <= maxWidth || !cur) {
      cur = cand;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

/** Build the deterministic geometry for one poster. */
export function buildPosterGeometry(text: PosterText): PosterGeometry {
  const P = POSTER;
  const lines = offerLines(text.offer, P.banner.w - 120, P.offerSize);
  const priceText = `${"₹"}${text.price}`;

  // Banner-internal vertical rhythm: offer lines, price, FLAT row.
  const offerY = P.banner.y + 96;
  const priceY = offerY + 44 + Math.round(P.priceSize * 0.78);
  const flatY = priceY + Math.round(P.priceSize * 0.30);

  const ctaW = Math.round(posterTextWidth(text.cta, P.cta.size) + P.cta.padX * 2);

  return {
    width: P.width,
    height: P.height,
    hero: { ...P.hero },
    textX: P.textX,
    textMaxWidth: P.textMaxWidth,
    banner: { ...P.banner },
    offerLines: lines,
    offerSize: P.offerSize,
    offerY,
    price: { text: priceText, size: P.priceSize, x: P.banner.x + 44, y: priceY, rotate: P.banner.rotate },
    flat: { text: text.flatLabel, size: P.flatSize, x: P.banner.x + 230, y: flatY },
    points: { items: text.sellingPoints, size: P.pointsSize, y: P.pointsY, gap: P.pointGap },
    cta: {
      text: text.cta,
      x: P.textX,
      y: P.cta.y,
      w: ctaW,
      h: P.cta.h,
      size: P.cta.size,
      radius: Math.round(P.cta.h / 2),
    },
    brand: {
      text: text.brand,
      tagline: text.tagline,
      x: P.brand.x,
      y: P.brand.y,
      size: P.brand.size,
      taglineSize: P.brand.taglineSize,
    },
    footer: { text: `${text.handle}   •   ${text.productLink}`, size: P.footer.size, y: P.footer.y },
    decoRing: { ...P.decoRing },
    accentStroke: P.accentStroke,
  };
}
