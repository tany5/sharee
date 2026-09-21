/**
 * Central site + commerce configuration.
 * Brand name, pricing promise, shipping rules and contact details all live here
 * so they can be changed in one place.
 */

export const SITE = {
  /** Working brand name — change in one place. */
  name: "TheTanti",
  legalName: "THETANTI",
  tagline: "All Sarees ₹199",
  /** Editorial brand line — hero headline, footer and campaign copy. */
  motto: "Sarees for everyday life.",
  /** Supporting line shown under the hero headline. */
  supporting:
    "Beautiful styles, simple prices. Discover sarees made for everyday moments.",
  promise: "Beautiful sarees. One simple price.",

  /** Single unit price for the whole catalogue (the brand promise). */
  price: 199,
  currency: "INR",

  /**
   * Shipping: always FREE. The ₹49 courier fee is waived on every order —
   * shown struck-through in the cart/checkout so customers see the value
   * they're getting. There is no minimum-order threshold.
   */
  shippingFee: 49,

  announcementMain: "ALL SAREES ₹199",
  announcementSub: "FREE SHIPPING ALL OVER INDIA",

  email: "info@thetanti.com",
  phone: "+91 90381 27527",
  instagramHandle: "@theta.nti",
  instagramUrl: "https://www.instagram.com/theta.nti/",
  facebookUrl: "https://www.facebook.com/profile.php?id=61593967300734",
  address: "Chakpara Dagabagan, Liluah, Howrah 711204, West Bengal, India",

  /** Used for canonical URLs / sitemap. Override with NEXT_PUBLIC_SITE_URL in prod. */
  get url() {
    // Production on Vercel always uses the real storefront domain. A stray
    // NEXT_PUBLIC_SITE_URL (e.g. the *.vercel.app host) used to leak into
    // canonical tags, OG urls and the sitemap — never let it win in prod.
    if (process.env.VERCEL_ENV === "production") return "https://www.thetanti.shop";
    // Preview deploys keep their own throwaway origin.
    if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (configured && !/\.vercel\.app(\/|$)/i.test(configured)) return configured;
    return "https://www.thetanti.shop";
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
