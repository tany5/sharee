import { describe, expect, it } from "vitest";
import {
  COURIERS,
  COURIER_IDS,
  courierById,
  courierName,
  phoneMatches,
  toTrackedOrder,
  trackingUrlFor,
  trackingVisible,
} from "@/lib/tracking";
import type { Order, OrderTracking } from "@/lib/types";

const tracking = (over: Partial<OrderTracking> = {}): OrderTracking => ({
  courier: "delhivery",
  awb: "1234567890123",
  ...over,
});

describe("courier registry", () => {
  it("covers every courier id with a display name", () => {
    expect(COURIER_IDS).toEqual([
      "delhivery",
      "bluedart",
      "xpressbees",
      "ecom",
      "indiapost",
      "other",
    ]);
    for (const c of COURIERS) expect(c.name.length).toBeGreaterThan(0);
  });

  it("looks up couriers by id and falls back safely", () => {
    expect(courierById("bluedart")?.name).toBe("Blue Dart");
    expect(courierById("nope")).toBeUndefined();
    expect(courierName(undefined)).toBe("");
    expect(courierName("mystery")).toBe("mystery");
  });
});

describe("trackingUrlFor", () => {
  it("deep-links the known couriers", () => {
    expect(trackingUrlFor(tracking({ courier: "delhivery" }))).toBe(
      "https://www.delhivery.com/track/1234567890123",
    );
    expect(trackingUrlFor(tracking({ courier: "bluedart" }))).toBe(
      "https://www.bluedart.com/Track/GetDetails?nos=1234567890123&mode=0",
    );
    expect(trackingUrlFor(tracking({ courier: "ecom" }))).toBe(
      "https://www.ecomexpress.in/ows/track?awb=1234567890123",
    );
    expect(
      trackingUrlFor(tracking({ courier: "indiapost", awb: "EW123456789IN" })),
    ).toBe(
      "https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?cn=EW123456789IN",
    );
  });

  it("returns null for couriers without a reliable deep link", () => {
    expect(trackingUrlFor(tracking({ courier: "xpressbees" }))).toBeNull();
    expect(trackingUrlFor(tracking({ courier: "other" }))).toBeNull();
  });

  it("prefers the admin-saved explicit URL", () => {
    expect(
      trackingUrlFor(
        tracking({ courier: "delhivery", url: "https://example.com/t/xyz" }),
      ),
    ).toBe("https://example.com/t/xyz");
  });

  it("ignores non-http explicit URLs and needs an AWB", () => {
    expect(trackingUrlFor(tracking({ url: "javascript:alert(1)" }))).toBe(
      "https://www.delhivery.com/track/1234567890123",
    );
    expect(trackingUrlFor(tracking({ awb: undefined }))).toBeNull();
    expect(trackingUrlFor(undefined)).toBeNull();
  });
});

describe("phoneMatches", () => {
  const base = (phone: string): Pick<Order, "address" | "whatsapp"> => ({
    address: { fullName: "", phone, pincode: "", line1: "", city: "", state: "" },
  });

  it("accepts with or without +91 / 91 / 0 prefixes and spacing", () => {
    const order = base("+91 98765 43210");
    expect(phoneMatches(order, "9876543210")).toBe(true);
    expect(phoneMatches(order, "+919876543210")).toBe(true);
    expect(phoneMatches(order, "09876543210")).toBe(true);
    expect(phoneMatches(order, "91-98765-43210")).toBe(true);
  });

  it("checks the WhatsApp number when the order carries one", () => {
    const order = {
      address: base("9000000000").address,
      whatsapp: "9876543210",
    };
    expect(phoneMatches(order, "9876543210")).toBe(true);
    expect(phoneMatches(order, "9000000000")).toBe(false);
  });

  it("rejects wrong numbers and empty expectations", () => {
    const order = base("9876543210");
    expect(phoneMatches(order, "1234567890")).toBe(false);
    expect(phoneMatches(order, "98765432")).toBe(false);
    expect(phoneMatches({ address: { fullName: "", phone: "", pincode: "", line1: "", city: "", state: "" } }, "")).toBe(false);
  });
});

describe("trackingVisible", () => {
  it("shows tracking only once dispatched/completed or an AWB exists", () => {
    expect(trackingVisible({ fulfilment: "pending" })).toBe(false);
    expect(trackingVisible({ fulfilment: "cancelled" })).toBe(false);
    expect(trackingVisible({ fulfilment: "dispatched" })).toBe(true);
    expect(trackingVisible({ fulfilment: "completed" })).toBe(true);
    expect(trackingVisible({ fulfilment: "pending" })).toBe(false);
    // An admin-entered AWB on a not-yet-dispatched order is still shown.
    expect(
      trackingVisible({ fulfilment: "pending", tracking: tracking() }),
    ).toBe(true);
  });
});

describe("toTrackedOrder", () => {
  it("projects the customer-safe shape (no email, no utm, no ids)", () => {
    const order = {
      id: "ord_x",
      number: "AMB-260914-0042",
      items: [{ slug: "s", name: "Saree", qty: 2, price: 199, color: "Maroon", cost: 90 }],
      subtotal: 398,
      shipping: 0,
      total: 398,
      paymentMethod: "cod",
      paymentStatus: "cod",
      status: "cod",
      address: {
        fullName: "Riya",
        phone: "9876543210",
        pincode: "700001",
        line1: "1 Road",
        city: "Kolkata",
        state: "WB",
      },
      utm: { source: "ig" },
      storedIn: "local",
      createdAt: "2026-09-14T10:00:00.000Z",
      estimatedDelivery: "2026-09-18T10:00:00.000Z",
      fulfilment: "dispatched",
      userEmail: "riya@example.com",
      tracking: tracking({ courier: "bluedart" }),
    } as unknown as Order;

    const view = toTrackedOrder(order);
    expect(view).toEqual({
      number: "AMB-260914-0042",
      createdAt: "2026-09-14T10:00:00.000Z",
      estimatedDelivery: "2026-09-18T10:00:00.000Z",
      paymentStatus: "cod",
      paymentMethod: "cod",
      fulfilment: "dispatched",
      tracking: {
        courier: "bluedart",
        awb: "1234567890123",
        url: "https://www.bluedart.com/Track/GetDetails?nos=1234567890123&mode=0",
      },
      items: [{ name: "Saree", qty: 2, price: 199, color: "Maroon" }],
      subtotal: 398,
      shipping: 0,
      total: 398,
      address: order.address,
    });
    // Email must never ride along to the client.
    expect(JSON.stringify(view)).not.toContain("riya@example.com");
  });
});
