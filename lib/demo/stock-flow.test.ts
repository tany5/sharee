/**
 * Integration test: stock decrement / restock / tracking / phone-gated lookup
 * against the file-backed demo DB.
 *
 * The demo DB has no test override, so this suite SNAPSHOT-RESTORES
 * .demo-data/db.json around itself (byte-exact in afterAll) and must run in
 * isolation (vitest run lib/demo/stock-flow.test.ts) — never in the same
 * worker pool as suites that write demo data concurrently.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {
  addOrder,
  findOrderForTracking,
  orderProductBySlug,
  setOrderFulfilment,
  setOrderTracking,
  upsertProduct,
} from "@/lib/demo/db";
import { createDemoOrder } from "@/lib/orders";
import { COURIER_IDS, toTrackedOrder, trackingUrlFor } from "@/lib/tracking";
import type { Order } from "@/lib/types";

const DB_PATH = ".demo-data/db.json";
const BAK_PATH = ".demo-data/db.stock-flow.bak";

let hadDb = false;
let dbBytes: Buffer | null = null;

beforeAll(() => {
  hadDb = existsSync(DB_PATH);
  if (hadDb) {
    dbBytes = readFileSync(DB_PATH);
    copyFileSync(DB_PATH, BAK_PATH);
  } else {
    mkdirSync(".demo-data", { recursive: true });
  }
});

afterAll(() => {
  if (hadDb && dbBytes) {
    writeFileSync(DB_PATH, dbBytes);
  } else {
    rmSync(DB_PATH, { force: true });
  }
  rmSync(BAK_PATH, { force: true });
});

const ADDRESS = {
  fullName: "Stock Flow",
  phone: "9876543210",
  pincode: "700001",
  line1: "1 Test Road",
  city: "Kolkata",
  state: "West Bengal",
};

const SLUG = "floral-printed-saree";

async function placeOrder(qty: number, overrides?: Partial<Order>): Promise<Order> {
  const order = await createDemoOrder({
    items: [{ slug: SLUG, qty, color: "Green" }],
    address: ADDRESS,
    paymentMethod: "cod",
  });
  const merged = { ...order, ...overrides } as Order;
  return addOrder(merged);
}

describe("demo stock flow", () => {
  it("decrements stock when an order is created", async () => {
    const before = orderProductBySlug(SLUG)!.stock;
    const order = await placeOrder(2);
    const after = orderProductBySlug(SLUG)!.stock;
    expect(after).toBe(before - 2);
    expect(order.fulfilment).toBe("pending");
  });

  it("refuses an order bigger than remaining stock", async () => {
    // Lower the stock first — qty is also capped by MAX_QTY_PER_ITEM (5),
    // so ordering more than 5 would fail on quantity, not stock.
    const original = orderProductBySlug(SLUG)!.stock;
    await upsertProduct({ slug: SLUG, stock: 3 });
    try {
      await expect(placeOrder(4)).rejects.toThrow(/left|stock/i);
    } finally {
      await upsertProduct({ slug: SLUG, stock: original });
    }
  });

  it("restores stock exactly once when an order is cancelled", async () => {
    const before = orderProductBySlug(SLUG)!.stock;
    const order = await placeOrder(1);
    expect(orderProductBySlug(SLUG)!.stock).toBe(before - 1);

    await setOrderFulfilment(order.id, "cancelled");
    expect(orderProductBySlug(SLUG)!.stock).toBe(before);

    // Repeating the cancel must not double-restock.
    await setOrderFulfilment(order.id, "cancelled");
    expect(orderProductBySlug(SLUG)!.stock).toBe(before);
  });

  it("saves and surfaces tracking details", async () => {
    const order = await placeOrder(1);
    expect(COURIER_IDS.length).toBeGreaterThan(0);
    const updated = await setOrderTracking(order.id, {
      courier: "delhivery",
      awb: "TESTAWB123456",
    });
    expect(updated.tracking?.courier).toBe("delhivery");
    expect(updated.tracking?.awb).toBe("TESTAWB123456");
    expect(updated.tracking?.updatedAt).toBeTruthy();
  });

  it("phone-gates the tracking lookup", async () => {
    const order = await placeOrder(1);
    await setOrderTracking(order.id, { courier: "delhivery", awb: "AWB777" });

    const hit = findOrderForTracking(order.number, "+91 98765 43210");
    expect(hit).toBeTruthy();

    const wrong = findOrderForTracking(order.number, "9000000000");
    expect(wrong).toBeUndefined();

    const missing = findOrderForTracking("AMB-000000-0000", "9876543210");
    expect(missing).toBeUndefined();
  });

  it("projects a customer-safe tracked order", async () => {
    const order = await placeOrder(1);
    await setOrderTracking(order.id, { courier: "delhivery", awb: "AWB888" });
    const hit = findOrderForTracking(order.number, "9876543210")!;
    const view = toTrackedOrder(hit);
    expect(view.number).toBe(order.number);
    expect(view.tracking?.url).toBe(trackingUrlFor(hit.tracking));
    expect(JSON.stringify(view)).not.toContain("riya");
    expect(view.address.fullName).toBe("Stock Flow");
  });
});
