/**
 * Cart tool — the assistant NEVER mutates the cart itself. It validates a
 * slug and hands it to the UI, which calls the existing StoreProvider
 * add() (the one and only cart implementation, localStorage-based).
 * Guest carts work exactly as everywhere else on the site.
 */
import { isValidSlug } from "./product-details";

export type CartIntentResult =
  | { ok: true; slug: string }
  | { ok: false; message: string };

/** Parse "add <slug|product name> to cart" requests. Returns a UI action. */
export function parseCartRequest(raw: unknown, knownSlugs?: string[]): CartIntentResult {
  if (typeof raw !== "string") return { ok: false, message: "Which saree should I add?" };
  const text = raw.trim().toLowerCase();

  // Exact slug form.
  if (isValidSlug(text)) {
    if (!knownSlugs || knownSlugs.includes(text)) return { ok: true, slug: text };
  }
  // Otherwise match against the products already shown in this chat.
  if (knownSlugs) {
    const hit = knownSlugs.find((s) => s.includes(text) || text.includes(s));
    if (hit) return { ok: true, slug: hit };
  }
  return {
    ok: false,
    message: "I can only add sarees you can see in this chat. Open a product card and use Add to Cart there.",
  };
}
