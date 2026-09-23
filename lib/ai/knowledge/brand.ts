/**
 * Brand knowledge — mirrors lib/site.ts. ONE source of truth rule: the site
 * config stays authoritative; these chunks exist so the local model can be
 * grounded in the same facts without importing server modules.
 */
import { SITE } from "@/lib/site";
import type { KnowledgeChunk } from "./types";

export const brandChunks: KnowledgeChunk[] = [
  {
    id: "brand-overview",
    category: "brand",
    title: "About TheTanti",
    keywords: [
      "thetanti",
      "what is thetanti",
      "about thetanti",
      "brand",
      "company",
      "online saree store",
      "saree shop",
      "tell me about thetanti",
    ],
    content:
      `TheTanti is an online saree store based in Liluah, Howrah (West Bengal), India. ` +
      `Every saree on TheTanti costs ₹${SITE.price} — one honest flat price for the whole catalogue. ` +
      `TheTanti sells cotton, silk, printed, chiffon, georgette and fancy sarees, sourced directly from weavers ` +
      `and textile hubs across India and quality checked at the Howrah fulfilment centre before shipping. ` +
      `Free shipping across India, 7-day easy returns, and Cash on Delivery are available.`,
  },
  {
    id: "brand-price-promise",
    category: "brand",
    title: "One simple price",
    keywords: ["price", "pricing", "cost", "199", "discount", "offer", "cheap", "expensive"],
    content:
      `Every saree costs ₹${SITE.price}. No markups, no fake discounts, no 'compare at' prices. ` +
      `Because there is one simple price, sales and coupon codes are not needed — the price is already the best offer.`,
  },
  {
    id: "brand-categories",
    category: "categories",
    title: "Saree categories",
    keywords: [
      "categories",
      "category",
      "types",
      "cotton",
      "silk",
      "printed",
      "chiffon",
      "georgette",
      "fancy",
      "collection",
      "kinds",
      "variety",
    ],
    content:
      `TheTanti's saree categories: Cotton Sarees (breathable handloom weaves for everyday grace), ` +
      `Silk Sarees (rich zari and lustre for celebrations), Printed Sarees (bold prints that turn heads), ` +
      `Chiffon Sarees (featherlight flow with a soft fall), Georgette Sarees (crepe textures that drape like a dream), ` +
      `and Fancy Sarees (party-ready designs and statement borders). ` +
      `Browse all categories at /categories or the full catalogue at /sarees.`,
  },
  {
    id: "brand-occasions",
    category: "products",
    title: "Choosing a saree",
    keywords: [
      "occasion",
      "wedding",
      "party",
      "daily",
      "office",
      "festive",
      "wear",
      "which",
      "recommend",
      "suggest",
      "best",
    ],
    content:
      `Every saree page lists its fabric and occasion (casual, festive, party, wedding and more). ` +
      `For daily wear, cotton and printed sarees are light and breathable. For celebrations, ` +
      `silk and fancy sarees carry zari and richer borders. All of them are ₹${SITE.price} with free shipping, ` +
      `so customers can pick by style, not budget.`,
  },
  {
    id: "brand-navigation",
    category: "website",
    title: "Website navigation",
    keywords: [
      "website",
      "navigate",
      "page",
      "where",
      "find",
      "link",
      "menu",
      "account",
      "wishlist",
      "cart",
      "track",
      "policy",
    ],
    content:
      `Website map — Home: / · All sarees: /sarees · Categories: /categories · New arrivals: /sarees?tag=new · ` +
      `Best sellers: /sarees?tag=bestseller · Cart: /cart · Wishlist: /wishlist · Your account & orders: /account · ` +
      `Track an order: /track · Shipping policy: /shipping-policy · Return policy: /return-policy · ` +
      `Privacy policy: /privacy-policy · Terms: /terms-and-conditions · Contact: /contact · About: /about.`,
  },
];
