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
  assetImageUrls?: string[];
  styleHint?: string;
  seed?: number;
}

export interface PuterPromoResult {
  buffer: Buffer;
  contentType: string;
  engine: string;
  localPath?: string;
}

const PUTER_PROMO_MODEL =
  process.env.PUTER_PROMO_IMAGE_MODEL?.trim() || "gemini-3.1-flash-image-preview";

export function puterPromoEnabled(): boolean {
  return Boolean(process.env.PUTER_TXT2IMG_ENDPOINT?.trim()) || puterRelayConnected();
}

export function buildPuterPromoPrompt(input: PuterPromoInput): string {
  const styleSeed = Math.abs(input.seed ?? Date.now()) % 4;
  const themes = [
    "Theme A Warm Heritage: a photorealistic Bengali woman in a saree seated near aged stone/terracotta architecture, warm sunlight and natural shadow play, premium boutique fashion mood",
    "Theme B Minimalist Studio: a photorealistic Bengali woman in a saree standing in a beige/champagne studio, linen drapery, soft pedestal shapes, subtle rim lighting, modern luxury ecommerce mood",
    "Theme C Festive Luxury: a photorealistic Bengali woman in a saree in a deep emerald/burgundy/navy festive set, antique gold accents, soft diya bokeh, tasteful Durga Puja season richness",
    "Theme D Earthy Contemporary: a photorealistic Bengali woman in a saree with raw clay plaster walls, dried botanical shadows, warm bokeh, calm editorial craft mood",
  ];
  const poses = [
    "standing in a graceful three-quarter pose with relaxed hands and direct warm eye contact",
    "seated elegantly on a carved wooden chair, saree pleats visible, calm editorial expression",
    "walking softly through the set with natural movement in the pallu, candid premium catalogue feel",
    "adjusting earrings beside a mirror, composed side profile, refined festive styling",
    "standing near an old window with the pallu held lightly, natural daylight and serene expression",
  ];
  const styling = [
    "minimal gold jewellery, small bindi, neatly tied low bun with jasmine hints",
    "soft open hair, small bindi, understated earrings, natural Bengali beauty styling",
    "traditional low bun, kohl-lined eyes, tasteful necklace, polished but realistic makeup",
    "simple everyday jewellery, natural skin texture, friendly non-plastic expression",
  ];
  const fabric = input.fabric?.trim() ? ` Fabric: ${input.fabric.trim()}.` : "";
  const style = input.styleHint?.trim() || themes[styleSeed];
  const assetCount = input.assetImageUrls?.length ?? 1;
  const pose = poses[Math.abs((input.seed ?? 0) * 3 + 1) % poses.length];
  const modelStyling = styling[Math.abs((input.seed ?? 0) * 5 + 2) % styling.length];

  return [
    `Create a full-bleed premium portrait 1080x1350 fashion campaign photograph for ${SITE.name}, a Bengali saree marketplace.`,
    `Product: ${input.productName}. Category: ${input.category.replace(/-/g, " ")}.${fabric}`,
    `Use the provided reference image if available only to infer the saree's colour family, fabric character, border feel, and motif mood. It is acceptable to create a more professional text-to-image campaign look if the reference product photo is not studio quality. Reference assets available: ${assetCount}.`,
    style + ".",
    `Model direction: ${pose}; ${modelStyling}.`,
    "Composition: one main model, elegant head-to-knee or full-body crop, model on center/right with clear negative space on the left and lower third for text overlays. Vary the set, pose, face, and styling from previous generations. Do not use collage panels.",
    "The model must look like a real adult Bengali woman, not plastic AI: natural face, believable hands, normal body proportions, tasteful saree drape, subtle bindi and jewellery. Avoid distorted anatomy, extra fingers, waxy skin, or fantasy faces.",
    "Make it look like a premium Indian fashion brand advertisement: cinematic light, deep but natural contrast, crisp saree fabric, elegant pose, refined editorial styling.",
    "Absolutely no generated text, no readable words, no logo, no watermark, no fake brand names, no price, no numbers, no QR code, no UI. The app will add all typography later.",
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
      model: PUTER_PROMO_MODEL,
      width: 1080,
      height: 1350,
      format: "portrait",
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
      model: PUTER_PROMO_MODEL,
      width: 1080,
      height: 1350,
      format: "portrait",
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
