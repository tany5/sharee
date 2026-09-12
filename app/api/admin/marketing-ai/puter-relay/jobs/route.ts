import { NextResponse } from "next/server";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";
import {
  claimPuterRelayJob,
  completePuterRelayJob,
  heartbeatPuterWorker,
} from "@/lib/marketing/puter-relay-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await requireAdmin())) return unauthorized();
  const url = new URL(request.url);
  const workerId = url.searchParams.get("workerId") || "saree-studio";
  const mode = url.searchParams.get("mode");
  if (mode === "heartbeat") {
    heartbeatPuterWorker(workerId);
    return NextResponse.json({ ok: true });
  }
  const job = claimPuterRelayJob(workerId);
  return NextResponse.json({ ok: true, job });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const body = (await request.json()) as {
      id?: string;
      workerId?: string;
      imageDataUrl?: string;
      imageUrl?: string;
      contentType?: string;
      error?: string;
    };
    if (!body.id) return NextResponse.json({ ok: false, error: "Expected job id" }, { status: 400 });
    const job = completePuterRelayJob({
      id: body.id,
      workerId: body.workerId || "saree-studio",
      imageDataUrl: body.imageDataUrl,
      imageUrl: body.imageUrl,
      contentType: body.contentType,
      error: body.error,
    });
    return NextResponse.json({ ok: true, job });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}
