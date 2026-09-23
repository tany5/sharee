/**
 * Lightweight retrieval: weighted keyword scoring over the in-memory chunk
 * index (lib/ai/rag/chunks.ts). No vector database, no network — semantic
 * embeddings can layer on later via lib/ai/rag/embeddings.ts.
 */
import { KNOWLEDGE_CHUNKS, type KnowledgeChunk, type ScoredChunk } from "@/lib/ai/knowledge";
import { normalizeText, prepareChunks, tokenize, type PreparedChunk } from "./chunks";

let index: PreparedChunk[] | null = null;

function getIndex(): PreparedChunk[] {
  if (!index) index = prepareChunks(KNOWLEDGE_CHUNKS);
  return index;
}

/**
 * Score one query against one chunk.
 * Weights: exact keyword phrase hit ≫ token overlap > substring presence.
 */
function scoreChunk(query: string, queryTokens: string[], prepared: PreparedChunk): ScoredChunk | null {
  const matched: string[] = [];
  let score = 0;

  for (const kw of prepared.chunk.keywords) {
    const k = normalizeText(kw);
    if (!k) continue;
    if (query.includes(k)) {
      // Whole phrase present in the query — strongest signal.
      score += k.includes(" ") ? 6 : 4;
      matched.push(k);
    } else {
      // Partial: every word of a multi-word keyword appears somewhere.
      const kwWords = k.split(" ").filter((w) => w.length > 2);
      if (kwWords.length > 1 && kwWords.every((w) => query.includes(w))) {
        score += 2;
        matched.push(k);
      }
    }
  }

  // Token overlap between query and chunk text.
  let overlap = 0;
  for (const t of queryTokens) if (prepared.tokens.has(t)) overlap += 1;
  score += overlap * 0.6;

  // Substring boost: the query words appear inside title/content.
  if (query && prepared.haystack.includes(query)) score += 2;

  if (score <= 0) return null;
  return { chunk: prepared.chunk, score, matched: [...new Set(matched)] };
}

/**
 * Retrieve the top-k relevant knowledge chunks for a query.
 * Returns [] when nothing is meaningfully relevant — callers must treat that
 * as "no fabricated answer", never as "answer from any chunk".
 */
export interface SearchOptions {
  limit?: number;
  minScore?: number;
  category?: KnowledgeChunk["category"];
}

export function searchKnowledge(
  query: string,
  opts: SearchOptions = {},
): ScoredChunk[] {
  const { limit = 3, minScore = 2, category } = opts;
  const q = normalizeText(query);
  const queryTokens = tokenize(q);
  if (!q) return [];

  const pool = getIndex();
  const scored: ScoredChunk[] = [];
  for (const prepared of pool) {
    if (category && prepared.chunk.category !== category) continue;
    const hit = scoreChunk(q, queryTokens, prepared);
    if (hit) scored.push(hit);
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).filter((s) => s.score >= minScore);
}

/** Category-scoped convenience lookup (e.g. SHIPPING intent → shipping chunks). */
export function knowledgeForCategory(
  category: KnowledgeChunk["category"],
  query: string,
): ScoredChunk[] {
  return searchKnowledge(query, { category, minScore: 0.5, limit: 3 });
}
