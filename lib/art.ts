/**
 * Deterministic generative "fabric art" for catalogue items.
 *
 * Every saree in the demo catalogue renders as a bespoke woven/printed drape
 * SVG generated purely from its slug + category + variant index — so the same
 * product always looks the same on every page, on server and client.
 *
 * Real product photography can replace this: drop `public/products/<slug>/1.jpg`
 * and ProductImage (server component) will render the photo instead.
 */
import { hashString } from "@/lib/utils";

export type PatternKind =
  | "weave"
  | "dots"
  | "motif"
  | "sheen"
  | "grid"
  | "sparkle";

export interface ArtScheme {
  key: string;
  /** Light body tone. */
  top: string;
  /** Mid body tone. */
  mid: string;
  /** Deep tone (pallu, shadows). */
  deep: string;
  /** Metallic/gold accent. */
  gold: string;
  /** Soft highlight / contrast foil. */
  foil: string;
}

/** Fabric colourways tuned to sit beautifully next to the brown/gold site. */
export const ART_SCHEMES: ArtScheme[] = [
  { key: "maroon", top: "#8a3340", mid: "#6b1f2c", deep: "#48131e", gold: "#e4bd7f", foil: "#f6e7c9" },
  { key: "forest", top: "#55755a", mid: "#354c3c", deep: "#1d2f22", gold: "#d8bd85", foil: "#f1e3c2" },
  { key: "indigo", top: "#5c6aa0", mid: "#3c4772", deep: "#242b4c", gold: "#d9bc8b", foil: "#f2e4c8" },
  { key: "ochre", top: "#c29e49", mid: "#96701f", deep: "#5f440e", gold: "#f3e3ae", foil: "#fff8e0" },
  { key: "blush", top: "#c67a80", mid: "#a04f57", deep: "#6f333b", gold: "#ecd2ad", foil: "#fdf1dc" },
  { key: "teal", top: "#4a8b8d", mid: "#2c6367", deep: "#194346", gold: "#e0c892", foil: "#f5ead0" },
  { key: "rust", top: "#b46a41", mid: "#8a4622", deep: "#5c2a10", gold: "#eccf96", foil: "#f9ecd2" },
  { key: "cream", top: "#f1e3ca", mid: "#d8bf98", deep: "#a8895d", gold: "#8c611f", foil: "#ffffff" },
  { key: "plum", top: "#81506c", mid: "#5c3550", deep: "#3a1f33", gold: "#e2c193", foil: "#f4e6cd" },
];

export function schemeForColorway(colorway: string, seed: number): number {
  const c = colorway.toLowerCase();
  const pick = (n: number) => n;
  if (/maroon|red|burgundy/.test(c)) return pick(0);
  if (/green|emerald|moss/.test(c)) return pick(1);
  if (/blue|navy|indigo|teal|turquoise/.test(c)) return c.includes("teal") || c.includes("turquoise") ? 5 : 2;
  if (/yellow|mustard|gold|ochre/.test(c)) return pick(3);
  if (/pink|blush|rose/.test(c)) return pick(4);
  if (/rust|orange|brown/.test(c)) return pick(6);
  if (/white|cream|ivory|beige|off-white/.test(c)) return pick(7);
  if (/purple|plum|magenta/.test(c)) return pick(8);
  return seed % ART_SCHEMES.length;
}

export function patternForCategory(category: string): PatternKind {
  const c = category.toLowerCase();
  if (c.includes("cotton")) return "weave";
  if (c.includes("silk")) return "dots";
  if (c.includes("printed")) return "motif";
  if (c.includes("chiffon")) return "sheen";
  if (c.includes("georgette")) return "grid";
  if (c.includes("fancy")) return "sparkle";
  return "dots";
}

export interface ArtSpec {
  scheme: ArtScheme;
  pattern: PatternKind;
  seed: number;
}

/** Stable art spec for a product slug (+ variant for gallery thumbnails). */
export function artForProduct(
  slug: string,
  colorway: string,
  category: string,
  variant = 0,
): ArtSpec {
  const base = hashString(slug);
  const schemeIndex =
    (schemeForColorway(colorway, base) + variant * 2) % ART_SCHEMES.length;
  return {
    scheme: ART_SCHEMES[schemeIndex],
    pattern: patternForCategory(category),
    seed: hashString(`${slug}::${variant}`),
  };
}

/** Stable art spec for a category card / hero. */
export function artForCategory(category: string, variant = 0): ArtSpec {
  const idx = hashString(category);
  const scheme = ART_SCHEMES[(idx + variant) % ART_SCHEMES.length];
  return { scheme, pattern: patternForCategory(category), seed: idx };
}
