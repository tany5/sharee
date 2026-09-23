/**
 * Business / seller-enquiry knowledge — for the questions a real storefront
 * gets ("I want to become a seller", bulk orders, collaborations).
 *
 * TheTanti is a single-brand store that sources directly from weavers; it
 * does not host third-party sellers. These chunks state that honestly.
 */
import { SITE } from "@/lib/site";
import type { KnowledgeChunk } from "./types";

export const sellerChunks: KnowledgeChunk[] = [
  {
    id: "seller-enquiry",
    category: "faq",
    title: "Selling with or to TheTanti",
    keywords: [
      "become a seller",
      "sell on thetanti",
      "seller",
      "vendor",
      "partner",
      "supplier",
      "collaboration",
      "collab",
      "reseller",
      "wholesale",
      "bulk order",
      "bulk",
      "dropship",
      "business enquiry",
    ],
    content:
      `TheTanti is a single-brand store — we design and source our own sarees directly from weavers, ` +
      `so we don't host third-party sellers on the website. ` +
      `For bulk orders, wholesale quantities, or supplier/collaboration proposals, email ${SITE.email} ` +
      `or WhatsApp ${SITE.phone} with your details and the team will reply within 24 working hours. ` +
      `For shopping, every saree is ₹199 with free shipping across India.`,
  },
  {
    id: "seller-shopping-guidance",
    category: "faq",
    title: "Buying in bulk as a customer",
    keywords: [
      "many sarees",
      "more than one",
      "multiple",
      "gift",
      "gifting",
      "wedding shopping",
      "family",
    ],
    content:
      `There is no minimum order — order one saree or many. Each item is capped at 5 pieces per order line ` +
      `to keep stock fair for everyone; for larger quantities email ${SITE.email}. ` +
      `Every saree ships free, so gifting a set costs nothing extra in delivery.`,
  },
];
