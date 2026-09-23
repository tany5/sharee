/**
 * FAQ knowledge — high-frequency shopping questions, all backed by real
 * store rules (lib/site.ts, lib/cart.ts, policy pages).
 */
import { SITE } from "@/lib/site";
import type { KnowledgeChunk } from "./types";

export const faqChunks: KnowledgeChunk[] = [
  {
    id: "faq-size-guide",
    category: "faq",
    title: "Saree size and blouse piece",
    keywords: [
      "size",
      "sizes",
      "length",
      "blouse",
      "blouse piece",
      "fit",
      "fall",
      "petticoat",
      "measurement",
    ],
    content:
      `Every TheTanti saree is a standard 5.5m+ drape with an unstitched blouse piece included, ` +
      `so one size fits all — no size selection is needed at checkout. ` +
      `Each product page lists the exact fabric, care details and what's included in the box.`,
  },
  {
    id: "faq-cart",
    category: "faq",
    title: "Cart and checkout",
    keywords: [
      "cart",
      "add to cart",
      "checkout",
      "basket",
      "buy",
      "order steps",
      "how to order",
      "purchase",
    ],
    content:
      `To order: open a saree, choose the color, tap Add to Cart, then go to /cart and continue to checkout. ` +
      `Enter the delivery address, pick a payment method (UPI, card, net banking or COD) and place the order. ` +
      `The cart stays saved on the device, so items are still there on the next visit.`,
  },
  {
    id: "faq-account",
    category: "faq",
    title: "Account and order history",
    keywords: [
      "account",
      "login",
      "sign in",
      "register",
      "password",
      "order history",
      "my orders",
      "guest",
    ],
    content:
      `Accounts are optional — guest checkout works without one. ` +
      `Signed-in customers see their full order history under My Account → My Orders at /account. ` +
      `Orders placed as a guest can be tracked anytime at /track with the order number and the phone used at checkout.`,
  },
  {
    id: "faq-fabric-care",
    category: "faq",
    title: "Fabric and care",
    keywords: ["wash", "care", "fabric", "material", "maintain", "iron", "dry clean"],
    content:
      `Each product page lists the fabric and care guidance — cottons are easy machine-wash daily weaves, ` +
      `silks and zari sarees are best dry-cleaned. When in doubt, the product page under /sarees is the source of truth.`,
  },
  {
    id: "faq-quality",
    category: "faq",
    title: "Quality assurance",
    keywords: ["quality", "check", "inspect", "authentic", "original", "trust"],
    content:
      `Every saree is inspected for fabric, fall and finishing at the Howrah fulfilment centre before it ships. ` +
      `TheTanti works directly with weavers and textile hubs across India — no middlemen.`,
  },
  {
    id: "faq-color-accuracy",
    category: "faq",
    title: "Colour accuracy",
    keywords: [
      "color",
      "colour",
      "same as photo",
      "look different",
      "exact shade",
      "camera",
      "picture",
    ],
    content:
      `TheTanti strives for absolute colour accuracy, but minor differences between studio photography and the physical textile are typical ` +
      `due to digital display variants and natural weave characteristics. ` +
      `If a saree truly isn't what you expected, the 7-day return window with free pickup covers you.`,
  },
  {
    id: "faq-legal",
    category: "faq",
    title: "Business and legal details",
    keywords: [
      "terms",
      "legal",
      "gst",
      "invoice",
      "registered",
      "company details",
      "governing law",
      "jurisdiction",
    ],
    content:
      `TheTanti (website ${SITE.url}) is operated as an independent sole proprietorship under Indian jurisdiction, ` +
      `registered office at ${SITE.address}. Invoices are available for every order (printable from the tracking page). ` +
      `Terms: /terms-and-conditions — disputes are subject to the courts of Howrah, West Bengal.`,
  },
];
