import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  createRazorpayOrder,
  isRazorpayLive,
  razorpayKeyId,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from "./razorpay";

const hmac = (secret: string, msg: string) =>
  createHmac("sha256", secret).update(msg).digest("hex");

afterEach(() => {
  delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  vi.unstubAllGlobals();
});

describe("verifyPaymentSignature", () => {
  const orderId = "order_NDX8fAKSkjRZx";
  const paymentId = "pay_CFXfakajI67D1";

  it("accepts a valid HMAC signature (order_id|payment_id)", () => {
    process.env.RAZORPAY_KEY_SECRET = "secret_123";
    const sig = hmac("secret_123", `${orderId}|${paymentId}`);
    expect(
      verifyPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: sig,
      }),
    ).toBe(true);
  });

  it("is case-insensitive on the signature hex", () => {
    process.env.RAZORPAY_KEY_SECRET = "secret_123";
    const sig = hmac("secret_123", `${orderId}|${paymentId}`);
    expect(
      verifyPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: sig.toUpperCase(),
      }),
    ).toBe(true);
  });

  it("rejects a tampered signature", () => {
    process.env.RAZORPAY_KEY_SECRET = "secret_123";
    const sig = hmac("secret_123", `${orderId}|${paymentId}`);
    expect(
      verifyPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: "pay_OTHER",
        razorpaySignature: sig,
      }),
    ).toBe(false);
    expect(
      verifyPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: sig.slice(0, -1) + "0",
      }),
    ).toBe(false);
  });

  it("rejects missing fields or an unset secret", () => {
    expect(
      verifyPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: "abc",
      }),
    ).toBe(false);
    process.env.RAZORPAY_KEY_SECRET = "secret_123";
    expect(
      verifyPaymentSignature({
        razorpayOrderId: "",
        razorpayPaymentId: paymentId,
        razorpaySignature: "abc",
      }),
    ).toBe(false);
  });
});

describe("verifyWebhookSignature", () => {
  const body = '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_1","order_id":"order_1","amount":19900}}}}';

  it("accepts a valid plain-hex signature", () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "wh_secret";
    const sig = hmac("wh_secret", body);
    expect(verifyWebhookSignature(body, sig)).toBe(true);
  });

  it("accepts the t=<ts>,v1=<sig> header format", () => {
    const sig = hmac("wh_secret", body);
    const header = `t=${Date.now()},v1=${sig}`;
    expect(verifyWebhookSignature(body, header, "wh_secret")).toBe(true);
  });

  it("rejects a wrong signature or unset secret", () => {
    expect(verifyWebhookSignature(body, hmac("other", body), "wh_secret")).toBe(false);
    expect(verifyWebhookSignature(body, hmac("wh_secret", body))).toBe(false);
    expect(verifyWebhookSignature(body, "")).toBe(false);
  });
});

describe("env gating", () => {
  it("isRazorpayLive needs both key id and secret", () => {
    expect(isRazorpayLive()).toBe(false);
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_xxx";
    expect(isRazorpayLive()).toBe(false);
    process.env.RAZORPAY_KEY_SECRET = "secret";
    expect(isRazorpayLive()).toBe(true);
  });

  it("key id prefers NEXT_PUBLIC and falls back to RAZORPAY_KEY_ID", () => {
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_public";
    process.env.RAZORPAY_KEY_ID = "rzp_test_fallback";
    expect(razorpayKeyId()).toBe("rzp_test_public");
    delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    expect(razorpayKeyId()).toBe("rzp_test_fallback");
  });
});

describe("createRazorpayOrder", () => {
  it("creates an order with basic auth and the right payload", async () => {
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "order_123", amount: 19900, currency: "INR" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const order = await createRazorpayOrder({
      amountPaise: 19900,
      receipt: "AMB-260904-1234",
      notes: { orderId: "ord_x" },
    });

    expect(order).toEqual({ id: "order_123", amount: 19900, currency: "INR" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.razorpay.com/v1/orders");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("rzp_test_key:rzp_test_secret").toString("base64")}`,
    );
    expect(JSON.parse(String(init.body))).toMatchObject({
      amount: 19900,
      currency: "INR",
      receipt: "AMB-260904-1234",
      notes: { orderId: "ord_x" },
    });
  });

  it("throws a RazorpayError when the API rejects", async () => {
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: { description: "The provided key is invalid" } }),
      }),
    );
    await expect(
      createRazorpayOrder({ amountPaise: 100, receipt: "x" }),
    ).rejects.toThrow("The provided key is invalid");
  });

  it("throws when Razorpay is not configured", async () => {
    await expect(
      createRazorpayOrder({ amountPaise: 100, receipt: "x" }),
    ).rejects.toThrow("not configured");
  });
});