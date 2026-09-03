import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { mediaPath } from "@/lib/demo/db";
import { mediaNeedsLocalProxy } from "@/lib/backend";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  // Supabase mode stores product photos in the public "Sharee" bucket and
  // returns their CDN URLs directly — this local proxy is demo-mode only.
  if (!mediaNeedsLocalProxy()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { file } = await params;
  if (!/^[a-z0-9]+\.[a-z0-9]+$/i.test(file)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const abs = mediaPath(file);
  if (!existsSync(abs)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const ext = file.split(".").pop()?.toLowerCase() ?? "jpg";
  const buffer = readFileSync(abs);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
