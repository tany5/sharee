/** Shared knowledge-base types. */
export interface KnowledgeChunk {
  /** Stable id, e.g. "shipping-charges". Never changed once published. */
  id: string;
  /** Category used for scoping and UI hints ("shipping", "brand", …). */
  category:
    | "brand"
    | "categories"
    | "products"
    | "shipping"
    | "returns"
    | "payments"
    | "orders"
    | "website"
    | "contact"
    | "privacy"
    | "faq";
  title: string;
  /** Grounded answer text the model (or fallback mode) quotes from. */
  content: string;
  /** Lowercase retrieval hints; matched against the normalized query. */
  keywords: string[];
}

/** A scored chunk + the phrases that made it relevant (for transparency). */
export interface ScoredChunk {
  chunk: KnowledgeChunk;
  score: number;
  matched: string[];
}
