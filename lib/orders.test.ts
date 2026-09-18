import { describe, expect, it } from "vitest";
import { createDemoOrder, OrderError } from "@/lib/orders";
import type { DeliveryAddress } from "@/lib/types";

const VALID_ADDRESS: DeliveryAddress = {
  fullName: "Riya Sharma",
  phone: "9876543210",
  pincode: "700001",
  line1: "123, MG Road, Park Street",
  city: "Kolkata",
  state: "West Bengal",
};

describe("createDemoOrder", () => {
  it("creates an order with server-side pricing for paid methods", async () => {
    const order = await createDemoOrder({
      items: [
        { slug: "beautiful-banarasi-silk-saree", qty: 2, color: "Maroon" },
        { slug: "floral-printed-saree", qty: 1, color: "Green" },
      ],
      address: VALID_ADDRESS,
      paymentMethod: "upi",
    });

    expect(order.paymentStatus).toBe("paid");
    expect(order.subtotal).toBe(199 * 3);
    expect(order.shipping).toBe(0); // shipping is always free (₹49 fee waived)
    expect(order.total).toBe(199 * 3);
    expect(order.paymentMethod).toBe("upi");
    expect(order.number).toMatch(/^AMB-\d{6}-\d{4}$/);
    expect(order.items[0].name).toContain("Banarasi");
  });

  it("marks COD orders as cash-on-delivery", async () => {
    const order = await createDemoOrder({
      items: [{ slug: "beautiful-banarasi-silk-saree", qty: 1, color: "Maroon" }],
      address: VALID_ADDRESS,
      paymentMethod: "cod",
    });
    expect(order.paymentStatus).toBe("cod");
    expect(order.status).toBe("cod");
  });

  it("rejects unknown product slugs", async () => {
    await expect(
      createDemoOrder({
        items: [{ slug: "not-a-real-saree", qty: 1, color: "Maroon" }],
        address: VALID_ADDRESS,
        paymentMethod: "upi",
      }),
    ).rejects.toThrow(OrderError);
  });

  it("rejects invalid quantities", async () => {
    await expect(
      createDemoOrder({
        items: [{ slug: "floral-printed-saree", qty: 0, color: "Green" }],
        address: VALID_ADDRESS,
        paymentMethod: "upi",
      }),
    ).rejects.toThrow(/quantity/i);
  });

  it("rejects an empty basket", async () => {
    await expect(
      createDemoOrder({
        items: [],
        address: VALID_ADDRESS,
        paymentMethod: "upi",
      }),
    ).rejects.toThrow(/cart is empty/i);
  });

  it("rejects over-quantity vs stock", async () => {
    await expect(
      createDemoOrder({
        items: [{ slug: "floral-printed-saree", qty: 99, color: "Green" }],
        address: VALID_ADDRESS,
        paymentMethod: "upi",
      }),
    ).rejects.toThrow(OrderError);
  });

  it("returns field-level address errors", async () => {
    try {
      await createDemoOrder({
        items: [{ slug: "floral-printed-saree", qty: 1, color: "Green" }],
        address: { ...VALID_ADDRESS, phone: "123", pincode: "12" },
        paymentMethod: "upi",
      });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(OrderError);
      expect((err as OrderError).fieldErrors?.phone).toBeTruthy();
      expect((err as OrderError).fieldErrors?.pincode).toBeTruthy();
    }
  });
});
