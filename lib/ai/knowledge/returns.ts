/**
 * Returns & refunds knowledge — mirrors the published /return-policy page.
 */
import { SITE } from "@/lib/site";
import type { KnowledgeChunk } from "./types";

export const returnsChunks: KnowledgeChunk[] = [
  {
    id: "returns-window",
    category: "returns",
    title: "7-day return window",
    keywords: [
      "return",
      "returns",
      "exchange",
      "refund",
      "7 days",
      "return policy",
      "how to return",
      "send back",
    ],
    content:
      `TheTanti has a 7-day return window from the date of physical delivery. ` +
      `Reverse pickup is free across all supported pincodes in India. ` +
      `Returned sarees must be unworn, unwashed, undamaged, with the original blouse piece and price tags attached. ` +
      `Full policy: /return-policy.`,
  },
  {
    id: "returns-process",
    category: "returns",
    title: "How to return an item",
    keywords: ["return process", "pickup", "how to return", "return steps", "exchange process"],
    content:
      `To return a saree: message support on WhatsApp at ${SITE.phone} or email ${SITE.email} with the Order ID. ` +
      `The team schedules a free reverse pickup from the delivery address. ` +
      `After the package passes the quality check at the hub, the refund is executed within 3–5 working days.`,
  },
  {
    id: "returns-refund-methods",
    category: "returns",
    title: "Refund methods and timelines",
    keywords: [
      "refund",
      "money back",
      "refund time",
      "how long refund",
      "refund method",
      "refund upi",
      "refund bank account",
    ],
    content:
      `Prepaid orders are refunded to the original payment source (bank account, card, or UPI) within 3–5 working days after inspection. ` +
      `COD orders are refunded digitally to a validated UPI handle or bank account once the details are confirmed with support. ` +
      `Cancelled-before-dispatch prepaid orders are also refunded to the original method within 3–5 working days.`,
  },
  {
    id: "returns-damaged",
    category: "returns",
    title: "Damaged or faulty items",
    keywords: ["damaged", "defective", "faulty", "torn", "wrong item", "broken", "quality"],
    content:
      `If a saree arrives damaged or defective, send a photo within 48 hours of unboxing to support (WhatsApp ${SITE.phone} or ${SITE.email}). ` +
      `TheTanti issues an express free replacement or a full refund, based on the customer's preference.`,
  },
];
