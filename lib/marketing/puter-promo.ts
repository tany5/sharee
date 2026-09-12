/**
 * Puter promo image bridge.
 *
 * Puter.js image generation runs in a signed-in browser session, not with the
 * server-side Meta/Qwen secrets used elsewhere. For automation we support a
 * local/private relay endpoint through PUTER_TXT2IMG_ENDPOINT. The browser
 * studio page can use the same prompt contract manually.
 */
import "server-only";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SITE } from "@/lib/site";
import { fetchImageBytes } from "@/lib/marketing/storage";
import {
  createPuterRelayJob,
  puterRelayConnected,
  waitForPuterRelayJob,
} from "@/lib/marketing/puter-relay-store";

export interface PuterPromoInput {
  productName: string;
  category: string;
  fabric?: string;
  price: number;
  heroImageUrl: string;
  styleHint?: string;
  seed?: number;
}

export interface PuterPromoResult {
  buffer: Buffer;
  contentType: string;
  engine: string;
  localPath?: string;
}

export function puterPromoEnabled(): boolean {
  return Boolean(process.env.PUTER_TXT2IMG_ENDPOINT?.trim()) || puterRelayConnected();
}

export function buildPuterPromoPrompt(input: PuterPromoInput): string {
  const styleSeed = Math.abs(input.seed ?? Date.now()) % 6;
  const layouts = [
    "minimal premium magazine layout with large negative space on the left and the model fully visible on the right",
    "warm boutique fashion poster with a realistic seated model, clean offer area, and uncluttered traditional decor",
    "festive Bengali editorial scene with subtle brass lamp and warm wall texture, model visible from head to toe",
    "modern Indian ecommerce campaign with soft cream background, elegant arches, and balanced product-first composition",
    "luxury saree catalogue advertisement with earthy terracotta backdrop, tasteful floral accents, and realistic studio lighting",
    "bright but refined sale poster with red, cream and gold accents, clean typography zone, and natural lifestyle pose",
  ];
  const fabric = input.fabric?.trim() ? ` Fabric: ${input.fabric.trim()}.` : "";
  const style = input.styleHint?.trim() || layouts[styleSeed];

  return [
    `Create a premium, eye-catching square 1:1 Facebook and Instagram advertisement for ${SITE.name}, a Bengali saree marketplace.`,
    `Product: ${input.productName}. Category: ${input.category.replace(/-/g, " ")}.${fabric}`,
    "Show an elegant realistic Indian/Bengali woman wearing a beautiful saree. She should look like a real everyday woman photographed professionally, not a plastic AI model.",
    "The saree must be the hero: rich fabric texture, clear border, detailed drape, visible pallu, authentic Indian saree styling.",
    style + ".",
    "Keep the model fully visible and never hidden behind promotional text. Leave clean negative space for text away from the face and saree details.",
    "Use premium commercial fashion photography: natural skin texture, realistic hands, realistic body proportions, professional studio lighting, sharp high-resolution finish.",
    "Use a refined Bengali-inspired palette with reds, creams, golds, terracotta, magenta, teal or deep blue. Vary the composition from previous posts.",
    "Include only this promotional text, with strong hierarchy and professional fonts:",
    `"${SITE.name}"`,
    `"OUR SAREE"`,
    `"₹${input.price} FLAT"`,
    `"SHIPPING INCLUDED"`,
    `"SHOP NOW"`,
    `"₹${input.price} FLAT" must be the largest and instantly readable.`,
    "No regional coverage text. No fake brand names, no watermark, no extra logos, no crossed-out text, no spelling mistakes, no clutter.",
    "The final image should feel trustworthy, affordable, fashionable, modern, minimalistic, and suitable for a professional saree marketplace ad.",
  ].join(" ");
}

export async function generatePuterPromoImage(input: PuterPromoInput): Promise<PuterPromoResult | null> {
  const endpoint = process.env.PUTER_TXT2IMG_ENDPOINT?.trim();
  const useBrowserRelay = !endpoint && puterRelayConnected();
  if (!endpoint && !useBrowserRelay) return null;

  const { bytes, contentType } = await fetchImageBytes(input.heroImageUrl);
  const imageDataUrl = `data:${contentType};base64,${bytes.toString("base64")}`;
  const prompt = buildPuterPromoPrompt(input);
  if (useBrowserRelay) {
    const job = createPuterRelayJob({
      prompt,
      imageDataUrl,
      product: {
        name: input.productName,
        category: input.category,
        fabric: input.fabric,
        price: input.price,
      },
      width: 1080,
      height: 1080,
      format: "square",
    });
    const completed = await waitForPuterRelayJob(job.id, Number(process.env.PUTER_RELAY_TIMEOUT_MS ?? 180_000));
    if (completed.status === "failed") throw new Error(completed.error || "Puter relay failed");
    return savePuterImage({
      imageDataUrl: completed.imageDataUrl,
      url: completed.imageUrl,
      contentType: completed.contentType,
      engine: "puter-browser-relay:txt2img",
      productName: input.productName,
    });
  }

  const res = await fetch(endpoint!, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt,
      imageDataUrl,
      product: {
        name: input.productName,
        category: input.category,
        fabric: input.fabric,
        price: input.price,
      },
      width: 1080,
      height: 1080,
      format: "square",
    }),
  });
  if (!res.ok) throw new Error(`Puter relay failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as {
    imageDataUrl?: string;
    dataUrl?: string;
    image?: string;
    url?: string;
    contentType?: string;
    engine?: string;
  };
  return savePuterImage({
    imageDataUrl: json.imageDataUrl ?? json.dataUrl ?? json.image,
    url: json.url,
    contentType: json.contentType,
    engine: json.engine || "puter-relay:txt2img",
    productName: input.productName,
  });
}

async function savePuterImage(input: {
  imageDataUrl?: string;
  url?: string;
  contentType?: string;
  engine: string;
  productName: string;
}): Promise<PuterPromoResult> {
  const out = input.imageDataUrl;
  let buffer: Buffer;
  let outType = input.contentType ?? "image/png";
  if (out?.startsWith("data:")) {
    const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(out);
    if (!m) throw new Error("Puter relay returned an invalid data URL");
    outType = m[1] || outType;
    buffer = Buffer.from(m[2] || "", "base64");
  } else if (input.url) {
    const remote = await fetchImageBytes(input.url);
    buffer = remote.bytes;
    outType = remote.contentType;
  } else {
    throw new Error("Puter relay returned no image");
  }
  if (buffer.length < 10_000) throw new Error("Puter relay returned an image that is too small");

  const localDir = process.env.PUTER_OUTPUT_DIR?.trim() || path.join("D:", "TheTanti-AI", "generated", "social-creatives", "puter");
  mkdirSync(localDir, { recursive: true });
  const ext = outType.includes("jpeg") || outType.includes("jpg") ? "jpg" : outType.includes("webp") ? "webp" : "png";
  const localPath = path.join(localDir, `${Date.now()}-${input.productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "saree-promo"}.${ext}`);
  writeFileSync(localPath, buffer);

  return {
    buffer,
    contentType: outType,
    engine: input.engine,
    localPath,
  };
}
