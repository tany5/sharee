/**
 * Owner notifications — the shop owner is alerted on every new order and
 * every confirmed payment:
 *
 *   order/payment event → notifyOwnerOfOrder() → ┬ WhatsApp (official Cloud API
 *                                                │  if WHATSAPP_PHONE_NUMBER_ID
 *                                                │  is set; else free CallMeBot)
 *                                                └ Email via Resend
 *
 * WhatsApp channels:
 *   • Cloud API (official, free tier) — WHATSAPP_PHONE_NUMBER_ID in .env.local;
 *     the token falls back to the never-expiring Meta system-user token the
 *     owner keeps in secret/secret/meta.txt (scopes verified:
 *     whatsapp_business_messaging + whatsapp_business_management).
 *   • CallMeBot (https://www.callmebot.com) — free personal-use bridge to ONE
 *     pre-authorised number. One-time setup:
 *       1. Save +34 623 78 95 95 as a phone contact.
 *       2. Send it "I allow callmebot to send me messages" on WhatsApp.
 *       3. It replies with your apikey — put it in OWNER_WHATSAPP_APIKEY.
 *
 * Everything here is fire-and-forget: an alert failure is logged and never
 * blocks an order, a payment, or the customer emails.
 */
import "server-only";
import type { Order } from "@/lib/types";
import { SITE } from "@/lib/site";
import { emailFrom, maskEmail, resendApiKey } from "@/lib/email";
import { normalizeWhatsApp, sendCloudApiText } from "@/lib/notify";

/* ------------------------------- config ----------------------------------- */

/** Owner email for new-order alerts (OWNER_EMAIL). */
export function ownerEmail(): string | undefined {
  return process.env.OWNER_EMAIL?.trim() || undefined;
}

/** Owner WhatsApp number for new-order alerts (OWNER_WHATSAPP). */
export function ownerWhatsApp(): string | undefined {
  return process.env.OWNER_WHATSAPP?.trim() || undefined;
}

/** CallMeBot apikey that authorises WhatsApp sends to the owner number. */
function ownerWhatsAppApiKey(): string | undefined {
  return process.env.OWNER_WHATSAPP_APIKEY?.trim() || undefined;
}

/** True when at least one owner channel is fully configured. */
export function isOwnerAlertConfigured(): boolean {
  return Boolean(ownerEmail() || ownerWhatsApp());
}

/* ------------------------------ messages ---------------------------------- */

export type OwnerAlertKind = "order" | "payment";

function methodLabel(m: string): string {
  return { upi: "UPI", card: "Card", netbanking: "Net Banking", cod: "COD" }[m] ?? m;
}

function itemsLabel(order: Order): string {
  const first = order.items[0];
  if (!first) return "Order";
  const extra = order.items.length - 1;
  return `${first.name}${extra > 0 ? ` +${extra} more` : ""}`;
}

/** Compact alert text shared by WhatsApp (markdown bold) and email. */
export function ownerOrderText(order: Order, kind: OwnerAlertKind): string {
  const head = kind === "payment" ? "💳 Payment received" : "🛍️ New order";
  return (
    `${head} — *#${order.number}*\n` +
    `₹${Math.round(order.total)} · ${methodLabel(order.paymentMethod)}\n` +
    `${itemsLabel(order)}\n` +
    `👤 ${order.address.fullName} · 📞 ${order.address.phone}\n` +
    `📍 ${order.address.city}, ${order.address.state} ${order.address.pincode}`
  );
}

/* ------------------------------ dedupe ------------------------------------ */

/**
 * One alert per order per kind, per process — the payment-verify route and
 * the gateway webhook can both confirm the same payment (mirrors the
 * customer-email dedupe in lib/email.ts).
 */
const alerted = new Set<string>();

/* ------------------------------- sending ---------------------------------- */

/** WhatsApp alert to the owner — Cloud API when configured, CallMeBot else. */
async function sendOwnerWhatsApp(
  order: Order,
  kind: OwnerAlertKind,
): Promise<boolean> {
  const raw = ownerWhatsApp();
  const phone = raw ? normalizeWhatsApp(raw) : undefined;
  if (!phone) return false;

  const text = ownerOrderText(order, kind);

  // Preferred: official WhatsApp Cloud API (needs a WABA phone number id).
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (phoneId) {
    const sent = await sendCloudApiText(phone, text);
    if (sent) return true;
    console.warn("[owner] Cloud API send failed — trying CallMeBot fallback");
  }

  // Fallback: free CallMeBot bridge (requires OWNER_WHATSAPP_APIKEY).
  const apikey = ownerWhatsAppApiKey();
  if (!apikey) {
    console.warn(
      "[owner] WhatsApp alert not sent: set WHATSAPP_PHONE_NUMBER_ID (Cloud API) or OWNER_WHATSAPP_APIKEY (CallMeBot) — setup steps in .env.local",
    );
    return false;
  }

  const url =
    "https://api.callmebot.com/whatsapp.php" +
    `?phone=%2B${phone}` + // CallMeBot expects +E164 — encode the +
    `&text=${encodeURIComponent(text)}` +
    `&apikey=${encodeURIComponent(apikey)}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`[owner] CallMeBot failed: HTTP ${res.status}`);
      return false;
    }
    const body = await res.text().catch(() => "");
    if (/ERROR/i.test(body)) {
      console.error(`[owner] CallMeBot rejected: ${body.slice(0, 120)}`);
      return false;
    }
    console.log("[owner] whatsapp alert sent (CallMeBot)");
    return true;
  } catch (err) {
    console.error("[owner] whatsapp error", err);
    return false;
  }
}

/** Email alert to the owner via Resend (independent of the customer emails). */
async function sendOwnerEmail(
  order: Order,
  kind: OwnerAlertKind,
): Promise<boolean> {
  const to = ownerEmail();
  const key = resendApiKey();
  if (!to || !key) return false;

  const title = kind === "payment" ? "Payment received" : "New order";
  const text =
    ownerOrderText(order, kind).replace(/\*/g, "") + // strip WhatsApp bold
    `\n\nAdmin: ${SITE.url}/admin/orders`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [to],
        subject: `${kind === "payment" ? "💳" : "🛍️"} ${title} #${order.number} — ₹${Math.round(order.total)} (${methodLabel(order.paymentMethod)})`,
        text,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[owner] email failed: HTTP ${res.status} ${body.slice(0, 120)}`);
      return false;
    }
    console.log(`[owner] email alert → ${maskEmail(to)}`);
    return true;
  } catch (err) {
    console.error("[owner] email error", err);
    return false;
  }
}

/**
 * Notify the owner of a new order / confirmed payment over both channels.
 * Fire-and-forget by design — callers `void` it; deduped per order+kind.
 */
export async function notifyOwnerOfOrder(
  order: Order,
  kind: OwnerAlertKind = "order",
): Promise<void> {
  if (!isOwnerAlertConfigured()) return;
  const key = `${order.id}:${kind}`;
  if (alerted.has(key)) return;
  alerted.add(key);
  await Promise.allSettled([
    sendOwnerWhatsApp(order, kind),
    sendOwnerEmail(order, kind),
  ]);
}
