import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";
import { confirmRazorpayPayment } from "@/lib/backend";
import { sendPaymentReceivedEmail } from "@/lib/email";
import { sendWhatsAppOrderUpdate } from "@/lib/notify";
import { notifyOwnerOfOrder } from "@/lib/owner";

/**
 * Razorpay webhook endpoint.
 *
 * Server-side confirmation of payments: Razorpay POSTs events here with an
 * HMAC-SHA256 signature over the raw body (X-Razorpay-Signature). Only events
 * carrying an order id + amount (payment.captured / payment.authorized /
 * order.paid) flip an order to paid — via the Supabase `confirm_payment` RPC
 * (which re-verifies the signature and amount inside the database) or the demo
 * store. Idempotent; responds 200 quickly so Razorpay doesn't retry.
 *
 * Configure in the Razorpay dashboard → Webhooks:
 *   URL:     https://<your-domain>/api/webhooks/razorpay
 *   Events:  payment.captured, payment.authorized, order.paid
 *   Secret:  RAZORPAY_WEBHOOK_SECRET
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let payload: {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string; amount?: number } };
      order?: { entity?: { id?: string; amount?: number } };
    };
  };
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const event = payload?.event ?? "";
  const payment = payload?.payload?.payment?.entity;
  const orderEntity = payload?.payload?.order?.entity;
  const razorpayOrderId = payment?.order_id ?? orderEntity?.id;
  const amountPaise = Number(payment?.amount ?? orderEntity?.amount ?? 0);

  if (
    razorpayOrderId &&
    (event === "payment.captured" ||
      event === "payment.authorized" ||
      event === "order.paid")
  ) {
    const result = await confirmRazorpayPayment({
      razorpayOrderId: String(razorpayOrderId),
      razorpayPaymentId: payment?.id ? String(payment.id) : undefined,
      webhookBody: raw,
      webhookSignature: signature,
      amountPaise,
    });

    // 💳 Fire-and-forget: payment-received email (deduped against the
    // verify route, which confirms the same payment from the browser).
    if (result.ok && result.order?.userEmail) {
      void sendPaymentReceivedEmail({
        order: result.order,
        to: result.order.userEmail,
      }).catch(() => undefined);
    }
    // 📲 WhatsApp payment confirmation.
    if (result.ok && result.order) {
      void sendWhatsAppOrderUpdate(result.order, "payment").catch(
        () => undefined,
      );
      // 🔔 Owner alert (WhatsApp + email) for the confirmed payment.
      void notifyOwnerOfOrder(result.order, "payment").catch(() => undefined);
    }
  }

  return NextResponse.json({ ok: true });
}