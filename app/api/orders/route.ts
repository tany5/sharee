import { NextResponse } from "next/server";
import { createDemoOrder, OrderError } from "@/lib/orders";
import { addOrder, currentUser, resolveOrderSource } from "@/lib/backend";
import type { CartItem, DeliveryAddress, PaymentMethodId, Utm } from "@/lib/types";

/**
 * Demo order endpoint.
 *
 *  - quantities + slugs validated against the demo DB (admin-edited prices
 *    and costs are authoritative — the browser is never trusted)
 *  - cost snapshots attached for the admin profit dashboard
 *  - signed-in customers get their order persisted to their history
 *  - guest checkout continues to work and returns the same order payload
 *
 * The Razorpay flow (production) adds: create Razorpay order server-side,
 * verify payment signature + webhook, then flip payment_status to paid —
 * Purchase is fired client-side only after that verification (order-success).
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
    const order = await createDemoOrder({
      items: body.items ?? [],
      address: body.address ?? {},
      paymentMethod: body.paymentMethod ?? "upi",
      utm: body.utm,
      resolveProduct: resolveOrderSource,
      user: user ? { id: user.id, email: user.email } : undefined,
    });

    const persisted = await addOrder(order);
    return NextResponse.json({ ok: true, order: persisted });
  } catch (err) {
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
