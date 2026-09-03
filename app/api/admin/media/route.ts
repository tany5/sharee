import { NextResponse } from "next/server";
import { saveMediaFile } from "@/lib/backend";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";

const MAX_BYTES = 8 * 1024 * 1024;

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
    const url = await saveMediaFile(file);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    const e = err as { message?: string };
    return NextResponse.json(
      { ok: false, error: e.message ?? "Upload failed" },
      { status: 400 },
    );
  }
}
