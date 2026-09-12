import { NextResponse } from "next/server";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";
import {
  activateAd,
  approveAd,
  pauseAd,
  regenerateAd,
  rejectAd,
  stageAd,
} from "@/lib/marketing/ads-engine";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/marketing-ai/ads/manage
 * Body: { id, action: "approve"|"activate"|"reject"|"regenerate"|"pause" }
 *   approve    — 1st approval: pending_approval → approved, then staged PAUSED on Meta
 *   activate   — 2nd approval: pending_activation → active (THE money switch)
 *   reject     — draft|pending_approval → rejected (body.reason)
 *   regenerate — fresh Ollama copy, back to pending_approval
 *   pause      — active|pending_activation → paused
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();

  let body: { id?: string; action?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const id = String(body.id ?? "");
  const action = String(body.action ?? "");
  if (!id) {
    return NextResponse.json({ ok: false, error: "Expected id" }, { status: 400 });
  }

  try {
    switch (action) {
      case "approve": {
        const ad = await approveAd(id, "admin");
        const { ad: staged, simulated } = await stageAd(ad.id);
        return NextResponse.json({ ok: true, state: staged.state, ad: staged, simulated });
      }
      case "activate": {
        const ad = await activateAd(id, "admin");
        return NextResponse.json({ ok: true, state: ad.state, ad, simulated: ad.metaStatus === "ACTIVE" && (ad.metaAdId ?? "").startsWith("TEST-") });
      }
      case "reject": {
        const ad = await rejectAd(id, String(body.reason ?? ""), "admin");
        return NextResponse.json({ ok: true, state: ad.state, ad });
      }
      case "regenerate": {
        const ad = await regenerateAd(id);
        return NextResponse.json({ ok: true, state: ad.state, ad });
      }
      case "pause": {
        const ad = await pauseAd(id);
        return NextResponse.json({ ok: true, state: ad.state, ad });
      }
      default:
        return NextResponse.json(
          { ok: false, error: "Expected action approve|activate|reject|regenerate|pause" },
          { status: 400 },
        );
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}
