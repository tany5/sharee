import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/payments/cashfree";
import { confirmCashfreePayment } from "@/lib/backend";

/**
 * Cashfree webhook endpoint.
 *
 * Server-side confirmation of payments: Cashfree POSTs events here signed
 * with base64(HMAC-SHA256(`${x-webhook-timestamp}.${rawBody}`, client_secret))
 * in the x-webhook-signature header. Only payments for a known order whose
 * amount matches the order total flip the order to paid — via the Supabase
 * `confirm_cashfree_payment` RPC (which re-checks the amount inside the
 * database) or the demo store. Idempotent; responds 200 quickly so Cashfree
 * doesn't retry.
 *
 * Configure in the Cashfree dashboard → Webhooks:
 *   URL:     https://<your-domain>/api/webhooks/cashfree
 *   Events:  payment.captured / PAYMENT_SUCCESS (+ PAYMENT_FAILED for logs)
 *   Secret:  your Cashfree client secret (CASHFREE_SECRET_KEY)
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-webhook-signature") ?? "";
  const timestamp = request.headers.get("x-webhook-timestamp") ?? "";

  if (!verifyWebhookSignature({ rawBody: raw, signature, timestamp })) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let payload: {
    type?: string;
    data?: {
      order?: { order_id?: string; order_amount?: number };
      payment?: {
        cf_payment_id?: number | string;
        payment_status?: string;
        payment_amount?: number;
      };
    };
  };
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const order = payload?.data?.order;
  const payment = payload?.data?.payment;
  const cashfreeOrderId = order?.order_id ? String(order.order_id) : "";
  const paymentStatus = String(payment?.payment_status ?? "").toUpperCase();

  // PAYMENT_SUCCESS is the settlement event; payment.captured appears on some
  // account configurations. Amount always cross-checked against the DB total.
  if (
    cashfreeOrderId &&
    paymentStatus === "SUCCESS" &&
    (payload?.type === "PAYMENT_SUCCESS" || payload?.type === "payment.captured")
  ) {
    const amountPaise = Math.round(
      Number(payment?.payment_amount ?? order?.order_amount ?? 0) * 100,
    );
    await confirmCashfreePayment({
      cashfreeOrderId,
      cashfreePaymentId: payment?.cf_payment_id != null
        ? String(payment.cf_payment_id)
        : undefined,
      amountPaise,
    });
  }

  return NextResponse.json({ ok: true });
}
