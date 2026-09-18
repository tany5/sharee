/**
 * WhatsApp order/shipping updates — Meta WhatsApp Cloud API.
 *
 *   order event → sendWhatsApp*() → graph.facebook.com → customer WhatsApp
 *
 * Strategy:
 *   • WHATSAPP_PHONE_NUMBER_ID + a token configured → send a free-form text
 *     message via the Cloud API. Free-form messages are delivered when the
 *     customer has messaged the business number within the last 24 hours
 *     (the "customer service window"). Outside that window Meta rejects the
 *     send with an error (131047) — we log it and continue; email remains
 *     the guaranteed channel.
 *   • Template messages (approved HSMs) are the reliable outside-window path;
 *     the message text below is kept short and template-ready so switching
 *     to `type: "template"` later only touches `buildMessage()`.
 *   • Unconfigured → no-op (logged). WhatsApp never blocks an order.
 *
 * Configuration (.env.local):
 *   WHATSAPP_TOKEN=EAAG…          # token with whatsapp_business_messaging
 *   WHATSAPP_PHONE_NUMBER_ID=…    # from the WhatsApp product in the Meta app
 *   # optional, defaults to phone:
 *   # messages are sent to the order's WhatsApp number (E.164, no +, no spaces)
 */
import "server-only";
import type { Order } from "@/lib/types";
import { SITE } from "@/lib/site";
import { loadPipelineSecrets } from "@/lib/marketing/secrets";

export function whatsappToken(): string | undefined {
  return process.env.WHATSAPP_TOKEN?.trim() || undefined;
}

/**
 * Token used for Cloud API sends: WHATSAPP_TOKEN if set, otherwise the
 * never-expiring Meta system-user token the owner keeps in
 * secret/secret/meta.txt (parsed by lib/marketing/secrets.ts — it carries
 * whatsapp_business_messaging + whatsapp_business_management scopes).
 */
async function resolveWhatsAppToken(): Promise<string | undefined> {
  const env = whatsappToken();
  if (env) return env;
  try {
    const secrets = await loadPipelineSecrets();
    return secrets.metaPageToken || undefined;
  } catch {
    return undefined;
  }
}

export function whatsappPhoneId(): string | undefined {
  return process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || undefined;
}

/** True when WhatsApp sends are configured. */
export function isWhatsAppLive(): boolean {
  return Boolean(whatsappToken() && whatsappPhoneId());
}

/** Normalise an Indian mobile to E.164 digits (no +): 07980… → 917980… */
export function normalizeWhatsApp(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return undefined;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length > 12) return digits.slice(-12); // keep last 12 (91xxxxxxxxxx)
  return undefined;
}

/** The number to notify for an order — explicit WhatsApp, else phone. */
export function orderWhatsAppNumber(order: Order): string | undefined {
  return normalizeWhatsApp(order.whatsapp ?? order.address.whatsapp ?? order.address.phone);
}

/* ------------------------------ messages ---------------------------------- */

export type OrderEventType =
  | "confirmation"
  | "payment"
  | "dispatched"
  | "delivered"
  | "cancelled";

const COPY: Record<OrderEventType, (o: Order) => string> = {
  confirmation: (o) =>
    `🥻 *${SITE.name}* — Order *${o.number}* confirmed!\n` +
    (o.paymentMethod === "cod"
      ? `Pay ₹${o.total} on delivery. `
      : ``) +
    `${o.items[0]?.name ?? "Your order"}${o.items.length > 1 ? ` +${o.items.length - 1} more` : ""}\n` +
    `🚚 FREE shipping · Est. delivery: ${estLabel(o)}\n` +
    `Track: ${trackUrl(o)}`,
  payment: (o) =>
    `💳 *${SITE.name}* — Payment received for *${o.number}*!\n` +
    `₹${o.total} paid via ${methodLabel(o.paymentMethod)}. Your sarees are being prepared 🥻\n` +
    `Track: ${trackUrl(o)}`,
  dispatched: (o) =>
    `🚚 *${SITE.name}* — Order *${o.number}* is on the way!\n` +
    `Arriving in 3–5 working days. We'll ping you when it's delivered.\n` +
    `Track: ${trackUrl(o)}`,
  delivered: (o) =>
    `❤️ *${SITE.name}* — Order *${o.number}* delivered!\n` +
    `Enjoy your saree! Come back soon — every saree is ₹199 with FREE shipping 🥻`,
  cancelled: (o) =>
    `🚫 *${SITE.name}* — Order *${o.number}* cancelled.\n` +
    `If you paid online, your refund arrives in 5–7 working days.\n` +
    `Questions? Just reply here or call ${SITE.phone}`,
};

function methodLabel(m: string): string {
  return { upi: "UPI", card: "Card", netbanking: "Net Banking", cod: "COD" }[m] ?? m;
}

function estLabel(o: Order): string {
  try {
    return new Date(o.estimatedDelivery).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "3–5 days";
  }
}

function trackUrl(o: Order): string {
  return `${SITE.url}/order-success?order=${encodeURIComponent(o.id)}`;
}

export function buildMessage(order: Order, event: OrderEventType): string {
  return (COPY[event] ?? COPY.confirmation)(order);
}

/* ------------------------------- sending ---------------------------------- */

/**
 * Send an order update over WhatsApp. Fire-and-forget safe: returns false
 * on any failure (unconfigured, rejected, network) — callers never await it
 * on the critical path.
 */
/**
 * Low-level Cloud API text send to any E.164 number (no +). Resolves false on
 * any failure — used for customer updates and owner alerts alike.
 */
export async function sendCloudApiText(
  to: string,
  text: string,
): Promise<boolean> {
  const token = await resolveWhatsAppToken();
  const phoneId = whatsappPhoneId();
  if (!token || !phoneId) return false;

  const body = JSON.stringify({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: false, body: text },
  });

  try {
    const res = await fetch(
      `https://graph.facebook.com/${process.env.META_GRAPH_VERSION ?? "v23.0"}/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // 131047 = outside 24h customer-service window (needs an approved template).
      console.error(`[whatsapp] → ${maskPhone(to)} failed: HTTP ${res.status} ${text.slice(0, 200)}`);
      return false;
    }
    console.log(`[whatsapp] → ${maskPhone(to)}`);
    return true;
  } catch (err) {
    console.error(`[whatsapp] ${to} error`, err);
    return false;
  }
}

/** Customer-facing order update over WhatsApp (official Cloud API). */
export async function sendWhatsAppOrderUpdate(
  order: Order,
  event: OrderEventType,
): Promise<boolean> {
  const token = await resolveWhatsAppToken();
  const phoneId = whatsappPhoneId();
  if (!token || !phoneId) return false;
  const to = orderWhatsAppNumber(order);
  if (!to) return false;

  return sendCloudApiText(to, buildMessage(order, event));
}

function maskPhone(phone: string): string {
  return phone.length <= 4 ? "***" : `${phone.slice(0, 2)}****${phone.slice(-4)}`;
}
