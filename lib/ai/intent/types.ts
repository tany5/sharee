import type { Intent, ProductSearchToolInput } from "@/lib/ai/types/chat";

/** Deterministic classifier output. */
export interface ClassifiedIntent {
  intent: Intent;
  /** Whether a keyword rule (not the LLM) decided this. */
  ruleBased: boolean;
  /** Score of the winning rule (diagnostics/tests). */
  score: number;
}

/** A structured tool call the orchestrator executes (validated before use). */
export interface ToolCall {
  name: "product_search" | "product_details" | "order_status" | "cart_help";
  /** Raw arguments — ALWAYS validated before execution. */
  args: Record<string, unknown>;
}

/** Product-search arguments extracted from natural language. */
export interface ExtractedProductQuery extends ProductSearchToolInput {
  queryLabel: string;
}
