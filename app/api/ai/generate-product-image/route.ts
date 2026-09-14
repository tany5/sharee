import { NextResponse } from "next/server";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";
import {
  generateProductImage,
  providerStatus,
  DEFAULT_SAREE_PROMPT,
} from "@/lib/ai/image-provider";
import { baseModels } from "@/lib/marketing/store";
import type { GenerateProductImageRequest } from "@/lib/ai/types";

export const dynamic = "force-dynamic";
// A cold Cloudflare worker + model queue can be slow.
export const maxDuration = 240;

/** GET → provider status for the admin UI (no secrets, debug-gated worker URL). */
export async function GET() {
  if (!(await requireAdmin())) return unauthorized();
  return NextResponse.json({ ok: true, status: providerStatus(), defaultPrompt: DEFAULT_SAREE_PROMPT });
}

/**
 * POST → generate one product image with the configured provider.
 * Body: { sareeImage, modelImage?, poseImage?, backgroundImage?, prompt?, aspectRatio? }
 *
 * `modelImage` may be omitted — the first existing Saree Model is used.
 * Nothing is persisted here: the result is returned to the editor as a draft
 * preview and only becomes a product image when the admin saves it.
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const sareeImage = typeof body.sareeImage === "string" ? body.sareeImage.trim() : "";
  if (!sareeImage) {
    return NextResponse.json(
      { ok: false, error: "Upload (or save) a saree product image first" },
      { status: 400 },
    );
  }

  // Model reference: explicit data URL/URL, else the existing Saree Models system.
  let modelImage = typeof body.modelImage === "string" ? body.modelImage.trim() : "";
  if (!modelImage) {
    try {
      const models = await baseModels();
      modelImage = models[0]?.imageUrl ?? "";
    } catch {
      modelImage = "";
    }
  }
  if (!modelImage) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No model reference available. Add one in Admin → Saree Models, or pick a model in the editor.",
      },
      { status: 400 },
    );
  }

  const aspect = String(body.aspectRatio ?? "3:4");
  const genRequest: GenerateProductImageRequest = {
    sareeImage,
    modelImage,
    poseImage: typeof body.poseImage === "string" ? body.poseImage : undefined,
    backgroundImage: typeof body.backgroundImage === "string" ? body.backgroundImage : undefined,
    prompt: typeof body.prompt === "string" ? body.prompt : undefined,
    aspectRatio: (["1:1", "3:4", "4:5", "9:16"].includes(aspect) ? aspect : "3:4") as GenerateProductImageRequest["aspectRatio"],
  };

  const result = await generateProductImage(genRequest);
  return NextResponse.json({ ok: result.success, result }, { status: result.success ? 200 : 502 });
}
