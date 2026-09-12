/**
 * Branded 4:5 post-card composer — renders the layout from post-card.ts onto
 * the product's EXISTING photo with sharp. Local, free, deterministic:
 *
 *   product photo (cover-cropped 1080×900)  →  canvas 1080×1350
 *   + warm cream copy panel (bottom 450px)  →  headline / body / footer
 *   + brand chip + price badge + accent bar →  JPEG uploaded to social-media
 *
 * The product-photo pipeline is NOT touched; composition failure must never
 * block the social flow (the post falls back to the raw product image).
 */
import "server-only";
import sharp from "sharp";
import {
  POST_CARD,
  buildPostCardLayout,
  type PostCardInput,
} from "@/lib/marketing/post-card";

/** XML-escape text destined for SVG <text>/<tspan> nodes. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** One <tspan> per wrapped line. */
function tspans(lines: string[], x: number, y: number, lineHeight: number): string {
  return lines
    .map((l, i) => `<tspan x="${x}" y="${y + i * lineHeight}">${esc(l)}</tspan>`)
    .join("");
}

/** Serif headline + Teachers body, with sensible web-safe fallbacks. */
const HEADLINE_STACK = "Judson, Georgia, 'Times New Roman', serif";
const BODY_STACK = "Teachers, Verdana, Arial, sans-serif";

/** Deterministic SVG overlay (transparent above the panel, opaque in it). */
export function postCardSvg(layout: ReturnType<typeof buildPostCardLayout>): string {
  const P = POST_CARD;
  const cx = layout.panel.x + P.panelPadX; // shared text x
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${P.width}" height="${P.height}" viewBox="0 0 ${P.width} ${P.height}">`,
    `  <rect x="0" y="${layout.scrim.y}" width="${layout.scrim.width}" height="${layout.scrim.height}" fill="black" opacity="${layout.scrim.opacity}"/>`,
    `  <rect x="${layout.panel.x}" y="${layout.panel.y}" width="${layout.panel.width}" height="${layout.panel.height}" fill="${layout.panel.fill}"/>`,
    `  <rect x="0" y="${layout.accentBar.y}" width="${P.width}" height="${layout.accentBar.height}" fill="#${P.accentBar}"/>`,
    // Brand chip (top-left over the photo): dot + label
    `  <rect x="${layout.brandChip.x}" y="${layout.brandChip.y}" width="${layout.brandChip.rectWidth}" height="${layout.brandChip.rectHeight}" rx="${Math.round(layout.brandChip.rectHeight / 2)}" fill="${layout.brandChip.fill}"/>`,
    `  <circle cx="${layout.brandChip.x + layout.brandChip.padX + Math.round(layout.brandChip.size / 2)}" cy="${layout.brandChip.y + Math.round(layout.brandChip.rectHeight / 2)}" r="${Math.round(layout.brandChip.size / 2)}" fill="#${P.accentBar}"/>`,
    `  <text x="${layout.brandChip.textX}" y="${layout.brandChip.textY}" font-family="${BODY_STACK}" font-size="${layout.brandChip.fontSize}" font-weight="bold" letter-spacing="3" fill="${layout.brandChip.text}">${esc(layout.brandChip.label)}</text>`,
    // Price badge (top-right over the photo): rounded rect + centered text
    `  <rect x="${layout.priceBadge.x}" y="${layout.priceBadge.y}" width="${layout.priceBadge.width}" height="${layout.priceBadge.height}" rx="${layout.priceBadge.radius}" fill="${layout.priceBadge.fill}"/>`,
    `  <text x="${layout.priceBadge.textX}" y="${layout.priceBadge.textY}" font-family="${BODY_STACK}" font-size="${layout.priceBadge.fontSize}" font-weight="bold" text-anchor="middle" fill="${layout.priceBadge.textFill}">${esc(layout.priceBadge.text)}</text>`,
    // Copy panel: headline / body / footer
    `  <text font-family="${HEADLINE_STACK}" font-size="${layout.headline.size}" font-weight="bold" fill="#${P.ink}">${tspans(layout.headline.lines, cx, layout.headline.y, Math.round(layout.headline.size * 1.12))}</text>`,
    `  <text font-family="${BODY_STACK}" font-size="${layout.body.size}" fill="#${P.ink}">${tspans(layout.body.lines, cx, layout.body.y, layout.body.lineHeight)}</text>`,
    `  <text x="${cx}" y="${layout.footer.y}" font-family="${BODY_STACK}" font-size="${P.footerSize}" fill="#${P.mutedInk}">${esc(layout.footer.handle)}</text>`,
    `  <text x="${layout.panel.x + layout.panel.width - P.panelPadX}" y="${layout.footer.y}" text-anchor="end" font-family="${BODY_STACK}" font-size="${P.footerSize}" fill="#${P.mutedInk}">${esc(layout.footer.link)}</text>`,
    `</svg>`,
  ].join("\n");
}

/** Map of background names → {source} composites (sharp accepts SVG buffers). */
export interface ComposeInput extends PostCardInput {
  /** Path/URL of the EXISTING product image (read via storage helpers). */
  imageUrl: string;
}

export interface ComposeResult {
  buffer: Buffer;
  contentType: "image/jpeg";
  width: number;
  height: number;
}

/**
 * Fetch the product image, cover-crop it into the photo panel, overlay the
 * branded copy panel, return JPEG bytes. Throws on unreachable images —
 * callers decide the fallback.
 */
export async function composePostCard(input: ComposeInput): Promise<ComposeResult> {
  const { fetchImageBytes } = await import("@/lib/marketing/storage");
  const { bytes } = await fetchImageBytes(input.imageUrl);
  const layout = buildPostCardLayout(input);
  const svg = Buffer.from(postCardSvg(layout), "utf8");

  const photo = await sharp(bytes)
    .resize(POST_CARD.width, POST_CARD.photoHeight, { fit: "cover", position: "attention" })
    .toBuffer();

  const buffer = await sharp({
    create: {
      width: POST_CARD.width,
      height: POST_CARD.height,
      channels: 3,
      background: `#${POST_CARD.panelBg}`,
    },
  })
    .composite([
      { input: photo, top: 0, left: 0 },
      { input: svg, top: 0, left: 0 },
    ])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();

  return { buffer, contentType: "image/jpeg", width: POST_CARD.width, height: POST_CARD.height };
}
