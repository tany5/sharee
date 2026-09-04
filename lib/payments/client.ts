/**
 * Client-safe Razorpay helpers/types. This module must never import server
 * modules — it is bundled into the checkout page.
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

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, cb: (resp?: Record<string, unknown>) => void) => void;
    };
  }
}