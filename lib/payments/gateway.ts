/**
 * Payment gateway selector.
 *
 * The active gateway is chosen by environment — no code changes needed to
 * switch back:
 *
 *   PAYMENT_GATEWAY=cashfree  → Cashfree (current default)
 *   PAYMENT_GATEWAY=razorpay  → Razorpay (previous integration, kept intact)
 *
 * Both integrations remain fully implemented; this module is the single
 * decision point used by the order API, the verify route and the checkout UI.
 * When PAYMENT_GATEWAY is unset, the app falls back to whichever gateway is
 * actually configured (Cashfree first), so filling in just the Cashfree keys
 * is enough to go live.
 */
import { isRazorpayLive } from "./razorpay";
import { isCashfreeLive } from "./cashfree";

export type PaymentGateway = "cashfree" | "razorpay";

export function activeGateway(): PaymentGateway {
  const forced = process.env.PAYMENT_GATEWAY?.trim().toLowerCase();
  if (forced === "razorpay") return "razorpay";
  if (forced === "cashfree") return "cashfree";
  // Auto-detect: prefer Cashfree when configured, otherwise Razorpay.
  return isCashfreeLive() ? "cashfree" : isRazorpayLive() ? "razorpay" : "cashfree";
}

export const isCashfreeGateway = (): boolean => activeGateway() === "cashfree";
export const isRazorpayGateway = (): boolean => activeGateway() === "razorpay";

/** True when the active gateway has live online payments wired up. */
export function isLiveGateway(): boolean {
  return isCashfreeGateway() ? isCashfreeLive() : isRazorpayLive();
}

export class GatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GatewayError";
  }
}
