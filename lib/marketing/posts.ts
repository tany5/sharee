/**
 * Free branded still-image posts generated from one saree upload.
 *
 * These become both product-gallery images and FB/IG image creatives:
 * front try-on, back drape, fabric detail and price post.
 */
import "server-only";
import type { AdCopy } from "@/lib/marketing/types";

export interface ImagePostInput {
  tryOnBytes: Buffer;
  sideBytes?: Buffer;
  backBytes?: Buffer;
  fabricBytes: Buffer;
  productName: string;
  price: number;
  copy: AdCopy;
}

export interface RenderedImagePost {
  kind: "front" | "back" | "detail" | "price";
  bytes: Buffer;
  contentType: "image/jpeg";
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function overlaySvg({
  width,
  height,
  title,
  subtitle,
  footer,
}: {
  width: number;
  height: number;
  title: string;
  subtitle: string;
  footer?: string;
}): Buffer {
  const bandTop = Math.round(height * 0.68);
  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="${bandTop}" width="${width}" height="${height - bandTop}" fill="#1c0d05" opacity="0.78"/>
      <text x="${width / 2}" y="${bandTop + 92}" text-anchor="middle" font-family="Georgia, serif" font-size="${Math.round(width * 0.062)}" font-weight="700" fill="#ffffff">${escapeXml(title)}</text>
      <text x="${width / 2}" y="${bandTop + 154}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(width * 0.036)}" fill="#f6ebe1">${escapeXml(subtitle)}</text>
      ${
        footer
          ? `<text x="${width / 2}" y="${height - 48}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(width * 0.03)}" fill="#d9ae76">${escapeXml(footer)}</text>`
          : ""
      }
    </svg>
  `);
}

async function cover(bytes: Buffer, width: number, height: number): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(bytes)
    .resize(width, height, { fit: "cover", position: "attention" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

async function brandedComposite(
  base: Buffer,
  width: number,
  height: number,
  text: { title: string; subtitle: string; footer?: string },
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(await cover(base, width, height))
    .composite([{ input: overlaySvg({ width, height, ...text }), top: 0, left: 0 }])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

export async function renderImagePosts(
  input: ImagePostInput,
): Promise<RenderedImagePost[]> {
  const firstBullet = input.copy.bullets[0] ?? "Soft daily comfort";
  const title = `ONLY Rs ${input.price}`;
  const secondary = "Cash on Delivery Available";

  const [front, back, detail, price] = await Promise.all([
    brandedComposite(input.tryOnBytes, 1080, 1350, {
      title: input.productName.slice(0, 34),
      subtitle: `${title} | ${secondary}`,
      footer: firstBullet.slice(0, 58),
    }),
    brandedComposite(input.backBytes ?? input.sideBytes ?? input.fabricBytes, 1080, 1350, {
      title: "Back Drape Look",
      subtitle: `${title} | soft fall and daily comfort`,
      footer: input.productName.slice(0, 46),
    }),
    brandedComposite(input.fabricBytes, 1080, 1080, {
      title: "Daily Wear Saree",
      subtitle: `${title} | breathable fabric`,
      footer: "Tap to order",
    }),
    brandedComposite(input.fabricBytes, 1080, 1080, {
      title: "Budget Saree",
      subtitle: "Comfort for home, office and gifting",
      footer: `${title} | COD available`,
    }),
  ]);

  return [
    { kind: "front", bytes: front, contentType: "image/jpeg" },
    { kind: "back", bytes: back, contentType: "image/jpeg" },
    { kind: "detail", bytes: detail, contentType: "image/jpeg" },
    { kind: "price", bytes: price, contentType: "image/jpeg" },
  ];
}
