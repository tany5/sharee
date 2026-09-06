import { NextResponse } from "next/server";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";
import { isSupabaseBackend } from "@/lib/backend/env";
import {
  baseModels,
  pipelineProducts,
  PipelineMigrationError,
} from "@/lib/marketing/store";
import {
  PIPELINE_STATUS_LABEL,
  type MarketingData,
  type PipelineStatus,
} from "@/lib/marketing/types";
import type { DbProduct } from "@/lib/demo/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/marketing
 * Returns the pipeline queue (products in the pipeline), base models and the
 * backend mode. In demo mode the pipeline runs on demo data; Supabase mode
 * reads products.marketing directly.
 */
export async function GET() {
  if (!(await requireAdmin())) return unauthorized();

  let products, models;
  try {
    [products, models] = await Promise.all([pipelineProducts(), baseModels()]);
  } catch (err) {
    if (err instanceof PipelineMigrationError) {
      return NextResponse.json(
        {
          ok: false,
          needsMigration: true,
          error:
            "Run supabase/migrations/0004_marketing_pipeline.sql + 0005_pipeline_secrets.sql in the Supabase SQL editor to enable the Marketing Studio.",
        },
        { status: 503 },
      );
    }
    throw err;
  }

  const queue = products.map((p: DbProduct & { marketing: MarketingData }) => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    price: p.price,
    image: p.images?.[0] ?? null,
    status: p.marketing.pipeline.status as PipelineStatus,
    statusLabel: PIPELINE_STATUS_LABEL[p.marketing.pipeline.status],
    attempts: p.marketing.pipeline.attempts,
    error: p.marketing.pipeline.error ?? null,
    updatedAt: p.updatedAt,
    tryOnUrl: p.marketing.tryOn?.imageUrl ?? null,
    tryOnProvider: p.marketing.tryOn?.provider ?? null,
    copy: p.marketing.copy ?? null,
    videoUrl: p.marketing.video?.url ?? null,
    publishedAt: p.marketing.publish?.publishedAt ?? null,
    fbPostId: p.marketing.publish?.fbPostId ?? null,
    igMediaId: p.marketing.publish?.igMediaId ?? null,
  }));

  const summary = queue.reduce(
    (acc, q) => {
      acc[q.status] = (acc[q.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return NextResponse.json({ ok: true, queue, summary, models, backend: isSupabaseBackend() ? "supabase" : "demo" });
}

/**
 * POST /api/admin/marketing
 * Enqueue one ({ slug }) or many ({ slugs: [] }) products into the pipeline.
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();

  let body: { slug?: string; slugs?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const slugs = (
    Array.isArray(body.slugs) ? body.slugs : body.slug ? [body.slug] : []
  ).map(String);
  if (slugs.length === 0) {
    return NextResponse.json({ ok: false, error: "No products given" }, { status: 400 });
  }

  const { enqueueProduct } = await import("@/lib/marketing/store");
  const results: { slug: string; ok: boolean; error?: string }[] = [];
  for (const slug of slugs) {
    try {
      await enqueueProduct(slug);
      results.push({ slug, ok: true });
    } catch (err) {
      results.push({ slug, ok: false, error: (err as Error).message });
    }
  }
  const failed = results.filter((r) => !r.ok).length;
  return NextResponse.json({
    ok: failed === 0,
    results,
    error: failed ? `${failed} product(s) could not be queued` : undefined,
  });
}
