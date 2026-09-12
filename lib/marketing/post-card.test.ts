/**
 * Unit tests for the branded post-card LAYOUT (pure — no sharp, no network).
 * The sharp composition itself is covered by the e2e smoke test.
 */
import { describe, expect, it } from "vitest";
import {
  POST_CARD,
  buildPostCardLayout,
  estimateTextWidth,
  fitHeadline,
  formatPriceBadge,
  maxBodyLines,
  shortLink,
  wrapText,
} from "@/lib/marketing/post-card";

const baseInput = {
  headline: "Jamdani Blue Saree",
  body: "Soft cotton saree for daily wear. Aaram se drape ho jaata hai, poore din comfortable.",
  price: 199,
  siteName: "TheTanti",
  handle: "@theta.nti",
  siteUrl: "https://www.thetanti.shop",
  productPath: "sarees/jamdani-blue",
};

describe("post card layout", () => {
  it("uses the Meta 4:5 canvas", () => {
    const layout = buildPostCardLayout(baseInput);
    expect(layout.canvas.width).toBe(1080);
    expect(layout.canvas.height).toBe(1350);
    expect(layout.canvas.panelHeight).toBe(450);
    expect(layout.panel.fill).toBe("#f6ebe1");
  });

  it("formats the price badge with Indian grouping", () => {
    expect(formatPriceBadge(199)).toBe("₹199");
    expect(formatPriceBadge(1299)).toBe("₹1,299");
  });

  it("strips the scheme from footer links", () => {
    expect(shortLink("https://www.thetanti.shop", "sarees/jamdani-blue")).toBe(
      "www.thetanti.shop/sarees/jamdani-blue",
    );
    expect(shortLink("http://localhost:3000/", "/sarees/x/")).toBe("localhost:3000/sarees/x/");
  });

  it("wraps text to the max width without dropping whole overflow", () => {
    const lines = wrapText("one two three four five six seven", 120, 20, 5);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) {
      expect(estimateTextWidth(l, 20)).toBeLessThanOrEqual(120);
    }
    // Long single words are never dropped — they land on their own line.
    expect(wrapText("supercalifragilistic", 10, 20, 5)).toEqual(["supercalifragilistic"]);
  });

  it("fits the headline to at most 2 lines above the floor size", () => {
    const fitted = fitHeadline("Jamdani Blue Saree");
    expect(fitted.lines.length).toBeLessThanOrEqual(2);
    expect(fitted.size).toBeLessThanOrEqual(POST_CARD.headlineSize);
    expect(fitted.size).toBeGreaterThanOrEqual(Math.round(POST_CARD.headlineSize * 0.6));
    const widest = Math.max(...fitted.lines.map((l) => estimateTextWidth(l, fitted.size)));
    expect(widest).toBeLessThanOrEqual(POST_CARD.headlineMaxWidth);
  });

  it("clamps very long headlines to 3 lines at the floor size without dropping words", () => {
    const text =
      "An Extremely Long Product Name That Simply Cannot Fit In Two Lines However Hard We Try Even At The Smallest Allowed Headline Size";
    const fitted = fitHeadline(text);
    expect(fitted.size).toBeLessThanOrEqual(Math.round(POST_CARD.headlineSize * 0.6));
    expect(fitted.lines.length).toBeLessThanOrEqual(3);
    expect(fitted.lines.join(" ").replace(/\s+/g, " ").trim()).toBe(text);
  });

  it("keeps headline, body and footer vertically inside the panel", () => {
    const layout = buildPostCardLayout(baseInput);
    const panelTop = layout.canvas.height - layout.canvas.panelHeight;
    const headlineBottom =
      layout.headline.y + (layout.headline.lines.length - 1) * Math.round(layout.headline.size * 1.12);
    const bodyBottom =
      layout.body.y + (layout.body.lines.length - 1) * layout.body.lineHeight;
    expect(headlineBottom).toBeGreaterThan(panelTop);
    expect(layout.footer.y).toBeLessThanOrEqual(layout.canvas.height - 40);
    expect(layout.footer.y).toBeGreaterThan(panelTop);
    expect(bodyBottom).toBeLessThan(layout.footer.y);
  });

  it("gives 2-line headlines less body room than 1-line ones", () => {
    expect(maxBodyLines(2)).toBe(2);
    expect(maxBodyLines(1)).toBe(3);
  });

  it("places the brand chip top-left and the price badge top-right", () => {
    const layout = buildPostCardLayout(baseInput);
    expect(layout.brandChip.x).toBeLessThan(layout.canvas.width / 2);
    expect(layout.priceBadge.x).toBeGreaterThan(layout.canvas.width / 2);
    expect(layout.priceBadge.x + layout.priceBadge.width).toBeLessThanOrEqual(layout.canvas.width - 40);
    expect(layout.priceBadge.y + layout.priceBadge.height).toBeLessThanOrEqual(POST_CARD.photoHeight);
  });

  it("keeps the scrim over the photo only, not the copy panel", () => {
    const layout = buildPostCardLayout(baseInput);
    expect(layout.scrim.height).toBe(POST_CARD.photoHeight);
    expect(layout.scrim.width).toBe(layout.canvas.width);
    expect(layout.scrim.opacity).toBeGreaterThan(0);
    expect(layout.scrim.opacity).toBeLessThan(1);
  });
});
