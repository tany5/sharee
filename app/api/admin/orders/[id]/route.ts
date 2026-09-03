import { NextResponse } from "next/server";
import { setOrderFulfilment, DbError } from "@/lib/demo/db";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";
import type { FulfilmentStatus } from "@/lib/types";

const ALLOWED: FulfilmentStatus[] = ["pending", "dispatched", "completed", "cancelled"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) return unauthorized();
  const { id } = await params;
  let body: { fulfilment?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const status = body.fulfilment as FulfilmentStatus;
  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
  }
  try {
    const order = await setOrderFulfilment(id, status);
    return NextResponse.json({ ok: true, order });
  } catch (err) {
    if (err instanceof DbError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: "Could not update the order" }, { status: 500 });
  }
}
