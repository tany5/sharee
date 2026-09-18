import { NextResponse } from "next/server";
import { isRazorpayLive, verifyPaymentSignature } from "@/lib/payments/razorpay";
import {
  fetchCashfreeOrder,
  isCashfreeLive,
  CashfreeError,
} from "@/lib/payments/cashfree";
import { isCashfreeGateway } from "@/lib/payments/gateway";
import { confirmCashfreePayment, confirmRazorpayPayment } from "@/lib/backend";
import { sendPaymentReceivedEmail } from "@/lib/email";
import { sendWhatsAppOrderUpdate } from "@/lib/notify";

/**
 * Client-side payment verification (called by the checkout success handler).
 *
 * Razorpay flow: checkout closes with a success response → this route verifies
 * the HMAC signature server-side (order_id|payment_id with the key secret) →
 * the order is flipped to paid via the Supabase `confirm_payment` RPC (or the
 * demo store), which cross-checks the amount against the order total in the
 * database and returns the updated row.
 *
 * Cashfree flow: the drop-in callback is not cryptographically signed, so this
 * route re-fetches the order from the Cashfree Orders API (authenticated with
 * the app id + secret) and only marks paid when the authoritative status is
 * PAID (or a PENDING settlement for late-auth methods) and the amount matches
 * the order total — via the `confirm_cashfree_payment` RPC (or demo store).
 *
 * The webhooks (/api/webhooks/razorpay, /api/webhooks/cashfree) are the
 * independent second confirmation for reconciliation; the Purchase event only
 * fires on the success page for orders with paymentStatus === "paid".
 *
 * Guest checkout note: `orders` RLS lets guests INSERT but their rows are
 * invisible to SELECT, so the route never reads the order back through RLS —
 * the security-definer RPCs are the authoritative read, tied to the client's
 * order id.
 */
export async function POST(request: Request) {
  let body: {
    orderId?: string;
    /** Gateway selector — defaults to the active gateway when omitted. */
    gateway?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    /** Cashfree: merchant-side order id used at Create Order (tt_<id>). */
    cashfreeOrderId?: string;
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

  const { orderId, amountPaise } = body ?? {};
  if (!orderId || !Number.isFinite(amountPaise)) {
    return NextResponse.json(
      { ok: false, error: "Missing payment details" },
      { status: 400 },
    );
  }

  const cashfreeRoute =
    body.gateway === "cashfree" ||
    (body.gateway !== "razorpay" && isCashfreeGateway());

  if (cashfreeRoute) {
    return verifyCashfree(
      body.cashfreeOrderId,
      orderId,
      Math.round(Number(amountPaise)),
    );
  }
  return verifyRazorpay(orderId, Math.round(Number(amountPaise)), body);
}

/** Razorpay: HMAC(order|payment) signature is the gate against forged payments. */
async function verifyRazorpay(
  orderId: string,
  amountPaise: number,
  body: {
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
  },
) {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = body;
  if (!isRazorpayLive()) {
    return NextResponse.json(
      { ok: false, error: "Online payments are not enabled." },
      { status: 400 },
    );
  }
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
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
    amountPaise,
    orderId,
  });
  if (!result.ok || !result.order) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "Could not confirm the payment" },
      { status: 502 },
    );
  }

  // 💳 Fire-and-forget: payment-received email (deduped against the webhook).
  if (result.order.userEmail) {
    void sendPaymentReceivedEmail({
      order: result.order,
      to: result.order.userEmail,
    }).catch(() => undefined);
  }
  // 📲 WhatsApp payment confirmation.
  void sendWhatsAppOrderUpdate(result.order, "payment").catch(() => undefined);

  return NextResponse.json({ ok: true, order: result.order });
}

/**
 * Cashfree: the drop-in callback can't be trusted on its own — re-fetch the
 * order from the Cashfree API (server-to-server) and only settle on PAID /
 * late-auth PENDING with a matching amount.
 */
async function verifyCashfree(
  cashfreeOrderId: string | undefined,
  orderId: string,
  amountPaise: number,
) {
  if (!isCashfreeLive()) {
    return NextResponse.json(
      { ok: false, error: "Online payments are not enabled." },
      { status: 400 },
    );
  }
  if (!cashfreeOrderId) {
    return NextResponse.json(
      { ok: false, error: "Missing payment details" },
      { status: 400 },
    );
  }

  try {
    const status = await fetchCashfreeOrder(cashfreeOrderId);
    const settled =
      status.orderStatus === "PAID" ||
      (status.orderStatus === "ACTIVE" &&
        status.paymentStatus === "PENDING"); // late-authorisation methods
    if (!settled) {
      return NextResponse.json(
        { ok: false, error: `Payment not completed (${status.orderStatus})` },
        { status: 400 },
      );
    }

    const paidPaise = Math.round((status.orderAmountPaid ?? status.orderAmount) * 100);
    if (paidPaise !== amountPaise) {
      return NextResponse.json(
        { ok: false, error: "Payment amount does not match the order" },
        { status: 400 },
      );
    }

    const result = await confirmCashfreePayment({
      cashfreeOrderId,
      cashfreePaymentId: status.paymentId,
      amountPaise: paidPaise,
      orderId,
    });
    if (!result.ok || !result.order) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "Could not confirm the payment" },
        { status: 502 },
      );
    }

    // 💳 Fire-and-forget: payment-received email (deduped against the webhook).
    if (result.order.userEmail) {
      void sendPaymentReceivedEmail({
        order: result.order,
        to: result.order.userEmail,
      }).catch(() => undefined);
    }
    // 📲 WhatsApp payment confirmation.
    void sendWhatsAppOrderUpdate(result.order, "payment").catch(() => undefined);

    return NextResponse.json({ ok: true, order: result.order });
  } catch (err) {
    const message =
      err instanceof CashfreeError ? err.message : "Could not verify the payment";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
