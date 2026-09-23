/**
 * Intent classifier — deterministic rules only. The LLM is never asked "what
 * does the user want"; routing is free, instant and testable.
 */
import { normalizeText } from "@/lib/ai/rag/chunks";
import type { IntentResult } from "@/lib/ai/types/chat";
import { matchRules } from "./rules";

export function classifyIntent(query: string): IntentResult {
  const normalized = normalizeText(query);
  const rule = matchRules(normalized);
  if (rule) return { intent: rule.intent, ruleBased: true };
  // Unmatched short greetings etc. — the controller decides how to handle.
  return { intent: "UNKNOWN", ruleBased: false };
}
