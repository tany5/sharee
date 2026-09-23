/**
 * Courier tracking helpers — pure logic, unit-tested, framework-free.
 *
 * The store books pickups on the courier's own portal and the admin enters the
 * AWB in the order panel. Customers deep-link to the courier's free public
 * tracking page from /track — no paid courier API anywhere.
 */
import type { DeliveryAddress, Order, OrderTracking } from "@/lib/types";

/* ------------------------------ couriers --------------------------------- */

export interface Courier {
  /** Stable id stored on the order (`order.tracking.courier`). */
  id: string;
  /** Display name. */
  name: string;
  /** Deep link, or null when the courier has no reliable per-AWB URL. */
  url: (awb: string) => string | null;
}

/**
 * Couriers the store ships with. Deep links point at each courier's public
 * tracking page with the AWB prefilled — patterns verified 2026-09:
 *   Delhivery     /track/{awb}
 *   Blue Dart     Track/GetDetails?nos={awb}   (official per-AWB endpoint)
 *   Xpressbees    /shipment/tracking (no stable deep link → page + copyable AWB)
 *   Ecom Express  /ows/track {awb}             (per-AWB param on their page)
 *   India Post    consignment search {awb}
 * "other" has no URL — /track shows the AWB copyable instead.
 */
export const COURIERS: Courier[] = [
  {
    id: "delhivery",
    name: "Delhivery",
    url: (awb) => `https://www.delhivery.com/track/${encodeURIComponent(awb)}`,
  },
  {
    id: "bluedart",
    name: "Blue Dart",
    url: (awb) =>
      `https://www.bluedart.com/Track/GetDetails?nos=${encodeURIComponent(awb)}&mode=0`,
  },
  {
    id: "xpressbees",
    name: "Xpressbees",
    url: () => null,
  },
  {
    id: "ecom",
    name: "Ecom Express",
    url: (awb) => `https://www.ecomexpress.in/ows/track?awb=${encodeURIComponent(awb)}`,
  },
  {
    id: "indiapost",
    name: "India Post",
    url: (awb) => `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?cn=${encodeURIComponent(awb)}`,
  },
  {
    id: "other",
    name: "Other courier",
    url: () => null,
  },
];

/** All courier ids valid for `order.tracking.courier`. */
export const COURIER_IDS = COURIERS.map((c) => c.id);

export function courierById(id: string | undefined): Courier | undefined {
  if (!id) return undefined;
  return COURIERS.find((c) => c.id === id);
}

export function courierName(id: string | undefined): string {
  return courierById(id)?.name ?? id ?? "";
}

/**
 * Best public tracking URL for an order: the saved explicit URL wins (admin
 * may paste a custom one), otherwise derive from courier + AWB. Returns null
 * when the courier has no reliable deep link — the UI then shows the AWB
 * copyable instead of a possibly-wrong link.
 */
export function trackingUrlFor(tracking: OrderTracking | undefined): string | null {
  if (!tracking) return null;
  const explicit = tracking.url?.trim();
  if (explicit && /^https?:\/\//i.test(explicit)) return explicit;
  const awb = tracking.awb?.trim();
  if (!awb) return null;
  const courier = courierById(tracking.courier);
  return courier?.url(awb) ?? null;
}

/* -------------------------- phone verification --------------------------- */

/** Digits only, keeping the trailing 10 (Indian mobiles). */
function phoneDigits(phone: string | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * Verify the customer knows the phone number the order was placed with.
 * Accepts with/without the +91/91/0 prefix and ignores spacing — the checkout
 * stores whatever the customer typed, so this must be forgiving on format but
 * exact on the last 10 digits.
 */
export function phoneMatches(
  order: Pick<Order, "address" | "whatsapp">,
  input: string,
): boolean {
  const expected = phoneDigits(order.whatsapp || order.address?.phone);
  const actual = phoneDigits(input);
  return expected.length > 0 && actual === expected;
}

/* --------------------------- customer payload ---------------------------- */

/**
 * Minimal, customer-safe order summary returned by the /track API after the
 * order number + phone check. Deliberately excludes contact details, UTM,
 * cost snapshots and internal ids — the phone check is the auth.
 */
export interface TrackedOrder {
  number: string;
  createdAt: string;
  estimatedDelivery: string;
  paymentStatus: Order["paymentStatus"];
  paymentMethod: Order["paymentMethod"];
  fulfilment: FulfilmentStatusAlias;
  tracking: { courier?: string; awb?: string; url?: string | null } | null;
  items: { name: string; qty: number; price: number; color: string }[];
  subtotal: number;
  shipping: number;
  total: number;
  address: DeliveryAddress;
}

/** Local alias so this module stays framework-free without importing order types. */
type FulfilmentStatusAlias = Order["fulfilment"];

export function toTrackedOrder(order: Order): TrackedOrder {
  return {
    number: order.number,
    createdAt: order.createdAt,
    estimatedDelivery: order.estimatedDelivery,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    fulfilment: order.fulfilment ?? "pending",
    tracking: order.tracking
      ? {
          courier: order.tracking.courier,
          awb: order.tracking.awb,
          url: trackingUrlFor(order.tracking),
        }
      : null,
    items: order.items.map((i) => ({
      name: i.name,
      qty: i.qty,
      price: i.price,
      color: i.color,
    })),
    subtotal: order.subtotal,
    shipping: order.shipping,
    total: order.total,
    address: order.address,
  };
}

/** True when the order is far enough along to show a courier + AWB. */
export function trackingVisible(
  order: Pick<Order, "fulfilment" | "tracking">,
): boolean {
  return (
    order.fulfilment === "dispatched" ||
    order.fulfilment === "completed" ||
    Boolean(order.tracking?.awb)
  );
}
