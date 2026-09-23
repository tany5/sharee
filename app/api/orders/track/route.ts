import { NextResponse } from "next/server";
import { findOrderForTracking } from "@/lib/backend";
import { toTrackedOrder, type TrackedOrder } from "@/lib/tracking";
import type { Order } from "@/lib/types";

/**
 * Public order tracking lookup — POST { number, phone }.
 *
 * The phone number (as entered at checkout) is the auth: the response only
 * comes back when the caller knows both the order number and the phone the
 * order was placed with. Rate limited like /api/orders (order numbers are
 * semi-enumerable, so brute-forcing phones must be expensive). The response
 * is the customer-safe TrackedOrder projection — no emails, UTM, costs, ids.
 */
interface RateBucket {
  times: number[];
}

const buckets = new Map<string, RateBucket>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

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

  let body: { number?: string; phone?: string };
  try {
    body = (await request.json()) as { number?: string; phone?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const number = body.number?.trim().slice(0, 40) ?? "";
  const phone = body.phone?.trim().slice(0, 20) ?? "";
  if (!number || !phone) {
    return NextResponse.json(
      { ok: false, error: "Enter your order number and phone number." },
      { status: 400 },
    );
  }

  try {
    const found = await findOrderForTracking(number, phone);
    if (!found) {
      // Same response for "no such order" and "wrong phone" — no oracle.
      return NextResponse.json(
        { ok: false, error: "No order matches that number and phone combination." },
        { status: 404 },
      );
    }
    const order: TrackedOrder =
      "storedIn" in found ? toTrackedOrder(found as Order) : (found as TrackedOrder);
    return NextResponse.json({ ok: true, order });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not look up your order right now." },
      { status: 500 },
    );
  }
}
