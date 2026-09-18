/**
 * Server-side Cashfree Payments integration (PG 3.0.x / x-api-version 2023-08-01).
 *
 *  - createCashfreeOrder — creates a payment order via POST /pg/orders
 *    (x-client-id / x-client-secret headers; the secret never leaves the
 *    server) and returns the `payment_session_id` the JS drop-in needs.
 *  - fetchCashfreeOrder — GET /pg/orders/{order_id}, used to independently
 *    confirm payment status server-side (the Cashfree drop-in callback is not
 *    cryptographically signed, so status is re-fetched from the API before an
 *    order is marked paid).
 *  - verifyWebhookSignature — confirms Cashfree → /api/webhooks/cashfree
 *    events: base64(HMAC-SHA256(timestamp + "." + payload, client_secret))
 *    against the x-webhook-signature header.
 *
 * Payment integrity rule (same as the Razorpay path): an order is marked paid
 * ONLY after server-side verification — a paid/pending settlement fetched from
 * the Cashfree Orders API, or a webhook whose signature verifies.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** API version pinned in one place (2023-08-01 is the stable v3 line). */
const API_VERSION = "2023-08-01";

export function cashfreeAppId(): string | undefined {
  return process.env.CASHFREE_APP_ID?.trim() || undefined;
}

export function cashfreeSecretKey(): string | undefined {
  return process.env.CASHFREE_SECRET_KEY?.trim() || undefined;
}

/** "sandbox" (default) or "production" — sandbox hits api-sandbox.cashfree.com. */
export function cashfreeEnv(): "sandbox" | "production" {
  const v = process.env.CASHFREE_ENV?.trim().toLowerCase();
  return v === "production" ? "production" : "sandbox";
}

export function cashfreeApiBase(): string {
  return cashfreeEnv() === "production"
    ? "https://api.cashfree.com"
    : "https://api-sandbox.cashfree.com";
}

/** True when live Cashfree payments are wired up (app id + secret present). */
export function isCashfreeLive(): boolean {
  return Boolean(cashfreeAppId() && cashfreeSecretKey());
}

export class CashfreeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CashfreeError";
  }
}

/**
 * Cashfree customer_id only allows alphanumerics, underscore and hyphen —
 * no "@" or ".", so emails are off-limits. Sanitise to a stable, safe id:
 * user id (uuid) → phone digits → email, with the order id as fallback.
 */
export function safeCustomerId(input: {
  userId?: string;
  email?: string;
  phone: string;
  fallback: string;
}): string {
  const candidate =
    input.userId?.trim() || input.phone.trim() || input.email?.trim() || input.fallback;
  const safe = candidate
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return (safe || input.fallback).slice(0, 45);
}

export interface CashfreeOrder {
  /** Cashfree order id (echoes the merchant order id we send). */
  orderId: string;
  /** Cashfree's own numeric reference. */
  cfOrderId: string;
  orderAmount: number;
  orderCurrency: string;
  /** Drop-in checkout session token for the client SDK. */
  paymentSessionId: string;
  orderStatus: string;
}

/** Create a payment order server-side (never trust client amounts). */
export async function createCashfreeOrder(input: {
  /** Merchant order id — unique per request (3-45 chars, [A-Za-z0-9_-]). */
  orderId: string;
  amountRupees: number;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone: string;
  note?: string;
  notifyUrl?: string;
  returnUrl?: string;
}): Promise<CashfreeOrder> {
  const appId = cashfreeAppId();
  const secret = cashfreeSecretKey();
  if (!appId || !secret) {
    throw new CashfreeError("Cashfree is not configured on the server");
  }
  if (!Number.isFinite(input.amountRupees) || input.amountRupees < 1) {
    throw new CashfreeError("Invalid payment amount");
  }

  const res = await fetch(`${cashfreeApiBase()}/pg/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-version": API_VERSION,
      "x-client-id": appId,
      "x-client-secret": secret,
    },
    body: JSON.stringify({
      order_id: input.orderId,
      order_amount: Math.round(input.amountRupees * 100) / 100,
      order_currency: "INR",
      customer_details: {
        customer_id: input.customerId,
        customer_name: input.customerName || undefined,
        customer_email: input.customerEmail || undefined,
        customer_phone: input.customerPhone,
      },
      order_note: input.note || undefined,
      order_meta: {
        return_url: input.returnUrl || undefined,
        notify_url: input.notifyUrl || undefined,
      },
    }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as {
    order_id?: string;
    cf_order_id?: string | number;
    order_amount?: number;
    order_currency?: string;
    payment_session_id?: string;
    order_status?: string;
    message?: string;
  };
  if (!res.ok || !data.order_id || !data.payment_session_id) {
    throw new CashfreeError(
      data.message ?? "Could not create the payment order",
    );
  }
  return {
    orderId: String(data.order_id),
    cfOrderId: String(data.cf_order_id ?? ""),
    orderAmount: Number(data.order_amount) || Math.round(input.amountRupees * 100) / 100,
    orderCurrency: String(data.order_currency ?? "INR"),
    paymentSessionId: String(data.payment_session_id),
    orderStatus: String(data.order_status ?? "ACTIVE"),
  };
}

export interface CashfreeOrderStatus {
  orderId: string;
  cfOrderId: string;
  orderStatus: "PAID" | "ACTIVE" | "EXPIRED" | "TERMINAL" | "TERMINAL_ORDER_STATUS" | string;
  orderAmount: number;
  /** Amount actually settled by the customer (present once attempted). */
  orderAmountPaid?: number;
  paymentId?: string;
  paymentStatus?: string;
  paymentMethod?: string;
}

interface CashfreePaymentEntity {
  cf_payment_id?: number | string;
  order_id?: string;
  payment_status?: string;
  payment_amount?: number;
  payment_method?: string | { payment_method?: string };
}

/** Fetch order + payments from the Cashfree API for server-side confirmation. */
export async function fetchCashfreeOrder(orderId: string): Promise<CashfreeOrderStatus> {
  const appId = cashfreeAppId();
  const secret = cashfreeSecretKey();
  if (!appId || !secret) {
    throw new CashfreeError("Cashfree is not configured on the server");
  }
  const headers = {
    "x-api-version": API_VERSION,
    "x-client-id": appId,
    "x-client-secret": secret,
  };

  const res = await fetch(
    `${cashfreeApiBase()}/pg/orders/${encodeURIComponent(orderId)}`,
    { headers, cache: "no-store" },
  );
  const order = (await res.json().catch(() => ({}))) as {
    order_id?: string;
    cf_order_id?: string | number;
    order_status?: string;
    order_amount?: number;
    message?: string;
  };
  if (!res.ok || !order.order_id) {
    throw new CashfreeError(order.message ?? "Could not fetch the payment status");
  }

  // Payments for the order — latest attempt decides the payment id/status.
  let payments: CashfreePaymentEntity[] = [];
  try {
    const pres = await fetch(
      `${cashfreeApiBase()}/pg/orders/${encodeURIComponent(orderId)}/payments`,
      { headers, cache: "no-store" },
    );
    if (pres.ok) {
      const list = (await pres.json().catch(() => null)) as
        | CashfreePaymentEntity[]
        | { payments?: CashfreePaymentEntity[] }
        | null;
      payments = Array.isArray(list) ? list : (list?.payments ?? []);
    }
  } catch {
    /* payments list is best-effort — order status is the authoritative gate */
  }

  const okPayments = payments.filter(
    (p) => p.payment_status === "SUCCESS" || p.payment_status === "PENDING",
  );
  const latest = okPayments[okPayments.length - 1];
  const methodRaw = latest?.payment_method;
  const method =
    typeof methodRaw === "string"
      ? methodRaw
      : methodRaw?.payment_method ?? undefined;

  return {
    orderId: String(order.order_id),
    cfOrderId: String(order.cf_order_id ?? ""),
    orderStatus: String(order.order_status ?? "ACTIVE"),
    orderAmount: Number(order.order_amount ?? 0),
    orderAmountPaid: latest?.payment_amount,
    paymentId: latest?.cf_payment_id != null ? String(latest.cf_payment_id) : undefined,
    paymentStatus: latest?.payment_status,
    paymentMethod: method ? String(method) : undefined,
  };
}

function hmacBase64(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("base64");
}

function safeEqual(a: string, b: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Verify a Cashfree webhook signature: the signature is
 * base64(HMAC-SHA256(`${timestamp}.${rawBody}`, client_secret)) with the
 * timestamp taken from the x-webhook-timestamp header.
 */
export function verifyWebhookSignature(input: {
  rawBody: string;
  signature: string;
  timestamp: string;
  secret?: string;
}): boolean {
  const secret = input.secret ?? cashfreeSecretKey();
  if (!secret || !input.signature || !input.timestamp || !input.rawBody) return false;
  const expected = hmacBase64(secret, `${input.timestamp}.${input.rawBody}`);
  return safeEqual(expected, input.signature);
}
