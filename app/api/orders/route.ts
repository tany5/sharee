import { NextResponse } from "next/server";
import { createDemoOrder, OrderError } from "@/lib/orders";
import { addOrder, currentUser, resolveOrderSource } from "@/lib/backend";
import {
  createRazorpayOrder,
  isRazorpayLive,
  razorpayKeyId,
  RazorpayError,
} from "@/lib/payments/razorpay";
import {
  createCashfreeOrder,
  isCashfreeLive,
  cashfreeEnv,
  safeCustomerId,
  CashfreeError,
} from "@/lib/payments/cashfree";
import { isCashfreeGateway } from "@/lib/payments/gateway";
import { SITE } from "@/lib/site";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { sendWhatsAppOrderUpdate } from "@/lib/notify";
import type { CashfreePayload, RazorpayPayload } from "@/lib/payments/client";
import type { CartItem, DeliveryAddress, PaymentMethodId, Utm } from "@/lib/types";

/**
 * Order endpoint.
 *
 *  - quantities + slugs validated against the trusted product source
 *    (admin-edited prices and costs are authoritative — never the browser)
 *  - cost snapshots attached for the admin profit dashboard
 *  - signed-in customers get their order persisted to their history
 *  - guest checkout continues to work and returns the same order payload
 *
 * Live payments: when the active gateway's key id + secret are configured,
 * online-paid orders get a payment order created server-side and are returned
 * as `paymentStatus: "pending"` with a `razorpay` or `cashfree` payload for
 * the checkout widget. They flip to "paid" only after server-side
 * verification (/api/payments/verify or the gateway webhook) — Purchase fires
 * client-side only after that verification (order-success page).
 *
 * Gateway selection is env-driven (PAYMENT_GATEWAY=cashfree|razorpay, with
 * auto-detection when unset) — see lib/payments/gateway.ts.
 */

interface RateBucket {
  times: number[];
}

const buckets = new Map<string, RateBucket>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 12;

function rateLimited(clientKey: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(clientKey) ?? { times: [] };
  bucket.times = bucket.times.filter((t) => now - t < WINDOW_MS);
  if (bucket.times.length >= MAX_REQUESTS) {
    buckets.set(clientKey, bucket);
    return true;
  }
  bucket.times.push(now);
  buckets.set(clientKey, bucket);
  return false;
}

interface OrderBody {
  items?: CartItem[];
  address?: Partial<DeliveryAddress>;
  paymentMethod?: PaymentMethodId;
  utm?: Utm;
  /** Guest email for order updates (optional; signed-in users use their own). */
  email?: string;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again in a minute." },
      { status: 429 },
    );
  }

  let body: OrderBody;
  try {
    body = (await request.json()) as OrderBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 },
    );
  }

  const user = await currentUser();

  // Guest order-update email (optional field on checkout). Trim + light
  // validation; guests may also leave it empty.
  const guestEmailRaw = body.email?.trim().toLowerCase() ?? "";
  const guestEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(guestEmailRaw)
    ? guestEmailRaw.slice(0, 200)
    : undefined;

  try {
    const cashfreeGateway = isCashfreeGateway();
    const liveGateway = cashfreeGateway ? isCashfreeLive() : isRazorpayLive();
    const order = await createDemoOrder({
      items: body.items ?? [],
      address: body.address ?? {},
      paymentMethod: body.paymentMethod ?? "upi",
      utm: body.utm,
      resolveProduct: resolveOrderSource,
      user: user ? { id: user.id, email: user.email } : undefined,
      email: guestEmail,
      razorpayIntent: liveGateway,
    });

    // Live payments: create the gateway order server-side, attach its id to
    // the order record, and hand the widget payload back to the client. COD
    // and demo payments skip this entirely.
    let razorpay: RazorpayPayload | undefined;
    let cashfree: CashfreePayload | undefined;
    if (liveGateway && order.paymentMethod !== "cod") {
      if (cashfreeGateway) {
        const cf = await createCashfreeOrder({
          // Cashfree order ids allow [A-Za-z0-9_-] (3-45 chars) — our order id
          // qualifies; prefixed so it can never collide with another merchant id.
          orderId: `tt_${order.id}`.slice(0, 45),
          amountRupees: order.total,
          // customer_id must be alphanumeric/-/_ — emails are rejected.
          customerId: safeCustomerId({
            userId: user?.id,
            email: order.userEmail ?? user?.email,
            phone: order.address.phone,
            fallback: order.id,
          }),
          customerName: order.address.fullName,
          customerEmail: order.userEmail ?? user?.email,
          customerPhone: order.address.phone,
          note: `${SITE.name} order ${order.number}`,
          notifyUrl: `${SITE.url}/api/webhooks/cashfree`,
        });
        order.cashfreeOrderId = cf.orderId;
        cashfree = {
          orderId: cf.orderId,
          paymentSessionId: cf.paymentSessionId,
          amountRupees: cf.orderAmount,
          currency: cf.orderCurrency,
          mode: cashfreeEnv(),
        };
      } else {
        const rp = await createRazorpayOrder({
          amountPaise: Math.round(order.total * 100),
          receipt: order.number,
          notes: { orderId: order.id },
        });
        order.razorpayOrderId = rp.id;
        razorpay = {
          keyId: razorpayKeyId() ?? "",
          orderId: rp.id,
          amountPaise: rp.amount,
          currency: rp.currency,
          name: SITE.name,
          description: `${SITE.name} order ${order.number}`,
          prefill: {
            name: order.address.fullName,
            contact: order.address.phone,
            email: order.userEmail ?? user?.email,
          },
          theme: { color: "#886644" },
        };
      }
    }

    const persisted = await addOrder(order);

    // 🛍️ Order-confirmation email for COD / demo-paid orders. Online-gateway
    // orders get the payment-received email after verification instead.
    // Fire-and-forget: an email failure must never fail the order.
    if (order.paymentStatus !== "pending" && persisted.userEmail) {
      void sendOrderConfirmationEmail({
        order: persisted,
        to: persisted.userEmail,
      }).catch(() => undefined);
    }
    // 📲 WhatsApp confirmation (same fire-and-forget rules as email).
    if (order.paymentStatus !== "pending") {
      void sendWhatsAppOrderUpdate(persisted, "confirmation").catch(
        () => undefined,
      );
    }

    return NextResponse.json({ ok: true, order: persisted, razorpay, cashfree });
  } catch (err) {
    if (err instanceof CashfreeError) {
      return NextResponse.json(
        { ok: false, error: `Payment setup failed: ${err.message}` },
        { status: 502 },
      );
    }
    if (err instanceof RazorpayError) {
      return NextResponse.json(
        { ok: false, error: `Payment setup failed: ${err.message}` },
        { status: 502 },
      );
    }
    if (err instanceof OrderError) {
      return NextResponse.json(
        { ok: false, error: err.message, fieldErrors: err.fieldErrors },
        { status: 400 },
      );
    }
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code
    ) {
      return NextResponse.json(
        { ok: false, error: (err as { message?: string }).message ?? "Order could not be saved" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "Something went wrong placing your order." },
      { status: 500 },
    );
  }
}
