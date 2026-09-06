import { NextResponse } from "next/server";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";
import { pipelineProducts } from "@/lib/marketing/store";
import { advanceProduct } from "@/lib/marketing/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/admin/marketing/advance
 * Runs ONE pipeline stage for every in-flight product (pending /
 * tryon_processing / tryon_completed / rendering_video / publishing).
 *
 * The admin UI "Process queue" button calls this repeatedly; a Vercel Cron
 * can call it on a schedule with the same admin session (or protect it via
 * CRON_SECRET later).
 */
export async function POST() {
  if (!(await requireAdmin())) return unauthorized();

  const products = await pipelineProducts();
  const inFlight = products.filter((p) =>
    ["pending", "tryon_processing", "tryon_completed", "rendering_video", "publishing"].includes(
      p.marketing.pipeline.status,
    ),
  );

  const results: { slug: string; from: string; to: string; note?: string }[] = [];
  for (const p of inFlight) {
    try {
      const outcome = await advanceProduct(p.slug);
      results.push({ slug: p.slug, from: outcome.from, to: outcome.to, note: outcome.note });
    } catch (err) {
      results.push({ slug: p.slug, from: p.marketing.pipeline.status, to: "failed", note: (err as Error).message });
    }
  }

  const failed = results.filter((r) => r.to === "failed").length;
  return NextResponse.json({
    ok: true,
    processed: results.length,
    failed,
    results,
  });
}
