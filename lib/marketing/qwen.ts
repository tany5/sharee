import "server-only";
import { fetchImageBytes } from "@/lib/marketing/storage";
import type { TryOnPose } from "@/lib/marketing/tryon";

type QwenPose = Exclude<TryOnPose, "full_saree">;

export interface QwenImageEditInput {
  apiKey?: string;
  modelUrl: string;
  garmentUrl: string;
  productName?: string;
  pose: QwenPose;
  endpoint?: string;
  model?: string;
}

export interface QwenImageEditResult {
  bytes: Buffer;
  contentType: string;
  provider: string;
}

type DashScopeTaskResponse = {
  request_id?: string;
  code?: string;
  message?: string;
  output?: {
    task_id?: string;
    task_status?: string;
    message?: string;
    results?: Array<{ url?: string; image_url?: string }>;
    choices?: Array<{
      message?: {
        content?: Array<{ image?: string; url?: string; image_url?: string; text?: string }>;
      };
    }>;
    url?: string;
  };
};

const DEFAULT_ENDPOINT = "https://dashscope-intl.aliyuncs.com/api/v1";
const DEFAULT_MODEL = "qwen-image-edit";
const MAX_POLL_MS = Number(process.env.QWEN_IMAGE_TIMEOUT_MS ?? 180_000) || 180_000;

const POSE_PROMPTS: Record<QwenPose, string> = {
  front:
    "front-facing full-body catalogue pose, camera at chest height, relaxed natural stance, both feet visible",
  side:
    "side-view full-body catalogue pose, body turned 70 degrees, face natural, relaxed natural stance, both feet visible",
  back:
    "back-view full-body catalogue pose, show the pallu and back drape clearly, relaxed natural stance, both feet visible",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeEndpoint(endpoint?: string): string {
  return (endpoint ?? DEFAULT_ENDPOINT).replace(/\/+$/, "");
}

async function toDataUrl(url: string): Promise<string> {
  const { bytes, contentType } = await fetchImageBytes(url);
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

function resultUrl(data: DashScopeTaskResponse): string | undefined {
  const choiceContent = data.output?.choices?.flatMap((choice) => choice.message?.content ?? []) ?? [];
  return (
    data.output?.results?.find((item) => item.url || item.image_url)?.url ??
    data.output?.results?.find((item) => item.url || item.image_url)?.image_url ??
    choiceContent.find((item) => item.image || item.url || item.image_url)?.image ??
    choiceContent.find((item) => item.image || item.url || item.image_url)?.url ??
    choiceContent.find((item) => item.image || item.url || item.image_url)?.image_url ??
    data.output?.url
  );
}

function qwenError(prefix: string, data?: DashScopeTaskResponse): Error {
  const detail = [data?.code, data?.message, data?.output?.message].filter(Boolean).join(": ");
  return new Error(detail ? `${prefix}: ${detail}` : prefix);
}

function buildPrompt(input: QwenImageEditInput): string {
  const product = input.productName ? `Product: ${input.productName}.` : "";
  // Each pose gets its OWN background so a four-photo gallery reads like a
  // real catalogue shoot in different setups, not the same frame repeated.
  const BACKGROUNDS: Record<QwenPose, string> = {
    front:
      "seamless warm ivory studio backdrop with soft falloff, clean and bright",
    side:
      "warm beige textured wall with soft window light from the left and gentle floor shadow",
    back:
      "muted terracotta plaster wall, softly lit, editorial boutique feel",
  };
  const background = BACKGROUNDS[input.pose];
  return [
    product,
    "Use image 1 as the exact adult human model reference and image 2 as the exact saree product reference.",
    "Create a professional Indian saree ecommerce try-on photo for a Bengali saree shop.",
    `Pose: ${POSE_PROMPTS[input.pose]}.`,
    `Background: ${background}. This photo must NOT share its background with the other catalogue shots.`,
    "First visually inspect image 2: identify the true base colour, border palette, border width, printed motif style, scattered body motifs, pallu design, fabric sheen, and weave texture. Reproduce those exact product traits on the draped saree.",
    "Drape the same saree from image 2 onto the model. Preserve the original teal/turquoise base when present, printed paisley/floral border when present, magenta/yellow/blue accent motifs when present, scattered small body motifs, dark fold shadows, sheen, pallu identity, and border placement.",
    "Do not invent a new saree. Do not convert printed borders into gold zari, do not simplify the fabric into a plain solid saree, do not change the colour family, and do not replace the pallu pattern.",
    "Use a simple matching blouse based on the saree base colour. Keep Bengali styling subtle: small forehead bindi, LIGHT everyday jewellery only — small stud or jhumka earrings, a thin chain or simple pendant, at most one thin bangle. No heavy bridal jewellery sets, no large chokers, no maang tikka, no stacks of bangles.",
    "The model must look like a normal real adult Bengali woman, not a synthetic beauty render: realistic skin texture with visible pores, slight natural facial asymmetry, normal eyes, normal hands, natural shoulders and waist, believable body proportions. No plastic or porcelain skin, no doll face, no beauty-filter smoothness, no glossy lips, no exaggerated tiny waist.",
    "The final output must be a vertical portrait catalogue image, preferably 4:5 or 3:4. Do not return a landscape banner, flat lay, fabric-only image, folded saree image, or garment-only product photo.",
    "Show the full body and full saree drape with head, hands, and feet inside frame. Keep generous safe space above the head and below the feet. Keep the face sharp and undistorted. Use clean catalogue lighting that fits the described background.",
    "Avoid fashion-poster exaggeration, doll-like face, plastic skin, tiny waist, extra limbs, duplicate fingers, broken hands, warped torso, cropped head, cropped feet, flat-lay fabric, garment-only image, landscape canvas, mask, sunglasses, heavy bridal jewellery, watermark, text, logo, and any mismatch with the source saree.",
  ].join(" ");
}

type QwenContentItem = { image?: string; text?: string };

async function submitQwenImageTask(input: {
  apiKey?: string;
  endpoint?: string;
  model?: string;
  content: QwenContentItem[];
  parameters?: Record<string, unknown>;
}): Promise<QwenImageEditResult> {
  const apiKey = input.apiKey?.trim();
  if (!apiKey) throw new Error("Qwen API key missing. Add QWEN_API_KEY or DASHSCOPE_API_KEY.");

  const endpoint = normalizeEndpoint(input.endpoint ?? process.env.QWEN_API_ENDPOINT);
  const model = input.model ?? process.env.QWEN_IMAGE_MODEL ?? DEFAULT_MODEL;
  const body = JSON.stringify({
    model,
    input: {
      messages: [
        {
          role: "user",
          content: input.content,
        },
      ],
    },
    parameters: {
      watermark: false,
      ...input.parameters,
    },
  });
  const url = `${endpoint}/services/aigc/multimodal-generation/generation`;
  const submit = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
    body,
    signal: AbortSignal.timeout(60_000),
  });

  const submitted = (await submit.json().catch(() => undefined)) as DashScopeTaskResponse | undefined;
  if (!submit.ok && submit.status === 403 && /asynchronous/i.test(`${submitted?.message ?? ""} ${submitted?.output?.message ?? ""}`)) {
    const sync = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
      signal: AbortSignal.timeout(MAX_POLL_MS),
    });
    const synced = (await sync.json().catch(() => undefined)) as DashScopeTaskResponse | undefined;
    if (!sync.ok) throw qwenError(`Qwen sync submit failed (${sync.status})`, synced);
    const directUrl = synced ? resultUrl(synced) : undefined;
    if (!directUrl) throw qwenError("Qwen sync completed but returned no image URL", synced);
    const image = await fetch(directUrl, { redirect: "follow", signal: AbortSignal.timeout(60_000) });
    if (!image.ok) throw new Error(`Qwen result download failed (${image.status})`);
    return {
      bytes: Buffer.from(await image.arrayBuffer()),
      contentType: image.headers.get("content-type")?.split(";")[0] ?? "image/png",
      provider: `qwen:${model}`,
    };
  }

  if (!submit.ok || !submitted?.output?.task_id) {
    throw qwenError(`Qwen submit failed (${submit.status})`, submitted);
  }

  const taskId = submitted.output.task_id;
  const startedAt = Date.now();
  while (Date.now() - startedAt < MAX_POLL_MS) {
    await sleep(3000);
    const statusRes = await fetch(`${endpoint}/tasks/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(30_000),
    });
    const status = (await statusRes.json().catch(() => undefined)) as DashScopeTaskResponse | undefined;
    if (!statusRes.ok) throw qwenError(`Qwen status failed (${statusRes.status})`, status);

    const taskStatus = status?.output?.task_status;
    if (taskStatus === "SUCCEEDED") {
      const url = status ? resultUrl(status) : undefined;
      if (!url) throw qwenError("Qwen completed but returned no image URL", status);
      const image = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(60_000) });
      if (!image.ok) throw new Error(`Qwen result download failed (${image.status})`);
      return {
        bytes: Buffer.from(await image.arrayBuffer()),
        contentType: image.headers.get("content-type")?.split(";")[0] ?? "image/png",
        provider: `qwen:${model}`,
      };
    }
    if (taskStatus === "FAILED" || taskStatus === "CANCELED" || taskStatus === "UNKNOWN") {
      throw qwenError(`Qwen task ${taskStatus.toLowerCase()}`, status);
    }
  }

  throw new Error(`Qwen task timed out after ${Math.round(MAX_POLL_MS / 1000)} seconds`);
}

export async function runQwenImageEdit(input: QwenImageEditInput): Promise<QwenImageEditResult> {
  const [modelImage, garmentImage] = await Promise.all([
    toDataUrl(input.modelUrl),
    toDataUrl(input.garmentUrl),
  ]);

  return submitQwenImageTask({
    apiKey: input.apiKey,
    endpoint: input.endpoint,
    model: input.model,
    content: [
      { image: modelImage },
      { image: garmentImage },
      { text: buildPrompt(input) },
    ],
    parameters: {
      negative_prompt:
        "low quality, blurry face, distorted face, doll face, plastic skin, synthetic CGI model, tiny waist, warped torso, mask, sunglasses, watermark, text, logo, cropped head, cropped feet, flat lay, fabric-only, garment-only, folded cloth, landscape banner, wide canvas, extra fingers, extra arms, deformed hands, broken fingers, wrong saree colour, generic gold saree, invented zari border, plain solid saree, missing printed border, missing motifs, wrong pallu",
    },
  });
}
