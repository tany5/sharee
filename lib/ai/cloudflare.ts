import "server-only";
import {
  cloudflareImageModel,
  cloudflareWorkerSecret,
  cloudflareWorkerUrl,
} from "@/lib/ai/config";
import type { TryOnPose } from "@/lib/marketing/tryon";
import { fetchImageBytes } from "@/lib/marketing/storage";

/**
 * Product catalogue pose generation via the Cloudflare image worker
 * (Workers AI FLUX.2 klein, multi-reference: model + saree + optional pose).
 *
 * Poses are matched with DISTINCT backgrounds so a four-photo gallery looks
 * like one real catalogue shoot in different setups, not the same frame
 * repeated. Realism rules: a believable Bengali woman (never a doll/plastic
 * AI render), light everyday jewellery — never heavy bridal sets.
 */

type GalleryPose = TryOnPose | "full_saree";

interface CloudflarePoseResult {
  bytes: Buffer;
  contentType: string;
  provider: string;
}

/** One distinct background per pose — varied like a real catalogue shoot. */
const POSE_SETUPS: Record<
  GalleryPose,
  { pose: string; background: string; width: number; height: number }
> = {
  front: {
    pose:
      "front-facing full-body catalogue pose, camera at chest height, relaxed natural stance, both feet visible, natural gentle smile",
    background:
      "seamless warm ivory studio backdrop with soft falloff, clean and bright",
    width: 896,
    height: 1152,
  },
  side: {
    pose:
      "side-view full-body catalogue pose, body turned about 70 degrees, face visible in profile, relaxed stance, both feet visible",
    background:
      "warm beige textured wall with soft window light from the left and gentle floor shadow",
    width: 896,
    height: 1152,
  },
  back: {
    pose:
      "back-view full-body catalogue pose showing the pallu falling down the back, hair pinned up so the blouse back and drape are clearly visible, both feet visible",
    background:
      "muted terracotta plaster wall, softly lit, editorial boutique feel",
    width: 896,
    height: 1152,
  },
  full_saree: {
    pose:
      "three-quarter full-body catalogue pose, one hand lightly holding the pallu, pallu drape over the left shoulder clearly visible, head to toe in frame",
    background:
      "elegant heritage courtyard: cream wall, wooden door frame, soft daylight, minimal props",
    width: 896,
    height: 1152,
  },
};

function buildPosePrompt(input: {
  pose: GalleryPose;
  productName?: string;
}): string {
  const setup = POSE_SETUPS[input.pose] ?? POSE_SETUPS.front;
  const product = input.productName ? `Product: ${input.productName}.` : "";
  return [
    product,
    "INPUT IMAGE 1 is the MODEL REFERENCE: preserve her identity, face, age appearance, hairstyle and realistic body proportions exactly.",
    "INPUT IMAGE 2 is the EXACT SAREE PRODUCT REFERENCE and the source of truth: reproduce its exact base colour, border palette and width, motif style and placement, pallu design, fabric sheen and weave texture. Do not redesign, recolour, simplify or invent the saree. Drape the same saree naturally with realistic pleats, believable fabric weight and correct garment geometry.",
    `Pose: ${setup.pose}.`,
    `Background: ${setup.background}. This photo must NOT share its background with the other catalogue shots.`,
    `Photography: premium Indian ecommerce catalogue photo, realistic skin texture with visible pores, natural facial asymmetry, normal hands with five fingers, believable anatomy, natural soft lighting, vertical portrait ${setup.width}x${setup.height}, head to toe inside frame with safe space above the head and below the feet. Saree remains the hero.`,
    "Model appearance: a real Bengali/Indian woman who could walk into the shop — natural dark hair, subtle bindi, minimal natural makeup. Jewellery is LIGHT everyday wear only: small stud or jhumka earrings, a thin chain or simple pendant, maybe one thin bangle. Absolutely no heavy bridal jewellery sets, no large chokers, no maang tikka, no stacks of bangles.",
    "Do NOT look AI-generated: no plastic or porcelain skin, no doll face, no over-smooth beauty-filter look, no exaggerated tiny waist, no glossy lips. She must read as a real person in a real photo.",
    "Do not add text, logo, watermark, price tag, promotional graphics, extra people, random clothing or props unrelated to the scene.",
  ].join(" ");
}

async function toDataUrl(url: string): Promise<string> {
  const { bytes, contentType } = await fetchImageBytes(url);
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

interface CloudflareWorkerResponse {
  success?: boolean;
  image?: string;
  contentType?: string;
  model?: string;
  error?: string;
}

/**
 * Generate one catalogue pose via the Cloudflare worker.
 * `modelUrl` comes from the existing Saree Models system; `garmentUrl` is the
 * admin's original saree photo (source of truth).
 */
export async function runCloudflarePose(input: {
  modelUrl: string;
  garmentUrl: string;
  productName?: string;
  pose: GalleryPose;
}): Promise<CloudflarePoseResult> {
  const workerUrl = cloudflareWorkerUrl();
  const model = cloudflareImageModel();
  if (!workerUrl) {
    throw new Error(
      "Cloudflare image worker is not configured. Set CLOUDFLARE_IMAGE_WORKER_URL in .env.local and start it with `npx wrangler dev`.",
    );
  }

  const [modelImage, sareeImage] = await Promise.all([
    toDataUrl(input.modelUrl),
    toDataUrl(input.garmentUrl),
  ]);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = cloudflareWorkerSecret();
  if (secret) headers.Authorization = `Bearer ${secret}`;

  const setup = POSE_SETUPS[input.pose] ?? POSE_SETUPS.front;
  const res = await fetch(`${workerUrl}/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt: buildPosePrompt({ pose: input.pose, productName: input.productName }),
      modelImage,
      sareeImage,
      width: setup.width,
      height: setup.height,
    }),
    signal: AbortSignal.timeout(180_000),
  });

  const raw = (await res.json().catch(() => ({}))) as CloudflareWorkerResponse;
  if (!res.ok || !raw.success || !raw.image) {
    const detail = raw.error ?? `HTTP ${res.status}`;
    if (res.status === 429 || /quota|allocation/i.test(detail)) {
      throw new Error(
        "Cloudflare Workers AI daily free allocation may be reached — try again after the reset or switch to Qwen.",
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error("Cloudflare image worker rejected the request (auth). Check CLOUDFLARE_IMAGE_WORKER_SECRET on both sides.");
    }
    throw new Error(`Cloudflare image generation failed: ${detail}`);
  }
  return {
    bytes: Buffer.from(raw.image, "base64"),
    contentType: raw.contentType ?? "image/png",
    provider: `cloudflare:${raw.model ?? model}`,
  };
}
