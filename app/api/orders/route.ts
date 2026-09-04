import { NextResponse } from "next/server";
import { createDemoOrder, OrderError } from "@/lib/orders";
import { addOrder, currentUser, resolveOrderSource } from "@/lib/backend";
import {
  createRazorpayOrder,
  isRazorpayLive,
  razorpayKeyId,
  RazorpayError,
} from "@/lib/payments/razorpay";
import { SITE } from "@/lib/site";
import type { RazorpayPayload } from "@/lib/payments/client";
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
 * Live Razorpay: when RAZORPAY key id + secret are configured, online-paid
 * orders get a payment order created server-side and are returned as
 * `paymentStatus: "pending"` with a `razorpay` payload for the checkout
 * widget. They flip to "paid" only after signature verification
 * (/api/payments/verify) or the webhook (/api/webhooks/razorpay) — Purchase
 * fires client-side only after that verification (order-success page).
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

  try {
    const razorpayLive = isRazorpayLive();
    const order = await createDemoOrder({
      items: body.items ?? [],
      address: body.address ?? {},
      paymentMethod: body.paymentMethod ?? "upi",
      utm: body.utm,
      resolveProduct: resolveOrderSource,
      user: user ? { id: user.id, email: user.email } : undefined,
      razorpayIntent: razorpayLive,
    });

    // Live payments: create the Razorpay order server-side, attach its id to
    // the order record, and hand the widget payload back to the client. COD
    // and demo payments skip this entirely.
    let razorpay: RazorpayPayload | undefined;
    if (razorpayLive && order.paymentMethod !== "cod") {
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

    const persisted = await addOrder(order);
    return NextResponse.json({ ok: true, order: persisted, razorpay });
  } catch (err) {
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
