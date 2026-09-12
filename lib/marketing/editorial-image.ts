/**
 * EDITORIAL post-card composer — renders the magazine-style creative with
 * sharp from the EXISTING photo (product photo or the Pollinations model-ad
 * creative):
 *
 *   full-bleed photo (1080×1350, attention crop)
 *     + warm monochrome wash (left gradient + bottom scrim)
 *     + letterspaced brand wordmark + stacked display headline
 *     + hashtag box + "FLAT ₹199" rule + translucent footer strip
 *
 * HARD RULE: text is rendered by sharp only — the price string is exact, and
 * the underlying photo is never re-generated. Failure throws; callers fall
 * back to the un-composed image.
 */
import "server-only";
import sharp from "sharp";
import {
  EDITORIAL_CARD,
  buildEditorialLayout,
  type EditorialCardInput,
  type EditorialLayout,
} from "@/lib/marketing/editorial-card";

/** XML-escape text destined for SVG nodes. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const DISPLAY_STACK = "Georgia, 'Times New Roman', serif";
const SCRIPT_STACK = "Segoe Script, 'Brush Script MT', cursive";
const BODY_STACK = "'Segoe UI', Arial, sans-serif";

/** Letterspaced wordmark as individual dx offsets (SVG letter-spacing varies). */
function spaced(text: string, x: number, y: number, size: number, gap: number, fill: string): string {
  const chars = [...text]
    .map((c, i) => `<tspan dx="${i === 0 ? 0 : gap}">${esc(c)}</tspan>`)
    .join("");
  return `<text x="${x}" y="${y}" font-family="${BODY_STACK}" font-weight="600" font-size="${size}" fill="${fill}">${chars}</text>`;
}

/** Deterministic SVG overlay (transparent where the photo shows through). */
export function editorialSvg(layout: EditorialLayout): string {
  const C = EDITORIAL_CARD;
  const { headline: h, hashtagBox: t, price: p, footer: f, wash: w } = layout;
  const ink = `#${C.ink}`;
  const cream = `#${C.cream}`;
  const deep = `#${C.deep}`;
  const accent = `#${C.accent}`;

  const l3Tspans = h.l3Lines
    .map((l, i) => `<tspan x="${h.x}" y="${h.l3Y + i * h.l3LineHeight}">${esc(l)}</tspan>`)
    .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${C.width}" height="${C.height}" viewBox="0 0 ${C.width} ${C.height}">`,
    `  <defs>`,
    `    <linearGradient id="washL" x1="0" y1="0" x2="1" y2="0">`,
    `      <stop offset="0" stop-color="#${w.color}" stop-opacity="${w.left}"/>`,
    `      <stop offset="0.62" stop-color="#${w.color}" stop-opacity="${(w.left * 0.45).toFixed(3)}"/>`,
    `      <stop offset="1" stop-color="#${w.color}" stop-opacity="0"/>`,
    `    </linearGradient>`,
    `    <linearGradient id="washB" x1="0" y1="1" x2="0" y2="0">`,
    `      <stop offset="0" stop-color="#${w.color}" stop-opacity="${w.bottom}"/>`,
    `      <stop offset="1" stop-color="#${w.color}" stop-opacity="0"/>`,
    `    </linearGradient>`,
    `  </defs>`,
    `  <rect width="${C.width}" height="${C.height}" fill="url(#washL)"/>`,
    `  <rect width="${C.width}" height="${C.height}" fill="url(#washB)"/>`,
    // Wordmark + short rule under it
    `  ${spaced(layout.wordmark.text, layout.wordmark.x, layout.wordmark.y, layout.wordmark.size, layout.wordmark.letterSpacing, cream)}`,
    `  <rect x="${layout.wordmark.x}" y="${layout.wordmark.ruleY}" width="${layout.wordmark.ruleWidth}" height="2" fill="${cream}" opacity="0.85"/>`,
    // Stacked display headline: big / script / deep tail
    `  <text x="${h.x}" y="${h.l1Y}" font-family="${DISPLAY_STACK}" font-size="${h.l1Size}" fill="${cream}">${esc(h.l1)}</text>`,
    h.l2
      ? `  <text x="${h.x + h.l2Indent}" y="${h.l2Y}" font-family="${SCRIPT_STACK}" font-size="${h.l2Size}" fill="${cream}">${esc(h.l2)}</text>`
      : "",
    h.l3Lines.length > 0
      ? `  <text font-family="${DISPLAY_STACK}" font-size="${h.l3Size}" font-weight="bold" fill="${deep}">${l3Tspans}</text>`
      : "",
    // Hashtag in a solid box
    `  <rect x="${t.x}" y="${t.y}" width="${t.boxW}" height="${t.boxH}" fill="${t.fill}"/>`,
    `  <text x="${t.textX}" y="${t.textY}" font-family="${BODY_STACK}" font-weight="700" font-size="${t.size}" fill="${t.textFill}">${esc(t.text)}</text>`,
    // Price line + accent rule
    `  ${spaced(p.text, p.x, p.y, p.size, p.letterSpacing, cream)}`,
    `  <rect x="${p.x}" y="${p.ruleY}" width="${p.ruleWidth}" height="${p.ruleHeight}" fill="${accent}"/>`,
    // Translucent footer strip
    `  <rect x="0" y="${f.y}" width="${C.width}" height="${f.height}" fill="#${C.footerBg}" opacity="0.92"/>`,
    `  <text x="${f.padX}" y="${f.textY}" font-family="${BODY_STACK}" font-weight="600" font-size="${f.size}" fill="${ink}">${esc(f.handle)}</text>`,
    `  <text x="${C.width - f.padX}" y="${f.textY}" text-anchor="end" font-family="${BODY_STACK}" font-size="${f.size}" fill="${ink}">${esc(f.link)}</text>`,
    `</svg>`,
  ]
    .filter(Boolean)
    .join("\n");
}

export interface ComposeEditorialResult {
  buffer: Buffer;
  contentType: "image/jpeg";
  width: number;
  height: number;
}

/**
 * Fetch the source photo, cover-crop to 4:5, apply the wash + typography,
 * return JPEG bytes. Throws on unreachable images — callers decide fallback.
 */
export async function composeEditorialCard(
  input: EditorialCardInput & { imageUrl: string },
): Promise<ComposeEditorialResult> {
  const { fetchImageBytes } = await import("@/lib/marketing/storage");
  const { bytes } = await fetchImageBytes(input.imageUrl);
  const layout = buildEditorialLayout(input);
  const svg = Buffer.from(editorialSvg(layout), "utf8");

  const photo = await sharp(bytes)
    .resize(EDITORIAL_CARD.width, EDITORIAL_CARD.height, { fit: "cover", position: "attention" })
    .modulate({ saturation: 1.06 })
    .toBuffer();

  const buffer = await sharp(photo)
    .composite([{ input: svg, top: 0, left: 0 }])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();

  return { buffer, contentType: "image/jpeg", width: EDITORIAL_CARD.width, height: EDITORIAL_CARD.height };
}
