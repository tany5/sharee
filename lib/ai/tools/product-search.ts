/**
 * Product search tool — the ONLY way the assistant "finds" products.
 * Filters are validated, then executed against the store's real
 * /api/products endpoint (which itself serves server-computed card data).
 * The LLM never invents products; it can only describe what this returns.
 */
import { LISTING_PAGE_SIZE } from "@/lib/listing";
import type { ChatProduct, ProductSearchToolInput } from "@/lib/ai/types/chat";

const MAX_LIMIT = 8;

/** Whitelisted category slugs — anything else is rejected, not guessed. */
export const CATEGORY_SLUGS = new Set([
  "cotton-sarees",
  "silk-sarees",
  "printed-sarees",
  "chiffon-sarees",
  "georgette-sarees",
  "fancy-sarees",
]);

/** Zod-free validation (project convention: hand-rolled validators). */
function clampInt(value: unknown, min: number, max: number): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(Math.max(Math.round(n), min), max);
}

function sanitizeText(value: unknown, maxLen: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim().slice(0, maxLen);
  return t || undefined;
}

/** Validate untrusted tool arguments; throws on anything suspicious. */
export function validateProductSearchInput(raw: unknown): ProductSearchToolInput {
  if (typeof raw !== "object" || raw === null) throw new Error("Invalid product search");
  const input = raw as Record<string, unknown>;

  const validated: ProductSearchToolInput = {
    q: sanitizeText(input.q, 60),
    // Category must be a known slug — never free text.
    category:
      typeof input.category === "string" && CATEGORY_SLUGS.has(input.category)
        ? input.category
        : undefined,
    color: sanitizeText(input.color, 30),
    maxPrice: clampInt(input.maxPrice, 1, 1_000_000),
    minPrice: clampInt(input.minPrice, 1, 1_000_000),
    limit: clampInt(input.limit ?? 4, 1, MAX_LIMIT),
  };
  if (
    validated.minPrice !== undefined &&
    validated.maxPrice !== undefined &&
    validated.minPrice > validated.maxPrice
  ) {
    throw new Error("Invalid price range");
  }
  return validated;
}

/** Execute the search against the existing public products API. */
export async function runProductSearch(input: ProductSearchToolInput): Promise<ChatProduct[]> {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.category) params.set("category", input.category);
  if (input.color) params.set("color", input.color);
  if (input.maxPrice !== undefined) {
    // The public API has no price param — the catalogue is a flat ₹199, so a
    // price ceiling either keeps the search as-is (≥ price) or yields nothing.
    // We apply the ceiling client-side over the returned cards for honesty.
    params.set("limit", String(Math.min(LISTING_PAGE_SIZE, 24)));
  }
  if (input.minPrice !== undefined) {
    params.set("limit", String(Math.min(LISTING_PAGE_SIZE, 24)));
  }

  let items: ChatProduct[] = [];
  try {
    const res = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`products ${res.status}`);
    const data = (await res.json()) as { ok: boolean; items?: ChatProduct[] };
    items = Array.isArray(data.items) ? data.items : [];
  } catch {
    throw new Error("Product search is unavailable right now.");
  }

  // Price filter (server data is authoritative; we only narrow, never alter).
  if (input.maxPrice !== undefined) items = items.filter((p) => p.price <= input.maxPrice!);
  if (input.minPrice !== undefined) items = items.filter((p) => p.price >= input.minPrice!);

  return items.slice(0, input.limit ?? 4);
}
