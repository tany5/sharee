import { NextResponse } from "next/server";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";
import {
  approveSocialPost,
  editSocialPost,
  publishSocialPost,
  regenerateSocialPost,
  rejectSocialPost,
} from "@/lib/marketing/social-engine";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/marketing-ai/social/manage
 * Body: { id, action: "approve"|"approve_publish"|"publish"|"reject"|"regenerate"|"edit", ... }
 *   approve    — pending_approval → approved
 *   approve_publish — pending_approval → approved → published/simulated
 *   publish    — approved → published (TEST MODE simulated by default)
 *   reject     — draft|pending_approval → rejected (body.reason)
 *   regenerate — fresh Ollama copy, back to pending_approval
 *   edit       — patch caption fields (body.hook/body.body/body.cta/body.hashtags)
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();

  let body: {
    id?: string;
    action?: string;
    reason?: string;
    hook?: string;
    body?: string;
    cta?: string;
    hashtags?: string[];
  };
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
        const post = await approveSocialPost(id, "admin");
        return NextResponse.json({ ok: true, state: post.state, post });
      }
      case "approve_publish": {
        const approved = await approveSocialPost(id, "admin");
        const { post, simulated, note } = await publishSocialPost(approved.id, "admin");
        return NextResponse.json({ ok: true, state: post.state, post, simulated, note });
      }
      case "publish": {
        const { post, simulated, note } = await publishSocialPost(id, "admin");
        return NextResponse.json({ ok: true, state: post.state, post, simulated, note });
      }
      case "reject": {
        const post = await rejectSocialPost(id, String(body.reason ?? ""), "admin");
        return NextResponse.json({ ok: true, state: post.state, post });
      }
      case "regenerate": {
        const post = await regenerateSocialPost(id);
        return NextResponse.json({ ok: true, state: post.state, post });
      }
      case "edit": {
        const post = await editSocialPost(id, {
          hook: body.hook,
          body: body.body,
          cta: body.cta,
          hashtags: body.hashtags,
        });
        return NextResponse.json({ ok: true, state: post.state, post });
      }
      default:
        return NextResponse.json(
          { ok: false, error: "Expected action approve|approve_publish|publish|reject|regenerate|edit" },
          { status: 400 },
        );
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}
