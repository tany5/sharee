/**
 * Context builder — assembles the grounded context block handed to the local
 * LLM (and used verbatim by the no-LLM fallback path). Only retrieved chunks
 * and tool results enter the context; the model can never see more than what
 * retrieval actually found.
 */
import type { ScoredChunk } from "@/lib/ai/knowledge";
import type { ChatProduct, OrderStatusBlock } from "@/lib/ai/types/chat";
import { formatINR } from "@/lib/format";

export interface BuiltContext {
  /** Numbered knowledge extracts, or "" when nothing matched. */
  knowledge: string;
  /** Short human-readable list of chunk titles used (for the UI badge). */
  sources: string[];
}

export function buildKnowledgeContext(scored: ScoredChunk[]): BuiltContext {
  if (scored.length === 0) return { knowledge: "", sources: [] };
  const parts = scored.map((s, i) => `[${i + 1}] ${s.chunk.title}: ${s.chunk.content}`);
  return {
    knowledge: parts.join("\n"),
    sources: scored.map((s) => s.chunk.title),
  };
}

/** Compact product list for the prompt — server-truth fields only. */
export function describeProducts(products: ChatProduct[], queryLabel: string): string {
  if (products.length === 0) {
    // NEUTRAL FACT, not an instruction — small models echo whatever sits in
    // the context verbatim, so this must never contain "tell the customer".
    return `No products in the catalogue matched the search "${queryLabel}".`;
  }
  const lines = products.map(
    (p) =>
      `- ${p.name} (${p.category.replace(/-sarees$/, "")}, ${p.colorway}) — ${formatINR(p.price)}, ` +
      `${p.reviewCount > 0 ? `rated ${p.rating}/5 by ${p.reviewCount} buyers` : "new in catalogue"}, ` +
      `in stock, link /sarees/${p.slug}`,
  );
  return `Product search ("${queryLabel}") returned these REAL products from TheTanti's catalogue:\n${lines.join("\n")}\nYou may recommend ONLY these products, with EXACTLY these prices.`;
}

/** Compact, customer-safe order summary for the prompt. */
export function describeOrderStatus(block: OrderStatusBlock["order"]): string {
  const fulfil =
    block.fulfilment === "completed"
      ? "delivered"
      : block.fulfilment === "dispatched"
        ? "shipped and on its way"
        : block.fulfilment === "cancelled"
          ? "cancelled"
          : "confirmed and being prepared";
  const pay =
    block.paymentStatus === "paid"
      ? "payment received"
      : block.paymentStatus === "cod"
        ? "cash on delivery"
        : "payment pending";
  const items = block.items.map((i) => `${i.name} ×${i.qty}`).join(", ");
  return (
    `Latest order ${block.number} (${items}, ${formatINR(block.total)}) is ${fulfil}; ${pay}. ` +
    (block.tracking?.awb
      ? `Courier AWB ${block.tracking.awb} — track at ${block.tracking.url ?? "/track"}.`
      : `Tracking details appear once it is dispatched; /track works anytime.`)
  );
}
