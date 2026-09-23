/** Single registry of knowledge chunks — imported by the RAG layer only. */
import type { KnowledgeChunk } from "./types";
import { brandChunks } from "./brand";
import { shippingChunks } from "./shipping";
import { returnsChunks } from "./returns";
import { paymentsChunks } from "./payments";
import { contactChunks } from "./contact";
import { faqChunks } from "./faq";
import { sellerChunks } from "./seller";

export const KNOWLEDGE_CHUNKS: KnowledgeChunk[] = [
  ...brandChunks,
  ...shippingChunks,
  ...returnsChunks,
  ...paymentsChunks,
  ...contactChunks,
  ...faqChunks,
  ...sellerChunks,
];

export type { KnowledgeChunk, ScoredChunk } from "./types";
