import { NextResponse } from "next/server";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";
import { listAds } from "@/lib/marketing/ai-store";
import { generateAd } from "@/lib/marketing/ads-engine";
import {
  AD_OBJECTIVES,
  isAdsTestMode,
  validateDailyBudget,
  type AdLanguage,
  type AdObjective,
} from "@/lib/marketing/ads";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/marketing-ai/ads — all ads + summary + test mode flag.
 * POST /api/admin/marketing-ai/ads — generate/reuse one ad (nothing on Meta yet)
 *   body: { productSlug, objective?, language?, dailyBudgetInr, destination? }
 */
export async function GET() {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const ads = await listAds();
    const summary = ads.reduce<Record<string, number>>((acc, a) => {
      acc[a.state] = (acc[a.state] ?? 0) + 1;
      return acc;
    }, {});
    const activeSpend = ads
      .filter((a) => a.state === "active")
      .reduce((sum, a) => sum + a.dailyBudgetInr, 0);
    return NextResponse.json({
      ok: true,
      ads,
      summary,
      activeDailySpendInr: activeSpend,
      testMode: isAdsTestMode(),
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

  let body: {
    productSlug?: string;
    objective?: string;
    language?: string;
    dailyBudgetInr?: number;
    destination?: string;
    destinationUrl?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const productSlug = String(body.productSlug ?? "");
  if (!productSlug) {
    return NextResponse.json({ ok: false, error: "Expected productSlug" }, { status: 400 });
  }
  const objective = (AD_OBJECTIVES.includes(body.objective as AdObjective)
    ? body.objective
    : "OUTCOME_TRAFFIC") as AdObjective;
  const language = (body.language === "banglish" ? "banglish" : "hinglish") as AdLanguage;
  const dailyBudgetInr = Number(body.dailyBudgetInr ?? 100);

  try {
    validateDailyBudget(dailyBudgetInr);
    const result = await generateAd({
      productSlug,
      objective,
      language,
      dailyBudgetInr,
      destination: body.destination === "whatsapp" ? "whatsapp" : "website",
      destinationUrl: body.destinationUrl,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}
