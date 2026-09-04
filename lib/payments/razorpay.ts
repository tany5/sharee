/**
 * Server-side Razorpay Standard Checkout integration.
 *
 *  - createRazorpayOrder  — creates a payment order via the Orders API
 *    (Basic auth with key_id:key_secret; the secret never leaves the server).
 *  - verifyPaymentSignature — confirms the client success handler's
 *    razorpay_order_id|razorpay_payment_id signature (HMAC-SHA256).
 *  - verifyWebhookSignature — confirms Razorpay → /api/webhooks/razorpay events
 *    against the webhook secret, supporting both the plain-hex and the newer
 *    `t=<ts>,v1=<sig>` header formats.
 *
 * Payment integrity rule: an order is marked paid ONLY after one of these
 * verifications passes (the /api/payments/verify route or the webhook). The
 * success page fires the Purchase event only for orders with
 * paymentStatus === "paid".
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Key ID is public by design (the checkout widget needs it client-side). */
export function razorpayKeyId(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() ||
    process.env.RAZORPAY_KEY_ID?.trim() ||
    undefined
  );
}

export function razorpayKeySecret(): string | undefined {
  return process.env.RAZORPAY_KEY_SECRET?.trim() || undefined;
}

export function razorpayWebhookSecret(): string | undefined {
  return process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || undefined;
}

/** True when live payments are wired up (key id + secret both present). */
export function isRazorpayLive(): boolean {
  return Boolean(razorpayKeyId() && razorpayKeySecret());
}

export class RazorpayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RazorpayError";
  }
}

export interface RazorpayOrder {
  id: string;
  amount: number; // paise
  currency: string;
}

/** Create a payment order server-side (never trust client amounts). */
export async function createRazorpayOrder(input: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const keyId = razorpayKeyId();
  const keySecret = razorpayKeySecret();
  if (!keyId || !keySecret) {
    throw new RazorpayError("Razorpay is not configured on the server");
  }
  if (!Number.isFinite(input.amountPaise) || input.amountPaise <= 0) {
    throw new RazorpayError("Invalid payment amount");
  }
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      amount: Math.round(input.amountPaise),
      currency: "INR",
      receipt: input.receipt.slice(0, 40),
      notes: input.notes ?? {},
    }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    amount?: number;
    currency?: string;
    error?: { description?: string; code?: string };
  };
  if (!res.ok || !data.id) {
    throw new RazorpayError(
      data.error?.description ?? "Could not create the payment order",
    );
  }
  return {
    id: String(data.id),
    amount: Number(data.amount) || Math.round(input.amountPaise),
    currency: String(data.currency ?? "INR"),
  };
}

function hmacHex(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/** Verify the payment signature returned by the checkout success handler. */
export function verifyPaymentSignature(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  keySecret?: string;
}): boolean {
  const secret = input.keySecret ?? razorpayKeySecret();
  if (!secret || !input.razorpayOrderId || !input.razorpayPaymentId || !input.razorpaySignature) {
    return false;
  }
  const expected = hmacHex(secret, `${input.razorpayOrderId}|${input.razorpayPaymentId}`);
  return safeEqual(expected, input.razorpaySignature.toLowerCase());
}

/**
 * Verify a webhook event signature. Handles the classic plain-hex header as
 * well as the timestamped `t=<ts>,v1=<sig>` format.
 */
export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret?: string,
): boolean {
  const webhookSecret = secret ?? razorpayWebhookSecret();
  if (!webhookSecret || !signature) return false;
  const provided = signature.includes("v1=")
    ? (signature
        .split(",")
        .find((part) => part.startsWith("v1="))
        ?.slice(3) ?? "")
    : signature;
  if (!provided) return false;
  const expected = hmacHex(webhookSecret, body);
  return safeEqual(expected, provided.toLowerCase());
}