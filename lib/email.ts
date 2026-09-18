/**
 * Transactional email via Resend (REST API — no SDK dependency), rendered
 * from the vendor-supplied TheTanti templates in `lib/email-templates/`.
 *
 *   Next.js API route / server code → send*() → Resend → customer inbox
 *
 * Events wired today:
 *   • order placed (COD / demo-paid)            → 02-order-confirmation
 *   • payment verified (online gateways)        → 02-order-confirmation
 *   • admin fulfilment change:
 *       dispatched                              → 04-shipped (+ tracking)
 *       completed                               → 05-delivered
 *       cancelled / other                       → 03-order-status
 *   • account registered                        → 01-welcome
 *
 * Design rules:
 *   • Email must never break a purchase: sends are fire-and-forget; failures
 *     are logged and swallowed.
 *   • The payment/confirmation email is deduped per order in-process (the
 *     verify route and the gateway webhook can both confirm one payment).
 *   • No secrets on the client — this module is server-only.
 *
 * Configuration (.env.local):
 *   RESEND_API_KEY=re_xxxxxxxx   # API key (full access) from the Resend dashboard
 *   EMAIL_FROM="TheTanti <orders@thetanti.shop>"   # MUST be an address on a
 *                 # Resend-verified domain (DNS: DKIM + SPF + MAIL FROM records).
 *                 # Sending from onboarding@resend.dev is test-only: it is
 *                 # restricted to the account owner's own inbox and routinely
 *                 # filtered as spam elsewhere — never ship with it.
 *   EMAIL_BCC=                   # optional comma-separated Bcc copies
 *   EMAIL_ENABLED=0              # optional kill-switch (default: on)
 *   EMAIL_LOGO_URL=              # optional logo override; defaults to
 *                 # ${SITE.url}/logo/logo.png (see lib/email-templates/render.ts)
 */
import "server-only";
import { SITE } from "@/lib/site";
import type { Order } from "@/lib/types";
import {
  orderTextFor,
  renderDeliveredEmail,
  renderOrderConfirmationEmail,
  renderOrderStatusEmail,
  renderShippedEmail,
  renderWelcomeEmail,
} from "@/lib/email-templates/render";

/* ------------------------------- config ---------------------------------- */

export function resendApiKey(): string | undefined {
  return process.env.RESEND_API_KEY?.trim() || undefined;
}

/**
 * From address for every outgoing email.
 *
 * IMPORTANT (deliverability): this must be an address on a Resend-verified
 * domain — i.e. the domain whose Resend DNS records (DKIM `resend._domainkey`,
 * SPF on the `send.` subdomain, MAIL FROM MX) are showing "Verified" in the
 * Resend dashboard. The Resend sandbox sender `onboarding@resend.dev` is only
 * allowed to deliver to the account owner's own inbox and is spam-filtered
 * everywhere else, so it must never be the production default.
 */
export function emailFrom(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    `${SITE.name} <orders@${SITE.url.replace(/^https?:\/\//, "").replace(/^www\./, "")}>`
  );
}

/** Optional Bcc copies (order records / owner copy), comma-separated. */
export function emailBcc(): string[] {
  return (process.env.EMAIL_BCC?.trim() ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Kill switch — set EMAIL_ENABLED=0 to stop all outgoing email. */
export function emailEnabled(): boolean {
  return process.env.EMAIL_ENABLED !== "0";
}

/** True when a real send can happen (key present + enabled). */
export function isEmailLive(): boolean {
  return emailEnabled() && Boolean(resendApiKey());
}

/* ------------------------------- sending --------------------------------- */

interface EmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Logical event name for logs. */
  event: string;
}

/**
 * Orders already emailed an order/payment confirmation in this process —
 * the verify route and the gateway webhook can both confirm the same
 * payment, and the customer should receive exactly one email.
 */
const paymentEmailed = new Set<string>();

/** Low-level Resend send — resolves to true when the API accepted the message. */
async function resendSend(input: EmailInput): Promise<boolean> {
  if (!isEmailLive()) return false;
  if (!input.to || !input.to.includes("@")) return false;
  const bcc = emailBcc();
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [input.to],
        bcc: bcc.length ? bcc : undefined,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      // 401 bad key · 403 test-mode recipient · 422 validation · 429 limit.
      const body = await res.text().catch(() => "");
      console.error(`[email] ${input.event} failed: HTTP ${res.status} ${body}`);
      return false;
    }
    console.log(`[email] ${input.event} → ${maskEmail(input.to)}`);
    return true;
  } catch (err) {
    console.error(`[email] ${input.event} error`, err);
    return false;
  }
}

export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const user = email.slice(0, at);
  return `${user.slice(0, 2)}${"*".repeat(Math.max(1, user.length - 2))}${email.slice(at)}`;
}

/* ------------------------------ events ----------------------------------- */

export interface OrderEmailInput {
  order: Order;
  to: string;
  /** Overrides the Track-My-Order link. */
  orderLink?: string;
}

function orderLink(order: Order, override?: string): string {
  return (
    override ?? `${SITE.url}/order-success?order=${encodeURIComponent(order.id)}`
  );
}

/**
 * 🥻 Order confirmation — sent once per order:
 *   • COD / demo-paid: at placement (from /api/orders).
 *   • Online gateways: after payment verification (verify route / webhook).
 */
export async function sendOrderConfirmationEmail(
  input: OrderEmailInput,
): Promise<boolean> {
  const { order, to } = input;
  if (!to) return false;
  if (paymentEmailed.has(order.id)) return false;
  const { subject, html } = renderOrderConfirmationEmail(order);
  const sent = await resendSend({
    to,
    subject,
    html,
    text: orderTextFor(
      order,
      order.paymentMethod === "cod"
        ? `Pay ${order.total} on delivery.`
        : "Order confirmed.",
    ),
    event: "order.confirmation",
  });
  // Dedupe only on success so a failed send stays retryable.
  if (sent) paymentEmailed.add(order.id);
  return sent;
}

/** 💳 Payment received — same branded confirmation, sent post-verification. */
export async function sendPaymentReceivedEmail(
  input: OrderEmailInput,
): Promise<boolean> {
  // Identical template and dedupe key: one confirmation per order, whichever
  // path (browser verify or gateway webhook) confirms first.
  return sendOrderConfirmationEmail(input);
}

/**
 * 🚚 Fulfilment updates — wired to the admin order-status dropdown.
 * `tracking` enriches the shipped email when known.
 */
export async function sendFulfilmentEmail(
  input: OrderEmailInput & {
    status: string;
    tracking?: { courier?: string; number?: string; url?: string };
  },
): Promise<boolean> {
  const { order, to, status } = input;
  if (!to) return false;

  let render: { subject: string; html: string };
  if (status === "dispatched") {
    render = renderShippedEmail(order, input.tracking);
  } else if (status === "completed") {
    render = renderDeliveredEmail(order);
  } else {
    render = renderOrderStatusEmail(order, status);
  }

  return resendSend({
    to,
    subject: render.subject,
    html: render.html,
    text: `${render.subject} — track: ${orderLink(order, input.orderLink)}`,
    event: `fulfilment.${status}`,
  });
}

/** 🎉 Welcome email on account creation. */
export async function sendWelcomeEmail(input: {
  to: string;
  name?: string;
}): Promise<boolean> {
  const { subject, html } = renderWelcomeEmail({ name: input.name });
  return resendSend({
    to: input.to,
    subject,
    html,
    text: `Welcome to TheTanti! Every saree is ₹199 with FREE shipping all over India. Shop: ${SITE.url}/sarees`,
    event: "welcome",
  });
}
