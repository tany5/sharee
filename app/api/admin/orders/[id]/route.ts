import { NextResponse } from "next/server";
import { setOrderFulfilment } from "@/lib/backend";
import { sendFulfilmentEmail } from "@/lib/email";
import { sendWhatsAppOrderUpdate } from "@/lib/notify";
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

    // 🚚 Fire-and-forget status email to the customer (never blocks admin).
    if (order.userEmail) {
      void sendFulfilmentEmail({
        order,
        to: order.userEmail,
        status,
      }).catch(() => undefined);
    }
    // 📲 WhatsApp status update (shipped / delivered / cancelled).
    const waEvent =
      status === "dispatched"
        ? ("dispatched" as const)
        : status === "completed"
          ? ("delivered" as const)
          : status === "cancelled"
            ? ("cancelled" as const)
            : null;
    if (waEvent) {
      void sendWhatsAppOrderUpdate(order, waEvent).catch(() => undefined);
    }

    return NextResponse.json({ ok: true, order });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return NextResponse.json(
      { ok: false, error: e.message ?? "Could not update the order" },
      { status: e.code === "not_found" ? 404 : 500 },
    );
  }
}
