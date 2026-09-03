import { NextResponse } from "next/server";
import { saveMedia, DbError } from "@/lib/demo/db";
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

  const original = file.name.split(".").pop() ?? "jpg";
  try {
    const url = saveMedia(Buffer.from(await file.arrayBuffer()), original);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    if (err instanceof DbError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
  }
}
