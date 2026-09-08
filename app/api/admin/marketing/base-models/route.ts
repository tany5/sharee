import { NextResponse } from "next/server";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";
import {
  baseModels,
  deleteBaseModel,
  generateSyntheticBaseModel,
  renameBaseModel,
  uploadBaseModel,
} from "@/lib/marketing/store";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

/** GET /api/admin/marketing/base-models — list curated model avatars. */
export async function GET() {
  if (!(await requireAdmin())) return unauthorized();
  return NextResponse.json({ ok: true, models: await baseModels() });
}

/**
 * POST /api/admin/marketing/base-models — upload a new avatar
 * (multipart form: file=<image>). Files land in the `base-models` bucket
 * (Supabase) or the demo uploads dir.
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await request.json()) as { action?: string; name?: string };
      if (body.action !== "generate") {
        return NextResponse.json({ ok: false, error: "Unknown model action" }, { status: 400 });
      }
      const model = await generateSyntheticBaseModel(body.name);
      return NextResponse.json({ ok: true, model, models: await baseModels() });
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: (err as Error).message ?? "Could not generate model" },
        { status: 400 },
      );
    }
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Expected multipart upload" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "File must be under 8 MB" }, { status: 400 });
  }

  try {
    const model = await uploadBaseModel(file);
    return NextResponse.json({ ok: true, model, models: await baseModels() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message ?? "Upload failed" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const body = (await request.json()) as { id?: string; name?: string };
    const id = String(body.id ?? "").trim();
    const name = String(body.name ?? "").trim();
    if (!id || name.length < 2) {
      return NextResponse.json({ ok: false, error: "Model name is required" }, { status: 400 });
    }
    const model = await renameBaseModel(id, name);
    return NextResponse.json({ ok: true, model, models: await baseModels() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message ?? "Could not update model" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const body = (await request.json()) as { id?: string };
    const id = String(body.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: "Choose a model" }, { status: 400 });
    }
    await deleteBaseModel(id);
    return NextResponse.json({ ok: true, models: await baseModels() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message ?? "Could not delete model" },
      { status: 400 },
    );
  }
}
