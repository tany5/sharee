/**
 * Marketing AI — local LLM client (Ollama).
 *
 * RULE: the social/ads layer uses ONLY local Ollama (qwen2.5:7b by default).
 * No hosted LLM API is called for organic posts or ad copy. The paid
 * product-photo pipeline (lib/marketing/qwen.ts) is untouched and separate.
 *
 * Ollama runs on http://127.0.0.1:11434 (default install). Kept dependency-
 * free: plain fetch + JSON mode + a strict timeout so the Next.js route never
 * hangs when the local server is busy.
 */
import "server-only";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_TEXT_MODEL?.trim() || "qwen2.5:7b";

export function ollamaEnabled(): boolean {
  return (
    process.env.OLLAMA_ENABLE?.trim().toLowerCase() === "true" ||
    Boolean(process.env.OLLAMA_TEXT_MODEL?.trim()) ||
    Boolean(process.env.OLLAMA_BASE_URL?.trim())
  );
}

export function ollamaModel(): string {
  return DEFAULT_MODEL;
}

export function ollamaBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

interface OllamaGenerateReply {
  response?: string;
  error?: string;
}

/**
 * One-shot JSON-mode generation. Throws on any failure — callers decide the
 * fallback (social posts keep a deterministic template; ads surface errors).
 */
export async function ollamaJson(opts: {
  system: string;
  prompt: string;
  temperature?: number;
  numPredict?: number;
}): Promise<string> {
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS ?? 90_000) || 90_000;
  const res = await fetch(`${ollamaBaseUrl()}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: ollamaModel(),
      stream: false,
      format: "json",
      system: opts.system,
      prompt: opts.prompt,
      options: {
        temperature: opts.temperature ?? 0.7,
        num_predict: opts.numPredict ?? 700,
      },
    }),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const json = (await res.json()) as OllamaGenerateReply;
  if (json.error) throw new Error(`Ollama: ${json.error}`);
  const text = json.response ?? "";
  if (!text.trim()) throw new Error("Ollama returned an empty reply");
  return text;
}

/** Extract the first JSON object from a model reply (fences/prose tolerant). */
export function extractJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Model returned no JSON object");
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}
