import { NextResponse } from "next/server";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";
import { listSocialPosts } from "@/lib/marketing/ai-store";
import { generateSocialPost } from "@/lib/marketing/social-engine";
import { puterPromoEnabled } from "@/lib/marketing/puter-promo";
import { getMetaDiagnostics } from "@/lib/marketing/meta-diagnostics";
import { loadPipelineSecrets } from "@/lib/marketing/secrets";
import {
  isSocialTestMode,
  SOCIAL_KINDS,
  type SocialLanguage,
  type SocialPostKind,
} from "@/lib/marketing/social";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/marketing-ai/social — all posts + summary.
 * POST /api/admin/marketing-ai/social — generate/reuse one post
 *   body: { productSlug, kind?, language? }
 */
export async function GET() {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const posts = await listSocialPosts();
    const secrets = await loadPipelineSecrets();
    const metaDiagnostics = await getMetaDiagnostics();
    const metaMissing = [
      !secrets.metaPageToken && "meta_page_access_token",
      !secrets.fbPageId && "meta_fb_page_id",
      !secrets.igUserId && "meta_ig_user_id",
    ].filter(Boolean) as string[];
    const summary = posts.reduce<Record<string, number>>((acc, p) => {
      acc[p.state] = (acc[p.state] ?? 0) + 1;
      return acc;
    }, {});
    return NextResponse.json({
      ok: true,
      posts,
      summary,
      testMode: isSocialTestMode(),
      puterPromoEnabled: puterPromoEnabled(),
      metaConfigured: metaMissing.length === 0,
      metaMissing,
      metaDiagnostics,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message, needsMigration: /0006_marketing_ai/.test((err as Error).message) },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();

  let body: { productSlug?: string; kind?: string; language?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const productSlug = String(body.productSlug ?? "");
  if (!productSlug) {
    return NextResponse.json({ ok: false, error: "Expected productSlug" }, { status: 400 });
  }
  const kind = (SOCIAL_KINDS.includes(body.kind as SocialPostKind)
    ? body.kind
    : "promo_poster") as SocialPostKind;
  const language = (body.language === "banglish" ? "banglish" : "hinglish") as SocialLanguage;

  try {
    const result = await generateSocialPost({ productSlug, kind, language });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}
