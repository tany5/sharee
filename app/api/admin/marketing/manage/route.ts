import { NextResponse } from "next/server";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";
import { cancelPipeline } from "@/lib/marketing/store";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/marketing/manage
 * Body: { slug, action: "retry" | "cancel" | "advance" }
 *   advance — run the next pipeline stage now (try-on / copy+video / publish)
 *   retry   — reset a failed product back to 'pending' (then advance it)
 *   cancel  — mark failed-by-admin and take the product out of the pipeline
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();

  let body: { slug?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const slug = String(body.slug ?? "");
  const action = String(body.action ?? "");
  if (!slug || !["retry", "cancel", "advance"].includes(action)) {
    return NextResponse.json({ ok: false, error: "Expected slug + action (retry|cancel|advance)" }, { status: 400 });
  }

  try {
    if (action === "cancel") {
      const marketing = await cancelPipeline(slug);
      return NextResponse.json({ ok: true, status: marketing.pipeline.status });
    }

    if (action === "retry") {
      const { pipelineProduct, setMarketing } = await import("@/lib/marketing/store");
      const { resetForRetry } = await import("@/lib/marketing/status");
      const row = await pipelineProduct(slug);
      if (!row) {
        return NextResponse.json({ ok: false, error: "Product not found" }, { status: 404 });
      }
      const next = resetForRetry(row.marketing);
      await setMarketing(slug, next);
      // Fall through to an immediate first stage so retry feels instant.
    }

    const { advanceProduct } = await import("@/lib/marketing/engine");
    const outcome = await advanceProduct(slug);
    return NextResponse.json({
      ok: true,
      from: outcome.from,
      status: outcome.to,
      error: outcome.to === "failed" ? outcome.note : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message ?? "Pipeline action failed" },
      { status: 400 },
    );
  }
}
