import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  cashfreeApiBase,
  cashfreeEnv,
  createCashfreeOrder,
  fetchCashfreeOrder,
  isCashfreeLive,
  safeCustomerId,
  verifyWebhookSignature,
} from "./cashfree";
import { activeGateway, isCashfreeGateway, isRazorpayGateway } from "./gateway";

const cfHmac = (secret: string, timestamp: string, body: string) =>
  createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("base64");

afterEach(() => {
  delete process.env.CASHFREE_APP_ID;
  delete process.env.CASHFREE_SECRET_KEY;
  delete process.env.CASHFREE_ENV;
  delete process.env.PAYMENT_GATEWAY;
  delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  vi.unstubAllGlobals();
});

describe("cashfree env gating", () => {
  it("isCashfreeLive needs app id + secret", () => {
    expect(isCashfreeLive()).toBe(false);
    process.env.CASHFREE_APP_ID = "cf_app";
    expect(isCashfreeLive()).toBe(false);
    process.env.CASHFREE_SECRET_KEY = "cf_secret";
    expect(isCashfreeLive()).toBe(true);
  });

  it("env defaults to sandbox and points at the sandbox API", () => {
    expect(cashfreeEnv()).toBe("sandbox");
    expect(cashfreeApiBase()).toBe("https://api-sandbox.cashfree.com");
    process.env.CASHFREE_ENV = "production";
    expect(cashfreeEnv()).toBe("production");
    expect(cashfreeApiBase()).toBe("https://api.cashfree.com");
  });
});

describe("gateway selection", () => {
  it("PAYMENT_GATEWAY=cashfree wins even when Razorpay is configured", () => {
    process.env.PAYMENT_GATEWAY = "cashfree";
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_public";
    process.env.RAZORPAY_KEY_SECRET = "rzp_secret";
    expect(activeGateway()).toBe("cashfree");
    expect(isCashfreeGateway()).toBe(true);
    expect(isRazorpayGateway()).toBe(false);
  });

  it("PAYMENT_GATEWAY=razorpay switches back with Cashfree keys present", () => {
    process.env.PAYMENT_GATEWAY = "razorpay";
    process.env.CASHFREE_APP_ID = "cf_app";
    process.env.CASHFREE_SECRET_KEY = "cf_secret";
    expect(activeGateway()).toBe("razorpay");
    expect(isRazorpayGateway()).toBe(true);
  });

  it("auto-detects Cashfree when unset and both are configured", () => {
    process.env.CASHFREE_APP_ID = "cf_app";
    process.env.CASHFREE_SECRET_KEY = "cf_secret";
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_public";
    process.env.RAZORPAY_KEY_SECRET = "rzp_secret";
    expect(activeGateway()).toBe("cashfree");
  });

  it("auto-detects Razorpay when only it is configured", () => {
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_public";
    process.env.RAZORPAY_KEY_SECRET = "rzp_secret";
    expect(activeGateway()).toBe("razorpay");
  });
});

describe("safeCustomerId", () => {
  it("prefers user id, then phone, then email", () => {
    expect(
      safeCustomerId({ userId: "u-123", email: "a@b.com", phone: "987", fallback: "fb" }),
    ).toBe("u-123");
    expect(
      safeCustomerId({ email: "a@b.com", phone: "9876543210", fallback: "fb" }),
    ).toBe("9876543210");
    expect(safeCustomerId({ email: "a@b.com", phone: "", fallback: "fb" })).toBe("a-b-com");
    expect(safeCustomerId({ phone: "", fallback: "ord_abc" })).toBe("ord_abc");
  });

  it("strips characters Cashfree rejects (@ . dots) and collapses separators", () => {
    expect(safeCustomerId({ email: "tanmay1dey@gmail.com", phone: "", fallback: "fb" })).toBe(
      "tanmay1dey-gmail-com",
    );
    expect(safeCustomerId({ phone: "+91 98765 43210", fallback: "fb" })).toBe("91-98765-43210");
  });

  it("always returns something and caps at 45 chars", () => {
    expect(safeCustomerId({ phone: "", email: "", fallback: "" })).toBe("");
    expect(safeCustomerId({ phone: "", email: "", fallback: "ord_abc" })).toBe("ord_abc");
    expect(
      safeCustomerId({ userId: "x".repeat(80), phone: "", fallback: "fb" }).length,
    ).toBeLessThanOrEqual(45);
  });
});

describe("createCashfreeOrder", () => {
  it("creates an order with the right headers and payload", async () => {
    process.env.CASHFREE_APP_ID = "cf_app";
    process.env.CASHFREE_SECRET_KEY = "cf_secret";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        order_id: "tt_ord_x",
        cf_order_id: 2149460581,
        order_amount: 199,
        order_currency: "INR",
        payment_session_id: "session_abc",
        order_status: "ACTIVE",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const order = await createCashfreeOrder({
      orderId: "tt_ord_x",
      amountRupees: 199,
      customerId: "guest",
      customerPhone: "9876543210",
      notifyUrl: "https://www.thetanti.shop/api/webhooks/cashfree",
    });

    expect(order).toMatchObject({
      orderId: "tt_ord_x",
      cfOrderId: "2149460581",
      orderAmount: 199,
      paymentSessionId: "session_abc",
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api-sandbox.cashfree.com/pg/orders");
    expect((init.headers as Record<string, string>)["x-client-id"]).toBe("cf_app");
    expect((init.headers as Record<string, string>)["x-client-secret"]).toBe("cf_secret");
    expect(JSON.parse(String(init.body))).toMatchObject({
      order_id: "tt_ord_x",
      order_amount: 199,
      order_currency: "INR",
      customer_details: { customer_id: "guest", customer_phone: "9876543210" },
      order_meta: { notify_url: "https://www.thetanti.shop/api/webhooks/cashfree" },
    });
  });

  it("throws a CashfreeError when the API rejects", async () => {
    process.env.CASHFREE_APP_ID = "cf_app";
    process.env.CASHFREE_SECRET_KEY = "cf_secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: "authentication Failed" }),
      }),
    );
    await expect(
      createCashfreeOrder({ orderId: "x", amountRupees: 10, customerId: "c", customerPhone: "9" }),
    ).rejects.toThrow("authentication Failed");
  });

  it("throws when Cashfree is not configured", async () => {
    await expect(
      createCashfreeOrder({ orderId: "x", amountRupees: 10, customerId: "c", customerPhone: "9" }),
    ).rejects.toThrow("not configured");
  });
});

describe("fetchCashfreeOrder", () => {
  it("surfaces the latest successful payment for server-side confirmation", async () => {
    process.env.CASHFREE_APP_ID = "cf_app";
    process.env.CASHFREE_SECRET_KEY = "cf_secret";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          order_id: "tt_ord_x",
          cf_order_id: "2149460581",
          order_status: "PAID",
          order_amount: 199,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { cf_payment_id: 11, payment_status: "FAILED", payment_amount: 199 },
          { cf_payment_id: 12, payment_status: "SUCCESS", payment_amount: 199 },
        ],
      });
    vi.stubGlobal("fetch", fetchMock);

    const status = await fetchCashfreeOrder("tt_ord_x");
    expect(status.orderStatus).toBe("PAID");
    expect(status.paymentId).toBe("12");
    expect(status.paymentStatus).toBe("SUCCESS");
  });
});

describe("verifyWebhookSignature", () => {
  const body = '{"type":"PAYMENT_SUCCESS","data":{"order":{"order_id":"tt_ord_x"}}}';

  it("accepts a valid base64 HMAC over timestamp.payload", () => {
    const ts = "1617695238078";
    const sig = cfHmac("cf_secret", ts, body);
    expect(verifyWebhookSignature({ rawBody: body, signature: sig, timestamp: ts, secret: "cf_secret" })).toBe(true);
  });

  it("rejects a tampered payload, wrong secret or missing timestamp", () => {
    const ts = "1617695238078";
    const sig = cfHmac("cf_secret", ts, body);
    expect(verifyWebhookSignature({ rawBody: body + " ", signature: sig, timestamp: ts, secret: "cf_secret" })).toBe(false);
    expect(verifyWebhookSignature({ rawBody: body, signature: sig, timestamp: ts, secret: "other" })).toBe(false);
    expect(verifyWebhookSignature({ rawBody: body, signature: sig, timestamp: "", secret: "cf_secret" })).toBe(false);
  });
});
