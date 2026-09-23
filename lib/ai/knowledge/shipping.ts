/**
 * Shipping knowledge — mirrors the published /shipping-policy page and the
 * live store rules in lib/site.ts + lib/cart.ts (shipping is always free).
 */
import { SITE } from "@/lib/site";
import type { KnowledgeChunk } from "./types";

export const shippingChunks: KnowledgeChunk[] = [
  {
    id: "shipping-charges",
    category: "shipping",
    title: "Shipping charges",
    keywords: [
      "shipping",
      "delivery charge",
      "shipping cost",
      "shipping fee",
      "courier",
      "free shipping",
      "how much to ship",
      "49",
      "charge",
    ],
    content:
      `Shipping is FREE on every TheTanti order — no minimum order value, across all of India. ` +
      `The standard ₹${SITE.shippingFee} courier fee is fully waived by TheTanti. ` +
      `Cash on Delivery is available for valid serviceable pincodes at no extra processing fee.`,
  },
  {
    id: "shipping-timelines",
    category: "shipping",
    title: "Delivery timelines",
    keywords: [
      "delivery time",
      "how long",
      "days",
      "when will",
      "arrive",
      "dispatch",
      "fast",
      "delivery",
      "shipping time",
    ],
    content:
      `Orders placed before 1:00 PM IST on working days (Monday–Saturday) are usually dispatched the same day from the Howrah hub. ` +
      `Standard delivery takes 3–5 working days across India, and 2–4 business days in metro cities. ` +
      `Orders placed on Sundays or holidays are processed the next working day. ` +
      `Exact delivery dates are shown on the order confirmation — the assistant never guesses them.`,
  },
  {
    id: "shipping-tracking",
    category: "orders",
    title: "Order tracking",
    keywords: [
      "track",
      "tracking",
      "awb",
      "courier",
      "where is my order",
      "order status",
      "status",
      "shipment",
    ],
    content:
      `When an order is dispatched, the customer gets an email and WhatsApp update with the courier name and AWB tracking number. ` +
      `Orders can be tracked anytime at /track using the order number and the phone number used at checkout. ` +
      `Signed-in customers also see live status under My Account → My Orders.`,
  },
  {
    id: "shipping-cod",
    category: "payments",
    title: "Cash on Delivery",
    keywords: ["cod", "cash on delivery", "pay on delivery", "cash", "doorstep"],
    content:
      `Cash on Delivery (COD) is available for valid serviceable pincodes at no extra fee. ` +
      `Pay in cash when the saree is delivered to the doorstep. COD refunds are sent digitally to a UPI handle or bank account after the return is processed.`,
  },
];
