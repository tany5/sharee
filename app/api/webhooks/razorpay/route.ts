import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay payment webhook.
 *
 * In production this endpoint:
 *   1. verifies the X-Razorpay-Signature with RAZORPAY_WEBHOOK_SECRET
 *   2. looks the order up by `payload.payment.entity.order_id`
 *   3. flips payment_status -> paid (idempotently)
 *   4. marks the order for fulfilment (and triggers the server-side Purchase
 *      conversion for the Conversions API)
 *
 * Until RAZORPAY_WEBHOOK_SECRET is configured the demo storefront simulates
 * payments through /api/orders, so this endpoint stays inert.
 */
export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Razorpay is not configured in demo mode." },
      { status: 501 },
    );
  }

  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  let valid = false;
  try {
    valid =
      expected.length === signature.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    valid = false;
  }
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // TODO(production): verify the payment entity, update the order, trigger CAPI.
  return NextResponse.json({ received: true });
}
