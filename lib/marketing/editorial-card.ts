/**
 * EDITORIAL post card — PURE layout for the magazine-style 4:5 creative
 * (lib/marketing/editorial-image.ts renders it with sharp).
 *
 * Design language (owner reference: premium saree print ads — original
 * execution): full-bleed photo, warm monochrome wash strongest on the left,
 * letterspaced brand wordmark top-left, stacked display headline (big serif
 * word / swash word / deep-shade tail), hashtag in a solid box, "FLAT ₹199"
 * with a thin accent rule, and a translucent footer strip (handle + site).
 * Text is minimal and factual: the caption copy stays in the post text.
 *
 * Everything here is deterministic and unit-tested; the sharp module holds
 * zero layout decisions. Canvas: 1080×1350 (Meta 4:5).
 */

export const EDITORIAL_CARD = {
  width: 1080,
  height: 1350,
  padX: 72,
  wordmark: { y: 96, size: 40, letterSpacing: 8, ruleWidth: 132, ruleGap: 18 },
  headline: {
    /** Stacked sizes: big / script / deep tail. */
    l1Size: 96,
    l2Size: 72,
    l3Size: 54,
    l3LineHeight: 64,
    l1Y: 560,
    l2Y: 664,
    l3Y: 748,
    l2Indent: 30,
    maxWidth: 560,
  },
  hashtag: { y: 880, size: 32, padX: 26, padY: 14 },
  price: { y: 1032, size: 40, letterSpacing: 4, ruleWidth: 210, ruleGap: 16, ruleHeight: 3 },
  footer: { height: 64, size: 26, padX: 72 },
  /** Colors (hex, no '#') — warm maroon ink over the washed photo. */
  ink: "53251c",
  deep: "8a3b2d",
  cream: "fdf3e7",
  accent: "b4452f",
  footerBg: "f8ead9",
  /** Warm wash: left edge strength → transparent; plus a soft bottom scrim. */
  washLeft: 0.62,
  washColor: "5a2a18",
  bottomScrim: 0.28,
} as const;

export interface EditorialCardInput {
  brand: string;
  /** Product name — split into the stacked display lines. */
  headline: string;
  /** First hashtag from the caption (rendered in the solid box). */
  hashtag: string;
  price: number;
  handle: string;
  /** Bare site link for the footer, e.g. thetanti.in/sarees/slug. */
  siteLink: string;
}

export interface EditorialLayout {
  canvas: { width: number; height: number };
  wordmark: { text: string; x: number; y: number; size: number; letterSpacing: number; ruleY: number; ruleWidth: number };
  headline: {
    l1: string; l2: string; l3Lines: string[];
    x: number; l1Y: number; l2Y: number; l2Indent: number; l3Y: number; l3LineHeight: number;
    l1Size: number; l2Size: number; l3Size: number;
  };
  hashtagBox: {
    text: string; x: number; y: number; size: number;
    boxW: number; boxH: number; fill: string; textFill: string;
    textX: number; textY: number;
  };
  price: { text: string; x: number; y: number; size: number; letterSpacing: number; ruleY: number; ruleWidth: number; ruleHeight: number };
  footer: { handle: string; link: string; y: number; height: number; size: number; textY: number; padX: number };
  wash: { color: string; left: number; bottom: number };
}

/** Same width heuristic as the regular card (±letterspacing handled by callers). */
export function estimateWidth(text: string, fontSize: number, letterSpacing = 0): number {
  return text.length * fontSize * 0.52 + Math.max(0, text.length - 1) * letterSpacing;
}

/**
 * Split the product name into the stacked display lines:
 *   ≥4 words → "First" / "second" / "rest of the name"
 *   3 words  → first / second / third
 *   2 words  → first / second / —
 *   1 word   → the word / — / —
 * Pure and deterministic; never invents words.
 */
export function buildHeadlineStack(headline: string): { l1: string; l2: string; l3: string } {
  const words = headline.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { l1: "", l2: "", l3: "" };
  if (words.length === 1) return { l1: words[0]!, l2: "", l3: "" };
  if (words.length === 2) return { l1: words[0]!, l2: words[1]!, l3: "" };
  if (words.length === 3) return { l1: words[0]!, l2: words[1]!, l3: words[2]! };
  return { l1: words[0]!, l2: words[1]!, l3: words.slice(2).join(" ") };
}

/** Greedy word wrap for the deep tail line (reuses the card heuristic). */
export function wrapTail(text: string, maxWidth: number, fontSize: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateWidth(candidate, fontSize) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  return lines;
}

/** "FLAT ₹199" / "FLAT ₹1,299" — the only price rendering (exact). */
export function formatPriceLine(price: number): string {
  return `FLAT ₹${Math.round(price).toLocaleString("en-IN")}`;
}

/** Normalize a hashtag: exactly one leading #, safe characters only. */
export function normalizeHashtag(tag: string): string {
  const bare = tag.replace(/^#+/, "").replace(/[^A-Za-z0-9_]/g, "");
  return bare ? `#${bare}` : "#TheTanti";
}

/** Build the complete editorial layout (pure, deterministic). */
export function buildEditorialLayout(input: EditorialCardInput): EditorialLayout {
  const C = EDITORIAL_CARD;
  const stack = buildHeadlineStack(input.headline);
  const l3Lines = stack.l3
    ? wrapTail(stack.l3, C.headline.maxWidth, C.headline.l3Size, 2)
    : [];

  const tag = normalizeHashtag(input.hashtag);
  const tagW = Math.round(estimateWidth(tag, C.hashtag.size)) + C.hashtag.padX * 2;
  const tagH = C.hashtag.size + C.hashtag.padY * 2;

  const priceText = formatPriceLine(input.price);

  return {
    canvas: { width: C.width, height: C.height },
    wordmark: {
      text: input.brand.toUpperCase(),
      x: C.padX,
      y: C.wordmark.y,
      size: C.wordmark.size,
      letterSpacing: C.wordmark.letterSpacing,
      ruleY: C.wordmark.y + C.wordmark.ruleGap,
      ruleWidth: C.wordmark.ruleWidth,
    },
    headline: {
      l1: stack.l1,
      l2: stack.l2,
      l3Lines,
      x: C.padX,
      l1Y: C.headline.l1Y,
      l2Y: C.headline.l2Y,
      l2Indent: C.headline.l2Indent,
      l3Y: C.headline.l3Y,
      l3LineHeight: C.headline.l3LineHeight,
      l1Size: C.headline.l1Size,
      l2Size: C.headline.l2Size,
      l3Size: C.headline.l3Size,
    },
    hashtagBox: {
      text: tag,
      x: C.padX,
      y: C.hashtag.y,
      size: C.hashtag.size,
      boxW: tagW,
      boxH: tagH,
      fill: `#${C.ink}`,
      textFill: `#${C.cream}`,
      textX: C.padX + C.hashtag.padX,
      textY: C.hashtag.y + C.hashtag.padY + Math.round(C.hashtag.size * 0.78),
    },
    price: {
      text: priceText,
      x: C.padX,
      y: C.price.y,
      size: C.price.size,
      letterSpacing: C.price.letterSpacing,
      ruleY: C.price.y + C.price.ruleGap,
      ruleWidth: C.price.ruleWidth,
      ruleHeight: C.price.ruleHeight,
    },
    footer: {
      handle: input.handle,
      link: input.siteLink,
      y: C.height - C.footer.height,
      height: C.footer.height,
      size: C.footer.size,
      textY: C.height - Math.round(C.footer.height / 2) + Math.round(C.footer.size * 0.36),
      padX: C.footer.padX,
    },
    wash: { color: C.washColor, left: C.washLeft, bottom: C.bottomScrim },
  };
}
