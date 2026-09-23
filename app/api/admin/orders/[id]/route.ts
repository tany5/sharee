import { NextResponse } from "next/server";
import { setOrderFulfilment, setOrderTracking } from "@/lib/backend";
import { sendFulfilmentEmail } from "@/lib/email";
import { sendWhatsAppOrderUpdate, buildDispatchedMessage } from "@/lib/notify";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";
import { COURIER_IDS, courierName } from "@/lib/tracking";
import type { FulfilmentStatus } from "@/lib/types";

const ALLOWED: FulfilmentStatus[] = ["pending", "dispatched", "completed", "cancelled"];

interface PatchBody {
  fulfilment?: string;
  /** Admin-entered shipment details (courier + AWB). */
  courier?: string;
  awb?: string;
  trackingUrl?: string;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) return unauthorized();
  const { id } = await params;
  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  // Tracking-only save (courier + AWB without a status change).
  if (!body.fulfilment) {
    if (!body.courier && !body.awb && !body.trackingUrl) {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
    }
    if (body.courier && !COURIER_IDS.includes(body.courier)) {
      return NextResponse.json({ ok: false, error: "Unknown courier" }, { status: 400 });
    }
    const awb = body.awb?.trim().slice(0, 40) || undefined;
    if (awb && !/^[A-Za-z0-9-]{4,40}$/.test(awb)) {
      return NextResponse.json(
        { ok: false, error: "AWB looks invalid — 4–40 letters/digits" },
        { status: 400 },
      );
    }
    try {
      const order = await setOrderTracking(id, {
        courier: body.courier || undefined,
        awb,
        url: body.trackingUrl?.trim().slice(0, 500) || undefined,
      });
      return NextResponse.json({ ok: true, order });
    } catch (err) {
      const e = err as { code?: string; message?: string };
      return NextResponse.json(
        { ok: false, error: e.message ?? "Could not save tracking details" },
        { status: e.code === "not_found" ? 404 : 500 },
      );
    }
  }

  const status = body.fulfilment as FulfilmentStatus;
  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
  }
  try {
    const order = await setOrderFulfilment(id, status);

    // 🚚 Fire-and-forget status email to the customer (never blocks admin).
    // The shipped email carries the courier + AWB when the admin saved them.
    if (order.userEmail) {
      void sendFulfilmentEmail({
        order,
        to: order.userEmail,
        status,
        tracking:
          status === "dispatched" && order.tracking?.awb
            ? {
                courier: courierName(order.tracking.courier) || order.tracking.courier,
                number: order.tracking.awb,
                url: order.tracking.url,
              }
            : undefined,
      }).catch(() => undefined);
    }
    // 📲 WhatsApp status update (shipped / delivered / cancelled). The
    // dispatched message appends the courier + AWB line when present.
    const waEvent =
      status === "dispatched"
        ? ("dispatched" as const)
        : status === "completed"
          ? ("delivered" as const)
          : status === "cancelled"
            ? ("cancelled" as const)
            : null;
    if (waEvent) {
      if (waEvent === "dispatched" && order.tracking?.awb) {
        void sendWhatsAppOrderUpdate(
          order,
          waEvent,
          buildDispatchedMessage(order),
        ).catch(() => undefined);
      } else {
        void sendWhatsAppOrderUpdate(order, waEvent).catch(() => undefined);
      }
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
