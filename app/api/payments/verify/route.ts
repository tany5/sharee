import { NextResponse } from "next/server";
import { isRazorpayLive, verifyPaymentSignature } from "@/lib/payments/razorpay";
import { confirmRazorpayPayment } from "@/lib/backend";

/**
 * Client-side payment verification (called by the checkout success handler).
 *
 * Flow: Razorpay checkout closes with a success response → this route verifies
 * the HMAC signature server-side (order_id|payment_id with the key secret) →
 * the order is flipped to paid via the Supabase `confirm_payment` RPC (or the
 * demo store), which cross-checks the amount against the order total in the
 * database and returns the updated row. The webhook is the independent second
 * confirmation for reconciliation; the Purchase event only fires on the
 * success page for orders with paymentStatus === "paid".
 *
 * Guest checkout note: `orders` RLS lets guests INSERT but their rows are
 * invisible to SELECT, so the route never reads the order back through RLS —
 * the security-definer RPC is the authoritative read, tied to the client's
 * order id (p_order_id).
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
    /** Expected charge in paise — cross-checked against the DB total. */
    amountPaise?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 },
    );
  }

  const {
    orderId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    amountPaise,
  } = body ?? {};
  if (
    !orderId ||
    !razorpayOrderId ||
    !razorpayPaymentId ||
    !razorpaySignature ||
    !Number.isFinite(amountPaise)
  ) {
    return NextResponse.json(
      { ok: false, error: "Missing payment details" },
      { status: 400 },
    );
  }

  // The HMAC signature can only be produced by Razorpay for a real payment —
  // this is the gate that stops forged "paid" orders.
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

  // Flip the order to paid. The DB RPC re-verifies the signature, ties the
  // confirmation to orderId and to the order's own total, and returns the
  // updated row — no RLS-restricted read needed for guest orders.
  const result = await confirmRazorpayPayment({
    razorpayOrderId,
    razorpayPaymentId,
    paymentSignature: razorpaySignature,
    amountPaise: Math.round(Number(amountPaise)),
    orderId,
  });
  if (!result.ok || !result.order) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "Could not confirm the payment" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, order: result.order });
}
