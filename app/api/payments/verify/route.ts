import { NextResponse } from "next/server";
import { isRazorpayLive, verifyPaymentSignature } from "@/lib/payments/razorpay";
import { confirmRazorpayPayment, findOrderById } from "@/lib/backend";

/**
 * Client-side payment verification (called by the checkout success handler).
 *
 * Flow: Razorpay checkout closes with a success response → this route verifies
 * the HMAC signature server-side (order_id|payment_id with the key secret) →
 * the order is flipped to paid via the active backend (demo file / Supabase
 * RPC, which also cross-checks the amount). The webhook is the independent
 * second confirmation for reconciliation; the Purchase event only fires on the
 * success page for orders with paymentStatus === "paid".
 */
export async function POST(request: Request) {
  if (!isRazorpayLive()) {
    return NextResponse.json(
      { ok: false, error: "Online payments are not enabled." },
      { status: 400 },
    );
  }

  let body: {
    orderId?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } =
    body ?? {};
  if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return NextResponse.json(
      { ok: false, error: "Missing payment details" },
      { status: 400 },
    );
  }

  // The HMAC signature can only be produced by Razorpay for a real payment —
  // this is the gate that stops forged \"paid\" orders.
  if (
    !verifyPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    })
  ) {
    return NextResponse.json(
      { ok: false, error: "Payment signature could not be verified" },
      { status: 400 },
    );
  }

  const order = await findOrderById(orderId);
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }
  if (order.razorpayOrderId !== razorpayOrderId) {
    return NextResponse.json(
      { ok: false, error: "Order does not match this payment" },
      { status: 400 },
    );
  }

  const result = await confirmRazorpayPayment({
    razorpayOrderId,
    razorpayPaymentId,
    paymentSignature: razorpaySignature,
    amountPaise: Math.round(order.total * 100),
  });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "Could not confirm the payment" },
      { status: 502 },
    );
  }

  const updated = (await findOrderById(orderId)) ?? order;
  return NextResponse.json({ ok: true, order: updated });
}