/**
 * Client-safe payment gateway helpers/types. This module must never import
 * server modules — it is bundled into the checkout page. Holds the Razorpay
 * checkout payload plus the Cashfree drop-in payload and window typings.
 */

/** Payload returned by POST /api/orders when live Razorpay is configured. */
export interface RazorpayPayload {
  keyId: string;
  /** The Razorpay payment-order id (order_…) created server-side. */
  orderId: string;
  amountPaise: number;
  currency: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
}

export interface RazorpaySuccessResponse {
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

/** True when the checkout should offer live Razorpay (key id configured). */
export function razorpayClientLive(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim());
}

/* ------------------------------- Cashfree ------------------------------- */

/** Payload returned by POST /api/orders when the Cashfree gateway is active. */
export interface CashfreePayload {
  /** The Cashfree order id created server-side (sent as our order id). */
  orderId: string;
  /** Drop-in checkout session token from POST /pg/orders. */
  paymentSessionId: string;
  amountRupees: number;
  currency: string;
  /** "sandbox" | "production" — the client SDK must match the server env. */
  mode: string;
}

/** Client-side view of the active gateway (banner copy + resume flows). */
export type ClientGateway = "cashfree" | "razorpay";

/**
 * Which gateway the checkout UI advertises. Server responses carry the actual
 * payload (cashfree or razorpay), so this only drives cosmetics + resume.
 * Set NEXT_PUBLIC_PAYMENT_GATEWAY=cashfree|razorpay to pin it; otherwise it
 * follows the Razorpay public key (absent → Cashfree is assumed).
 */
export function activeClientGateway(): ClientGateway {
  const g = process.env.NEXT_PUBLIC_PAYMENT_GATEWAY?.trim().toLowerCase();
  if (g === "razorpay") return "razorpay";
  if (g === "cashfree") return "cashfree";
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() ? "razorpay" : "cashfree";
}

/** Loaded from https://sdk.cashfree.com/js/v3/cashfree.js (drop-in). */
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, cb: (resp?: Record<string, unknown>) => void) => void;
    };
    /** Cashfree JS drop-in — checkout() opens the payment modal. */
    Cashfree?: {
      new (config: { mode: "sandbox" | "production" }): {
        checkout: (opts: {
          paymentSessionId: string;
          redirectTarget?: "_modal" | "_self";
          onSuccess?: (result?: {
            order?: { orderId?: string };
            payment?: { paymentId?: string };
          }) => void;
          onFailure?: (error?: { message?: string }) => void;
          onClose?: () => void;
        }) => Promise<unknown>;
      };
    };
  }
}