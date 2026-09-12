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
  front: "front-facing full-body catalogue pose, camera at chest height, both feet visible",
  side: "side-view full-body catalogue pose, body turned 70 degrees, face natural, both feet visible",
  back: "back-view full-body catalogue pose, show the pallu and back drape clearly, both feet visible",
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
  return [
    product,
    "Use image 1 as the exact human model reference and image 2 as the exact saree fabric reference.",
    "Create a professional Indian saree ecommerce try-on photo.",
    `Pose: ${POSE_PROMPTS[input.pose]}.`,
    "Drape the exact saree from image 2 onto the model, preserving the saree's dominant colour, border colour, motif style, zari/embroidery placement, sheen, weave feel, and pallu identity.",
    "Use a tasteful matching blouse, Bengali styling with a small forehead bindi, clean makeup, natural hands, realistic face, realistic body proportions, studio/catalogue lighting, plain warm neutral background.",
    "Show the full body and full saree drape. Keep the face sharp and undistorted.",
    "Do not add mask, sunglasses, watermark, extra text, extra logos, duplicate limbs, distorted fingers, or cropped feet.",
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
        "low quality, blurry face, distorted face, mask, sunglasses, watermark, text, logo, cropped feet, extra fingers, extra arms, deformed hands, wrong saree colour, missing border",
    },
  });
}
