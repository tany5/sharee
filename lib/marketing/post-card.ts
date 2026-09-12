/**
 * Social post overlay layout — PURE geometry/copy decisions for the branded
 * 4:5 post card (lib/marketing/post-image.ts renders it with sharp).
 *
 * Derived from the owner's reference posts (warm editorial style: cream
 * surfaces, terracotta accents, serif headline, small brand chip, rounded
 * price badge). Everything here is deterministic and unit-tested — the sharp
 * module contains zero layout decisions.
 *
 * Canvas: 1080×1350 (Meta 4:5). Photo panel: full-bleed top (1080×900),
 * copy panel: bottom (1080×450). All dimensions are in canvas pixels.
 */

export const POST_CARD = {
  width: 1080,
  height: 1350,
  photoHeight: 900,
  /** Copy panel height = height - photoHeight. */
  panelHeight: 450,
  panelPadX: 64,
  /** Headline font size (fitted down in 10% steps when it overflows). */
  headlineSize: 58,
  /** Max width the headline may occupy before wrapping/fits shrink. */
  headlineMaxWidth: 952,
  bodySize: 34,
  bodyLineGap: 14,
  footerSize: 30,
  accentHeight: 8,
  brandChip: { padX: 22, padY: 12, size: 28, gap: 10, offsetX: 40, offsetY: 40 },
  priceBadge: { size: 44, padX: 36, padY: 16, radius: 38, offsetX: 56, offsetY: 48 },
  /** Text colors — hex without '#'. */
  ink: "3a2416",
  mutedInk: "6d5b4b",
  panelBg: "f6ebe1",
  footerBar: "f6ebe1",
  accentBar: "c3665e",
  brandChipBg: "3a2416",
  brandChipText: "f6ebe1",
  priceBadgeBg: "c3665e",
  priceBadgeText: "ffffff",
  photoScrim: 0.35,
} as const;

/** Layout for the generated SVG text overlay (photo panel is NOT part of it). */
export interface PostCardLayout {
  canvas: { width: number; height: number; panelHeight: number };
  /** Headline fitted: font size + wrapped lines (bottom panel). */
  headline: { text: string; lines: string[]; size: number; y: number };
  body: { lines: string[]; size: number; y: number; lineHeight: number };
  footer: { handle: string; link: string; y: number };
  accentBar: { y: number; height: number };
  panel: { x: number; y: number; width: number; height: number; fill: string };
  scrim: { x: number; y: number; width: number; height: number; opacity: number };
  brandChip: {
    x: number; y: number; padX: number; padY: number; size: number;
    gap: number; label: string; fill: string; text: string; fontSize: number;
    textX: number; textY: number; rectWidth: number; rectHeight: number;
  };
  priceBadge: {
    x: number; y: number; width: number; height: number; radius: number;
    fill: string; text: string; textFill: string; fontSize: number;
    textX: number; textY: number;
  };
}

export interface PostCardInput {
  headline: string;
  body: string;
  price: number;
  siteName: string;
  handle: string;
  siteUrl: string;
  productPath: string;
}

/** Approximate text width (works with Judson/Teachers stacks + fallbacks). */
export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.52;
}

/** Greedy word wrap to a pixel width — same algorithm the SVG layout assumes. */
export function wrapText(text: string, maxWidth: number, fontSize: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateTextWidth(candidate, fontSize) <= maxWidth || !current) {
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

/** "₹199" / "₹1,299" for the badge. */
export function formatPriceBadge(price: number): string {
  return `₹${Math.round(price).toLocaleString("en-IN")}`;
}

/** Shorten https://site/sarees/slug → site/sarees/slug for the footer. */
export function shortLink(siteUrl: string, productPath: string): string {
  const bare = siteUrl.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return `${bare}/${productPath.replace(/^\/+/, "")}`;
}

/**
 * Clip the footer link (with an ellipsis) so handle + link never collide on
 * one row. Keeps at least 12 visible characters after the ellipsis.
 */
export function fitFooterLink(handle: string, link: string, maxWidth: number, fontSize: number): string {
  const gap = estimateTextWidth("   ", fontSize);
  const available = maxWidth - estimateTextWidth(handle, fontSize) - gap;
  if (estimateTextWidth(link, fontSize) <= available) return link;
  const minVisible = 12;
  let clipped = link;
  while (clipped.length > minVisible && estimateTextWidth(`${clipped}…`, fontSize) > available) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}…`;
}

/** True when the wrapped lines still contain every input word (no truncation). */
function wrapIsComplete(text: string, lines: string[]): boolean {
  return lines.join(" ").replace(/\s+/g, " ").trim() === text.replace(/\s+/g, " ").trim();
}

/**
 * Fitted headline: try the base size, then step down 10% until the FULL text
 * wraps to ≤2 lines inside the panel width (never below 60% of the base size).
 */
export function fitHeadline(text: string): { lines: string[]; size: number } {
  let size: number = POST_CARD.headlineSize;
  for (let step = 0; step < 5; step += 1) {
    const lines = wrapText(text, POST_CARD.headlineMaxWidth, size, 2);
    const widest = Math.max(...lines.map((l) => estimateTextWidth(l, size)));
    if (lines.length <= 2 && widest <= POST_CARD.headlineMaxWidth && wrapIsComplete(text, lines)) {
      return { lines, size };
    }
    size = Math.round(size * 0.9);
  }
  // Clamp hard: 3 lines at the floor size, still never dropping words.
  const floor = Math.round(POST_CARD.headlineSize * 0.6);
  return { lines: wrapText(text, POST_CARD.headlineMaxWidth, floor, 3), size: floor };
}

/** Max body lines that still leave room for headline + footer in the panel. */
export function maxBodyLines(headlineLines: number): number {
  return headlineLines >= 2 ? 2 : 3;
}

/** Build the complete SVG overlay layout (pure, deterministic). */
export function buildPostCardLayout(input: PostCardInput): PostCardLayout {
  const P = POST_CARD;
  const fitted = fitHeadline(input.headline);
  const bodyLines = wrapText(input.body, P.headlineMaxWidth, P.bodySize, maxBodyLines(fitted.lines.length));

  const panelY = P.height - P.panelHeight;
  const headlineLineHeight = Math.round(fitted.size * 1.12);
  const headlineY = panelY + 58;
  const headlineBlockH = fitted.lines.length * headlineLineHeight;
  const bodyY = headlineY + headlineBlockH + 14;
  const bodyLineHeight = P.bodySize + P.bodyLineGap;
  const bodyBlockH = bodyLines.length * bodyLineHeight;
  const footerY = Math.min(panelY + P.panelHeight - 56, bodyY + bodyBlockH + 26);

  const chipLabel = input.siteName.toUpperCase();
  const chipTextW = estimateTextWidth(chipLabel, P.brandChip.size);
  const chipRectW = Math.round(P.brandChip.padX * 2 + P.brandChip.size + P.brandChip.gap + chipTextW);
  const chipRectH = P.brandChip.padY * 2 + P.brandChip.size;

  const badgeText = formatPriceBadge(input.price);
  const badgeW = Math.round(estimateTextWidth(badgeText, P.priceBadge.size)) + P.priceBadge.padX * 2;
  const badgeH = P.priceBadge.size + P.priceBadge.padY * 2;
  const badgeR = Math.min(P.priceBadge.radius, Math.round(badgeH / 2));

  return {
    canvas: { width: P.width, height: P.height, panelHeight: P.panelHeight },
    headline: {
      text: input.headline,
      lines: fitted.lines,
      size: fitted.size,
      y: headlineY,
    },
    body: { lines: bodyLines, size: P.bodySize, y: bodyY, lineHeight: bodyLineHeight },
    footer: {
      handle: input.handle,
      link: fitFooterLink(
        input.handle,
        shortLink(input.siteUrl, input.productPath),
        P.headlineMaxWidth,
        P.footerSize,
      ),
      y: footerY,
    },
    accentBar: { y: panelY - P.accentHeight, height: P.accentHeight },
    panel: { x: 0, y: panelY, width: P.width, height: P.panelHeight, fill: `#${P.panelBg}` },
    scrim: { x: 0, y: 0, width: P.width, height: P.photoHeight, opacity: P.photoScrim },
    brandChip: {
      x: P.brandChip.offsetX,
      y: P.brandChip.offsetY,
      padX: P.brandChip.padX,
      padY: P.brandChip.padY,
      size: P.brandChip.size,
      gap: P.brandChip.gap,
      label: chipLabel,
      fill: `#${P.brandChipBg}`,
      text: `#${P.brandChipText}`,
      fontSize: P.brandChip.size,
      textX: P.brandChip.offsetX + P.brandChip.padX + P.brandChip.size + P.brandChip.gap,
      textY: P.brandChip.offsetY + P.brandChip.padY + P.brandChip.size * 0.82,
      rectWidth: chipRectW,
      rectHeight: chipRectH,
    },
  priceBadge: {
    x: P.width - P.priceBadge.offsetX - badgeW,
    y: panelY - P.priceBadge.offsetY - badgeH,
    width: badgeW,
    height: badgeH,
    radius: badgeR,
    fill: `#${P.priceBadgeBg}`,
    text: badgeText,
    textFill: `#${P.priceBadgeText}`,
    fontSize: P.priceBadge.size,
    textX: P.width - P.priceBadge.offsetX - Math.round(badgeW / 2),
    textY: panelY - P.priceBadge.offsetY - Math.round(badgeH / 2) + Math.round(P.priceBadge.size * 0.35),
  },
  };
}
