/**
 * Stage 3 — Vernacular ad copy generation (local Ollama → Gemini Flash → Groq → fallback).
 *
 * Tone contract (from the marketing spec): homely, warm, respectful,
 * family-oriented. Always highlights the flat ₹199 price, daily comfort,
 * breathable fabric and Cash on Delivery. Output is strictly parsed into:
 * headline hook, 3 bullets, CTA (with product link), 5 hashtags.
 */
import type { AdCopy, AdvanceContext } from "@/lib/marketing/types";

export type CopyLanguage = "hinglish" | "banglish";

interface CopyJson {
  headline: string;
  bullets: string[];
  cta: string;
  hashtags: string[];
  language: string;
}

const LANG_NOTE: Record<CopyLanguage, string> = {
  hinglish:
    "Conversational Hinglish (Hindi words written in Latin script mixed with English). Use natural words like 'aapke', 'dino-bhar', 'aaram se', 'bilkul'.",
  banglish:
    "Conversational Banglish (Bengali words written in Latin script mixed with English). Use natural words like 'apnar', 'sohoj', 'khub', 'bhalo'.",
};

/** Strict tone/price contract every LLM must follow. */
export function copySystemPrompt(): string {
  return [
    "You write Facebook/Instagram ad captions for an Indian saree webstore.",
    "Audience: Indian women aged 35-55 (mothers, aunts) and adult children buying budget-friendly gifts.",
    "Product promise: every saree costs a flat ₹199. Emphasise daily comfort, breathable fabric, and Cash on Delivery.",
    "Tone: homely, warm, respectful, family-oriented. Short, spoken-style sentences. No English exclamations like 'Hey guys'.",
    "Never invent discounts, delivery dates, or product claims beyond what is given.",
    "Language: conversational bilingual mix (Latin-script Hindi/Bengali + English).",
  ].join(" ");
}

export function copyUserPrompt(ctx: AdvanceContext, language: CopyLanguage): string {
  const url = `${ctx.siteUrl}/sarees/${ctx.product.slug}`;
  const fabric = ctx.product.fabric || "soft breathable fabric";
  return [
    `Saree: ${ctx.product.name}. Fabric: ${fabric}. Category: ${ctx.product.category.replace(/-/g, " ")}. Price: ₹${ctx.product.price} (flat, never changes).`,
    `Product page: ${url}`,
    `Language style: ${LANG_NOTE[language]}`,
    "Return ONLY minified JSON with this exact shape (no markdown, no commentary):",
    '{"headline":"one scroll-stopping hook under 60 characters","bullets":["three short comfort bullets, each under 55 characters"],"cta":"direct call to action that includes the product link verbatim","hashtags":["exactly 5 niche hashtags starting with #"],"language":"hinglish|banglish"}',
  ].join("\n");
}

/** Parse a model reply into AdCopy (throws on malformed output). */
export function parseCopyReply(text: string): AdCopy {
  // Models sometimes wrap JSON in ```json fences or add prose — find the object.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Copy model returned no JSON object");
  }
  const raw = JSON.parse(text.slice(start, end + 1)) as Partial<CopyJson>;

  const headline = String(raw.headline ?? "").trim();
  const bullets = (Array.isArray(raw.bullets) ? raw.bullets : [])
    .map((b) => String(b).trim())
    .filter(Boolean)
    .slice(0, 3);
  const cta = String(raw.cta ?? "").trim();
  const hashtags = (Array.isArray(raw.hashtags) ? raw.hashtags : [])
    .map((h) => {
      const s = String(h).trim();
      return s ? (s.startsWith("#") ? s : `#${s.replace(/^#+/, "")}`) : "";
    })
    .filter(Boolean)
    .slice(0, 5);
  const language = String(raw.language ?? "").trim();

  if (!headline || bullets.length < 2 || !cta || hashtags.length < 3) {
    throw new Error("Copy model output incomplete");
  }
  return { headline, bullets, cta, hashtags, language: language || "hinglish" };
}

/** Deterministic template copy — used when no LLM key is configured. */
export function fallbackCopy(ctx: AdvanceContext, language: CopyLanguage): AdCopy {
  const url = `${ctx.siteUrl}/sarees/${ctx.product.slug}`;
  const fabric = ctx.product.fabric || "soft fabric";
  if (language === "banglish") {
    return {
      headline: `${ctx.product.name} — khub comfort, only ₹${ctx.product.price}!`,
      bullets: [
        `Soft ${fabric.toLowerCase()} — all-day comfort`,
        "Breathable weave, perfect for daily wear",
        "Cash on Delivery available across India",
      ],
      cta: `Apnar favourite saree order korun: ${url}`,
      hashtags: [
        "#SareeLove",
        "#DailyWearSaree",
        `#${(ctx.product.category || "saree").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}`,
        "#Saree199",
        "#TheTanti",
      ],
      language,
    };
  }
  return {
    headline: `${ctx.product.name} — sirf ₹${ctx.product.price}!`,
    bullets: [
      `Soft ${fabric.toLowerCase()} — poore din aaram`,
      "Breathable fabric, roz ke liye perfect",
      "Cash on Delivery available, all India",
    ],
    cta: `Order kariye abhi: ${url}`,
    hashtags: [
      "#SareeLove",
      "#DailyWearSaree",
      `#${(ctx.product.category || "saree").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}`,
      "#Saree199",
      "#TheTanti",
    ],
    language,
  };
}

interface GeminiReply {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

async function callGemini(
  key: string,
  prompt: string,
  system: string,
): Promise<string> {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 400 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const json = (await res.json()) as GeminiReply;
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) throw new Error("Gemini returned empty reply");
  return text;
}

interface GroqReply {
  choices?: { message?: { content?: string } }[];
}

interface OllamaReply {
  response?: string;
}

function ollamaEnabled(): boolean {
  return (
    process.env.OLLAMA_ENABLE?.trim().toLowerCase() === "true" ||
    Boolean(process.env.OLLAMA_TEXT_MODEL?.trim()) ||
    Boolean(process.env.OLLAMA_BASE_URL?.trim())
  );
}

function ollamaModel(): string {
  return process.env.OLLAMA_TEXT_MODEL?.trim() || "qwen2.5:3b-instruct";
}

async function callOllama(prompt: string, system: string): Promise<string> {
  const baseUrl = (process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434").replace(
    /\/+$/,
    "",
  );
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS ?? 5000);
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(Number.isFinite(timeoutMs) ? timeoutMs : 5000),
    body: JSON.stringify({
      model: ollamaModel(),
      stream: false,
      format: "json",
      prompt: `${system}\n\n${prompt}`,
      options: { temperature: 0.7, num_predict: 360 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const json = (await res.json()) as OllamaReply;
  const text = json.response ?? "";
  if (!text.trim()) throw new Error("Ollama returned empty reply");
  return text;
}

async function callGroq(key: string, prompt: string, system: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.9,
      max_tokens: 400,
    }),
  });
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
  const json = (await res.json()) as GroqReply;
  const text = json.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("Groq returned empty reply");
  return text;
}

export interface CopySecrets {
  geminiKey?: string;
  groqKey?: string;
}

/**
 * Generate ad copy: local Ollama first, then hosted LLMs, then the deterministic
 * template. Never throws — falls back so the pipeline always produces copy.
 */
export async function generateAdCopy(
  ctx: AdvanceContext,
  language: CopyLanguage,
  secrets: CopySecrets,
): Promise<{ copy: AdCopy; engine: string }> {
  const system = copySystemPrompt();
  const user = copyUserPrompt(ctx, language);
  const attempts: [string, (() => Promise<string>) | null][] = [
    [`ollama-${ollamaModel()}`, ollamaEnabled() ? () => callOllama(user, system) : null],
    ["gemini-flash", secrets.geminiKey ? () => callGemini(secrets.geminiKey!, user, system) : null],
    ["groq-llama33", secrets.groqKey ? () => callGroq(secrets.groqKey!, user, system) : null],
  ];
  for (const [engine, call] of attempts) {
    if (!call) continue;
    try {
      return { copy: parseCopyReply(await call()), engine };
    } catch (err) {
      console.warn(`[marketing] copy via ${engine} failed:`, (err as Error).message);
    }
  }
  return { copy: fallbackCopy(ctx, language), engine: "template-fallback" };
}

/** Full caption string for Meta publishing. */
export function copyToCaption(copy: AdCopy): string {
  return [
    copy.headline,
    "",
    ...copy.bullets.map((b) => `• ${b}`),
    "",
    copy.cta,
    "",
    copy.hashtags.join(" "),
  ].join("\n");
}
