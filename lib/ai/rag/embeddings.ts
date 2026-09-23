/**
 * OPTIONAL semantic retrieval upgrade — intentionally NOT wired into the
 * default pipeline. The keyword search (search.ts) handles the ~20-chunk
 * knowledge base well; this module documents the path to enable embeddings
 * later without touching any other file.
 *
 * To enable:
 *   1. Set MODEL_CONFIG.embedding.enabled = true.
 *   2. Load the embedding model in the AI worker (same CDN approach).
 *   3. Replace searchKnowledge()'s scoring with cosine similarity over
 *      quantize_embeddings() vectors, falling back to keyword scores.
 *
 * Deliberately no paid vector DB — vectors would live in IndexedDB next to
 * the chat history (lib/ai/storage).
 */

import { MODEL_CONFIG } from "@/lib/ai/config/model.config";

export const embeddingsEnabled = (): boolean => MODEL_CONFIG.embedding.enabled;

/** Cosine similarity between two equal-length vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}
