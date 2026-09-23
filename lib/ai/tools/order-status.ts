/**
 * Order status tool — SECURITY-CRITICAL.
 *
 * The chatbot NEVER sends an order id from the browser "on behalf of" the
 * user. It asks the backend "what are MY orders", and the backend answers
 * only from the authenticated session cookie (same authorization as
 * /api/account/orders). Guests get a sign-in suggestion, never a lookup by
 * order number through this tool — /track (order number + phone) remains the
 * guest path and is never invoked implicitly.
 */
import type { OrderStatusBlock } from "@/lib/ai/types/chat";

export type OrderStatusResult =
  | { ok: true; orders: OrderStatusBlock["order"][] }
  | { ok: false; reason: "unauthenticated" | "error"; message: string };

/** Fetch the signed-in customer's own orders via the existing account API. */
export async function runOrderStatus(): Promise<OrderStatusResult> {
  try {
    const res = await fetch("/api/account/orders", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (res.status === 401) {
      return {
        ok: false,
        reason: "unauthenticated",
        message: "You're not signed in, so I can't see your orders.",
      };
    }
    if (!res.ok) throw new Error(`account orders ${res.status}`);
    const data = (await res.json()) as {
      ok: boolean;
      orders?: Array<{
        number: string;
        createdAt: string;
        estimatedDelivery: string;
        paymentStatus: OrderStatusBlock["order"]["paymentStatus"];
        fulfilment?: OrderStatusBlock["order"]["fulfilment"];
        tracking?: OrderStatusBlock["order"]["tracking"];
        items: OrderStatusBlock["order"]["items"];
        total: number;
      }>;
    };
    const orders = (data.orders ?? []).map((o) => ({
      number: o.number,
      createdAt: o.createdAt,
      estimatedDelivery: o.estimatedDelivery,
      paymentStatus: o.paymentStatus,
      fulfilment: o.fulfilment,
      tracking: o.tracking ?? null,
      items: Array.isArray(o.items) ? o.items : [],
      total: o.total,
    }));
    return { ok: true, orders: orders.slice(0, 3) };
  } catch {
    return {
      ok: false,
      reason: "error",
      message: "I couldn't load your orders right now. Please try again shortly.",
    };
  }
}
