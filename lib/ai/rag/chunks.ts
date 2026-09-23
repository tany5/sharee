/**
 * Chunk preparation for retrieval. The knowledge base is small (≈20 chunks),
 * so a lightweight in-memory index beats any external store — and keeps the
 * pipeline free of vector databases.
 */
import type { KnowledgeChunk } from "@/lib/ai/knowledge";

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s₹]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Distinct normalized words > 2 chars (cheap stopword filter). */
export function tokenize(text: string): string[] {
  const words = normalizeText(text).split(" ").filter((w) => w.length > 2);
  return [...new Set(words)];
}

export interface PreparedChunk {
  chunk: KnowledgeChunk;
  /** Normalized title + content haystack for substring boosting. */
  haystack: string;
  /** Normalized token set for keyword scoring. */
  tokens: Set<string>;
}

/** Build the in-memory retrieval index. Deterministic; no I/O. */
export function prepareChunks(chunks: KnowledgeChunk[]): PreparedChunk[] {
  return chunks.map((chunk) => {
    const keywords = chunk.keywords.map(normalizeText);
    const haystack = normalizeText(`${chunk.title} ${keywords.join(" ")} ${chunk.content}`);
    return {
      chunk,
      haystack,
      tokens: new Set(tokenize(`${chunk.title} ${keywords.join(" ")} ${chunk.content}`)),
    };
  });
}
