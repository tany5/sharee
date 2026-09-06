/**
 * Central site + commerce configuration.
 * Brand name, pricing promise, shipping rules and contact details all live here
 * so they can be changed in one place.
 */

export const SITE = {
  /** Working brand name — change in one place. */
  name: "TheTanti",
  legalName: "TheTanti Sarees Pvt. Ltd.",
  tagline: "All Sarees ₹199",
  promise: "Beautiful sarees. One simple price.",

  /** Single unit price for the whole catalogue (the brand promise). */
  price: 199,
  currency: "INR",

  /** Shipping rule shown in the announcement bar + cart. */
  freeShippingThreshold: 999,
  shippingFee: 49,

  announcementMain: "ALL SAREES ₹199",
  announcementSub: "FREE SHIPPING OVER ₹999",

  email: "hello@thetanti.in",
  phone: "+91 98765 43210",
  instagramHandle: "@thetantisarees",
  address: "Sireh Deori Bazaar, Jaipur, Rajasthan 302003, India",

  /** Used for canonical URLs / sitemap. Override with NEXT_PUBLIC_SITE_URL in prod. */
  get url() {
    return (
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"
    );
  },
} as const;

export const PAYMENT_METHODS = [
  {
    id: "upi",
    label: "UPI",
    blurb: "Pay instantly with GPay, PhonePe, Paytm or any UPI app.",
  },
  {
    id: "card",
    label: "Cards (Credit / Debit)",
    blurb: "Visa, Mastercard, RuPay, Amex — securely processed.",
  },
  {
    id: "netbanking",
    label: "Net Banking",
    blurb: "All major Indian banks supported.",
  },
  {
    id: "cod",
    label: "Cash on Delivery",
    blurb: "Pay in cash when your order is delivered to your doorstep.",
  },
] as const;

export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];

/** True when running against local demo data / simulated payments. */
export function isDemoMode() {
  return process.env.NEXT_PUBLIC_USE_DEMO !== "0";
}
