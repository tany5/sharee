/**
 * Analytics event bus. Fires events to whichever trackers are loaded:
 *  - Meta Pixel (window.fbq) — browser-side events + campaign attribution
 *  - GA4 (window.gtag / dataLayer)
 *
 * Trackers are only injected when NEXT_PUBLIC_META_PIXEL_ID / NEXT_PUBLIC_GA4_ID
 * are configured (see components/analytics/analytics-scripts.tsx), so dev builds
 * are silent. Debug output can be enabled with NEXT_PUBLIC_ANALYTICS_DEBUG=1.
 *
 * IMPORTANT: Purchase is fired ONLY after payment verification (order-success
 * page) — never on the "Place order" click.
 */

export type AnalyticsEvent =
  | "PageView"
  | "ViewContent"
  | "Search"
  | "AddToCart"
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "Purchase";

/** Meta's event names match ours 1:1 for this funnel. */
const META_EVENT: Record<AnalyticsEvent, string> = {
  PageView: "PageView",
  ViewContent: "ViewContent",
  Search: "Search",
  AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout",
  AddPaymentInfo: "AddPaymentInfo",
  Purchase: "Purchase",
};

/**
 * GA4 canonical ecommerce event names — using these (instead of Meta's names)
 * turns on GA4's built-in Monetization reports (item views, cart abandonment,
 * product purchase counts) without any extra configuration.
 */
const GA_EVENT: Record<AnalyticsEvent, string> = {
  PageView: "page_view",
  ViewContent: "view_item",
  Search: "search",
  AddToCart: "add_to_cart",
  InitiateCheckout: "begin_checkout",
  AddPaymentInfo: "add_payment_info",
  Purchase: "purchase",
};

/** GA4 `items` entry — powers per-product ecommerce reports. */
export interface EcommerceItem {
  item_id: string;
  item_name: string;
  price?: number;
  quantity?: number;
}

function toGaItems(items?: EcommerceItem[], contentIds?: string[]): EcommerceItem[] | undefined {
  if (items && items.length > 0) return items;
  if (!contentIds) return undefined;
  return contentIds.map((id) => ({ item_id: id, item_name: id }));
}

interface TrackParams {
  /** Product slugs / item ids relevant to the event. */
  content_ids?: string[];
  content_type?: "product" | "product_group";
  search_string?: string;
  /** Monetary value (INR). */
  value?: number;
  currency?: string;
  transaction_id?: string;
  content_name?: string;
  num_items?: number;
  /** Rich item detail — forwarded to GA4 only (Meta has no items array). */
  items?: EcommerceItem[];
  [key: string]: unknown;
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
  }
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function track(
  event: AnalyticsEvent,
  params: TrackParams = {},
): void {
  if (!isBrowser()) return;
  const payload: TrackParams = { currency: "INR", ...params };

  try {
    window.fbq?.("track", META_EVENT[event], payload);
    window.gtag?.("event", GA_EVENT[event], {
      ...payload,
      currency: "INR",
      items: toGaItems(payload.items, payload.content_ids),
    });
  } catch {
    /* never let analytics break the store */
  }

  if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "1") {
    console.debug(`[analytics] ${event}`, payload);
  }
}

export function trackPageView(): void {
  track("PageView");
}

export function trackViewContent(slug: string, name: string): void {
  track("ViewContent", {
    content_ids: [slug],
    content_type: "product",
    content_name: name,
  });
}

export function trackSearch(term: string): void {
  if (!term.trim()) return;
  track("Search", { search_string: term.slice(0, 200) });
}

export function trackAddToCart(slug: string, name: string, qty = 1, price?: number): void {
  track("AddToCart", {
    content_ids: [slug],
    content_type: "product",
    content_name: name,
    value: qty, // placeholder value; real basket value tracked at checkout
    num_items: qty,
    items: [{ item_id: slug, item_name: name, price, quantity: qty }],
  });
}

/** Meta has no standard remove event — GA4-only, still useful for cart analytics. */
export function trackRemoveFromCart(slug: string, name: string, qty = 1): void {
  if (!isBrowser()) return;
  try {
    window.gtag?.("event", "remove_from_cart", {
      currency: "INR",
      items: [{ item_id: slug, item_name: name, quantity: qty }],
    });
  } catch {
    /* never let analytics break the store */
  }
  if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "1") {
    console.debug("[analytics] RemoveFromCart", { slug, qty });
  }
}

export function trackInitiateCheckout(
  contentIds: string[],
  value: number,
  items?: EcommerceItem[],
): void {
  track("InitiateCheckout", {
    content_ids: contentIds,
    content_type: "product_group",
    value,
    num_items: contentIds.length,
    items,
  });
}

export function trackAddPaymentInfo(method: string): void {
  track("AddPaymentInfo", { content_type: "product_group", method });
}

export function trackPurchase(order: {
  transactionId: string;
  value: number;
  contentIds: string[];
  items?: EcommerceItem[];
}): void {
  track("Purchase", {
    transaction_id: order.transactionId,
    value: order.value,
    currency: "INR",
    content_ids: order.contentIds,
    content_type: "product_group",
    items: order.items,
  });
}
