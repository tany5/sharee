import { describe, expect, it } from "vitest";
import {
  emailLogoUrl,
  renderDeliveredEmail,
  renderOrderConfirmationEmail,
  renderOrderStatusEmail,
  renderShippedEmail,
  renderWelcomeEmail,
} from "@/lib/email-templates/render";
import { SITE } from "@/lib/site";
import type { Order } from "@/lib/types";

/** Minimal order shape — templates only read number/items/address/total/… */
function fakeOrder(): Order {
  return {
    id: "test-id",
    number: "AMB-260918-0042",
    items: [
      { slug: "magenta-saree", name: "Magenta Saree", qty: 1, price: 199, color: "Magenta" },
      { slug: "teal-saree", name: "Teal Cotton Saree", qty: 2, price: 199, color: "Teal" },
    ],
    subtotal: 597,
    shipping: 0,
    total: 597,
    paymentMethod: "cod",
    paymentStatus: "cod",
    status: "placed",
    address: {
      fullName: "Tanmay Dey",
      phone: "9000000000",
      pincode: "711204",
      line1: "Chakpara",
      city: "Howrah",
      state: "West Bengal",
    },
    storedIn: "local",
    createdAt: new Date().toISOString(),
    estimatedDelivery: new Date(Date.now() + 5 * 864e5).toISOString(),
  } as Order;
}

const RENDERERS: Array<[string, () => { subject: string; html: string }]> = [
  ["welcome", () => renderWelcomeEmail({ name: "Tanmay Dey" })],
  ["confirmation", () => renderOrderConfirmationEmail(fakeOrder())],
  ["status", () => renderOrderStatusEmail(fakeOrder(), "dispatched")],
  ["shipped", () => renderShippedEmail(fakeOrder())],
  ["delivered", () => renderDeliveredEmail(fakeOrder())],
];

describe("email templates", () => {
  it.each(RENDERERS)("%s: embeds the absolute logo URL", (_name, render) => {
    const { html } = render();
    expect(html).toContain(`src="${emailLogoUrl()}"`);
    // Absolute URL on the public site — never localhost/staging.
    expect(emailLogoUrl()).toMatch(/^https:\/\/(?!localhost)/);
    expect(emailLogoUrl()).toContain(new URL(SITE.url).hostname);
  });

  it.each(RENDERERS)("%s: no unfilled placeholders remain", (_name, render) => {
    const { html } = render();
    expect(html).not.toMatch(/\{\{[a-z_]+\}\}/);
  });

  it("logo URL is overridable via EMAIL_LOGO_URL", async () => {
    process.env.EMAIL_LOGO_URL = "https://www.thetanti.shop/email-logo.png";
    const { emailLogoUrl: fresh } = await import("@/lib/email-templates/render");
    expect(fresh()).toBe("https://www.thetanti.shop/email-logo.png");
    delete process.env.EMAIL_LOGO_URL;
  });
});
