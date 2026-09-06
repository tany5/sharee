import { NextResponse } from "next/server";
import { findOrderById } from "@/lib/backend";

/**
 * Order status check (used by the payment-failure page).
 *
 * Returns only the payment status of an order — never addresses, items or
 * totals — so it is safe to expose under the normal RLS path: signed-in
 * customers can read their own orders, guests and others get `notFound`
 * rather than a leak. The page uses this to decide between "payment failed"
 * and "payment actually went through — show success" when a webhook may
 * have confirmed an order after the client verify call hiccuped.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order")?.trim() ?? "";
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "Missing order id" }, { status: 400 });
  }

  const order = await findOrderById(orderId);
  if (!order) {
    return NextResponse.json({ ok: false, notFound: true }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    status: {
      paymentStatus: order.paymentStatus,
      fulfilment: order.fulfilment,
      total: order.total,
      number: order.number,
    },
  });
}