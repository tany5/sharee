/**
 * Branded transactional email templates (TheTanti).
 *
 * Source: vendor-supplied HTML in `lib/email-templates/*.html` — responsive,
 * table-based, no JS/external fonts, with a mobile media query. The logo is
 * served from /public (absolute HTTPS URL) instead of a data URI because
 * several email clients block data-URI images.
 *
 * Placeholders use {{mustache}} style and are substituted with plain string
 * replacement (values are HTML-escaped). Unknown statuses fall back to the
 * generic 03-order-status template.
 *
 * Exports:
 *   renderWelcomeEmail({ name })
 *   renderOrderConfirmationEmail(order)   — single + multi-item orders
 *   renderOrderStatusEmail(order, status) — dispatched/completed/cancelled
 *   renderShippedEmail(order, { courier, trackingNumber, trackingUrl })
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SITE } from "@/lib/site";
import type { Order } from "@/lib/types";

/* ------------------------------ loading ---------------------------------- */

type TemplateName =
  | "welcome"
  | "order-confirmation"
  | "order-status"
  | "shipped"
  | "delivered";

const FILES: Record<TemplateName, string> = {
  welcome: "01-welcome.html",
  "order-confirmation": "02-order-confirmation.html",
  "order-status": "03-order-status.html",
  shipped: "04-shipped.html",
  delivered: "05-delivered.html",
};

const cache = new Map<TemplateName, string>();

function template(name: TemplateName): string {
  let html = cache.get(name);
  if (!html) {
    html = readFileSync(
      join(process.cwd(), "lib", "email-templates", FILES[name]),
      "utf8",
    );
    cache.set(name, html);
  }
  return html;
}

/* ---------------------------- substitution -------------------------------- */

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

function fill(tpl: string, values: Record<string, string>): string {
  return tpl.replace(/\{\{([a-z_]+)\}\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key)
      ? values[key]
      : whole,
  );
}

function money(amount: number): string {
  return Math.round(amount).toLocaleString("en-IN");
}

function dateLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function firstName(order: Order): string {
  return order.address.fullName.split(" ")[0] || "there";
}

function orderUrl(order: Order): string {
  return `${SITE.url}/order-success?order=${encodeURIComponent(order.id)}`;
}

/** Multi-item order rows replace the template's single {{item_name}} row. */
function itemRows(order: Order): string {
  return order.items
    .map(
      (it) =>
        `<tr><td class="text">${escapeHtml(it.name)}${it.color ? ` — ${escapeHtml(it.color)}` : ""} × ${it.qty}</td>` +
        `<td align="right" class="value">₹${money(it.price * it.qty)}</td></tr>` +
        `<tr><td colspan="2" style="border-bottom:1px solid #eee;height:14px;"></td></tr>`,
    )
    .join("");
}

const SHIPPING_HTML =
  `<tr><td class="text">Shipping</td>` +
  `<td align="right" class="value"><s style="color:#8a7c84;font-weight:400;">₹${money(SITE.shippingFee)}</s> ` +
  `<span style="color:#4c7a4f;">FREE</span></td></tr>` +
  `<tr><td colspan="2" style="border-bottom:1px solid #eee;height:14px;"></td></tr>`;

const SUBJECTS = {
  welcome: () => `${SITE.name} · 🎉 Welcome to TheTanti — all sarees ₹199, shipping free`,
  confirmation: (o: Order) =>
    o.paymentMethod === "cod"
      ? `${SITE.name} · 🥻 Order #${o.number} received — pay on delivery`
      : `${SITE.name} · 🥻 Order #${o.number} confirmed!`,
  status: (o: Order, title: string) => `${SITE.name} · Order #${o.number} · ${title}`,
  shipped: (o: Order) => `${SITE.name} · 🚚 Order #${o.number} is on the way!`,
  delivered: (o: Order) => `${SITE.name} · ❤️ Order #${o.number} delivered — enjoy!`,
};

/* ------------------------------- renders --------------------------------- */

export function renderWelcomeEmail(input: { name?: string }): {
  subject: string;
  html: string;
} {
  const html = fill(template("welcome"), {
    customer_name: escapeHtml((input.name ?? "").split(" ")[0] || "there"),
  });
  return { subject: SUBJECTS.welcome(), html };
}

/**
 * Swap the template's single-item row + separator for {{item_rows}} and
 * {{shipping_row}} placeholders (multi-line HTML substituted by `fill`).
 */
function prepareOrderConfirmation(tpl: string): string {
  return tpl.replace(
    /<tr>\s*<td class="text">\{\{item_name\}\}[^<]*× \{\{quantity\}\}<\/td>\s*<td align="right" class="value">₹\{\{item_total\}\}<\/td>\s*<\/tr>\s*<tr><td colspan="2" style="border-bottom:1px solid #eee;height:14px;"><\/td><\/tr>/,
    "{{item_rows}}\n{{shipping_row}}",
  );
}

export function renderOrderConfirmationEmail(order: Order): {
  subject: string;
  html: string;
} {
  const html = fill(prepareOrderConfirmation(template("order-confirmation")), {
    customer_name: escapeHtml(firstName(order)),
    order_number: order.number,
    order_date: dateLabel(order.createdAt),
    item_rows: itemRows(order),
    shipping_row: SHIPPING_HTML,
    order_total: money(order.total),
    order_url: orderUrl(order),
  });
  return { subject: SUBJECTS.confirmation(order), html };
}

export function renderOrderStatusEmail(
  order: Order,
  status: "dispatched" | "completed" | "cancelled" | string,
): { subject: string; html: string } {
  const copy: Record<string, { title: string; label: string; message: string }> = {
    dispatched: {
      title: "Your order is on the way!",
      label: "Dispatched",
      message:
        "Your order has left our Howrah hub. Tracking details will arrive by WhatsApp/SMS.",
    },
    completed: {
      title: "Delivered — enjoy your saree!",
      label: "Delivered",
      message:
        "Your order has been delivered. We hope you love it! Come back soon — every saree is still just ₹199 with FREE shipping.",
    },
    cancelled: {
      title: "Your order has been cancelled",
      label: "Cancelled",
      message:
        "If you paid online, your refund is initiated and typically arrives in 5–7 working days.",
    },
  };
  const c = copy[status] ?? {
    title: "Order update",
    label: status.charAt(0).toUpperCase() + status.slice(1),
    message: "The status of your order has been updated.",
  };
  const html = fill(template("order-status"), {
    customer_name: escapeHtml(firstName(order)),
    order_number: order.number,
    order_status: c.label,
    status_title: c.title,
    status_message: c.message,
    order_url: orderUrl(order),
  });
  return { subject: SUBJECTS.status(order, c.title), html };
}

export function renderShippedEmail(
  order: Order,
  tracking?: { courier?: string; number?: string; url?: string },
): { subject: string; html: string } {
  const html = fill(template("shipped"), {
    customer_name: escapeHtml(firstName(order)),
    order_number: order.number,
    courier_name: escapeHtml(tracking?.courier ?? "our courier partner"),
    tracking_number: escapeHtml(tracking?.number ?? "—"),
    tracking_url: tracking?.url ?? orderUrl(order),
    order_url: orderUrl(order),
  });
  return { subject: SUBJECTS.shipped(order), html };
}

export function renderDeliveredEmail(order: Order): {
  subject: string;
  html: string;
} {
  const html = fill(template("delivered"), {
    customer_name: escapeHtml(firstName(order)),
    order_number: order.number,
    order_url: orderUrl(order),
  });
  return { subject: SUBJECTS.delivered(order), html };
}

/** Plain-text fallback for the order emails. */
export function orderTextFor(order: Order, note?: string): string {
  const lines = [
    `Order ${order.number} from TheTanti`,
    ...order.items.map(
      (it) =>
        `- ${it.name}${it.color ? ` (${it.color})` : ""} × ${it.qty} = ₹${money(it.price * it.qty)}`,
    ),
    `Shipping: FREE (₹${SITE.shippingFee} fee waived)`,
    `Total: ₹${money(order.total)}`,
    note ?? "",
    `Track: ${orderUrl(order)}`,
  ];
  return lines.filter(Boolean).join("\n");
}
