/**
 * Payments, offers and privacy knowledge — mirrors /terms-and-conditions,
 * /privacy-policy and lib/site.ts (PAYMENT_METHODS, price promise).
 */
import { SITE } from "@/lib/site";
import type { KnowledgeChunk } from "./types";

export const paymentsChunks: KnowledgeChunk[] = [
  {
    id: "payments-methods",
    category: "payments",
    title: "Payment methods",
    keywords: [
      "payment",
      "pay",
      "upi",
      "gpay",
      "phonepe",
      "paytm",
      "card",
      "netbanking",
      "net banking",
      "cod",
      "razorpay",
      "payment methods",
      "how to pay",
    ],
    content:
      `TheTanti accepts UPI (GPay, PhonePe, Paytm or any UPI app), credit/debit cards (Visa, Mastercard, RuPay, Amex), ` +
      `net banking from all major Indian banks, and Cash on Delivery. ` +
      `Payments are processed securely through an RBI-compliant gateway (Razorpay). ` +
      `TheTanti never sees or stores raw card numbers or UPI PINs.`,
  },
  {
    id: "payments-security",
    category: "payments",
    title: "Payment security",
    keywords: ["secure", "safe", "security", "fraud", "card details", "gateway"],
    content:
      `Payments run through authorized, RBI-compliant payment aggregators (such as Razorpay) over encrypted connections. ` +
      `Full card numbers and UPI PINs are never collected or stored on TheTanti's servers.`,
  },
  {
    id: "offers-policy",
    category: "faq",
    title: "Offers and coupons",
    keywords: [
      "offer",
      "offers",
      "coupon",
      "code",
      "promo",
      "sale",
      "discount",
      "deal",
      "cashback",
    ],
    content:
      `There are no coupon codes — every saree is already ₹${SITE.price} with free shipping across India. ` +
      `That flat price is the permanent offer; no seasonal sale can beat it.`,
  },
  {
    id: "privacy-note",
    category: "privacy",
    title: "Privacy basics",
    keywords: [
      "privacy",
      "data",
      "personal information",
      "gdpr",
      "delete my data",
      "private",
    ],
    content:
      `TheTanti collects only what is needed to deliver orders: name, address, phone, email. ` +
      `Cart and wishlist data stay in the customer's own browser. ` +
      `Personal data is never sold or rented. Customers can request export or deletion of their data anytime at ${SITE.email}. ` +
      `Full policy: /privacy-policy.`,
  },
];
