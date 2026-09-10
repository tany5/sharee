import { NextResponse } from "next/server";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";
import { generateProductTryOnGallery } from "@/lib/marketing/product-gallery";

export const dynamic = "force-dynamic";
// Matches the generator's internal time budget (one GPU render + slack).
export const maxDuration = 60;

/**
 * Generate "model wearing saree" catalogue photos for a product.
 *
 * Incremental + resumable: each call generates the still-missing poses within
 * a ~55s budget and persists every image as it lands. The editor repeats the
 * call while `remaining` is non-empty, so slow GPU queues never lose progress.
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const slug =
    String(body.slug ?? body.name ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "saree";
  const name = String(body.name ?? "Saree").trim() || "Saree";
  const garmentUrl = String(body.garmentUrl ?? "").trim() || undefined;
  const force = body.force === true;

  try {
    const progress = await generateProductTryOnGallery({ slug, name, garmentUrl, force });
    const done = progress.remaining.length === 0 && !progress.error;
    return NextResponse.json({
      ok: progress.urls.length > 0 || done || progress.pending === true,
      urls: progress.urls,
      done,
      remaining: progress.remaining,
      error: progress.error,
      provider: progress.provider,
      pending: progress.pending === true,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message ?? "Could not generate model photos" },
      { status: 400 },
    );
  }
}
