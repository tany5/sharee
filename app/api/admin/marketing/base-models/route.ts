import { NextResponse } from "next/server";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";
import { baseModels, uploadBaseModel } from "@/lib/marketing/store";

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
