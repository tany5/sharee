/**
 * Telegram approval interface for the Marketing AI (social + ads).
 *
 * The owner approves EVERY public action here:
 *   - organic Facebook/Instagram posts (1st + only approval)
 *   - Meta ads: 1st approval = create PAUSED, 2nd approval = activate (spend)
 *
 * Uses plain Bot API over fetch — no webhook needed locally: the sync route
 * calls getUpdates and records processed update ids (offset) in social_state.
 * Long polls never block Next.js: the HTTP timeout is capped under the poll
 * window. TEST MODE (SOCIAL_TEST_MODE / default true) skips real sends so the
 * whole flow can be exercised offline.
 */
import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const API = "https://api.telegram.org";

export interface TelegramCreds {
  botToken: string;
  chatId: string;
}

/**
 * Local secret file (Rule 10: never commit, never log). Points at the owner's
 * copy of the bot token; override the location with TELEGRAM_BOT_TOKEN_FILE.
 * The file may hold: just the token, "token: <t>" / "chat: <id>" lines, or
 * JSON with botToken/chatId fields.
 */
export function telegramTokenFile(): string {
  return (
    process.env.TELEGRAM_BOT_TOKEN_FILE?.trim() ||
    path.join(process.cwd(), "secret", "secret", "telegrambot.txt")
  );
}

interface ParsedTokenFile {
  botToken?: string;
  chatId?: string;
}

/** Parse the token file leniently; returns {} when unreadable/malformed. */
export function parseTelegramTokenFile(raw: string): ParsedTokenFile {
  const text = raw.trim();
  if (!text) return {};
  if (text.startsWith("{")) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      const token = String(obj.botToken ?? obj.bot_token ?? obj.token ?? "").trim();
      const chat = String(obj.chatId ?? obj.chat_id ?? obj.chat ?? "").trim();
      return { botToken: token || undefined, chatId: chat || undefined };
    } catch {
      /* fall through to line parsing */
    }
  }
  const out: ParsedTokenFile = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(bot[_-]?token|chat[_-]?id|chat|token)\s*[:=]\s*(\S+)\s*$/i.exec(line);
    if (m) {
      const key = m[1]!.toLowerCase().replace(/[_-]/g, "");
      if (key === "bottoken" || key === "token") out.botToken = m[2];
      else out.chatId = m[2];
    }
  }
  if (!out.botToken) {
    // Bare bot token line: "123456:AA..." — a colon + long alphanumeric tail.
    const bare = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(l));
    if (bare) out.botToken = bare;
  }
  return out;
}

function readTokenFile(): ParsedTokenFile {
  try {
    const file = telegramTokenFile();
    if (!existsSync(/* turbopackIgnore: true */ file)) return {};
    return parseTelegramTokenFile(readFileSync(/* turbopackIgnore: true */ file, "utf8"));
  } catch {
    return {};
  }
}

async function telegramBotToken(): Promise<string | undefined> {
  const { loadPipelineSecrets } = await import("@/lib/marketing/secrets");
  const s = await loadPipelineSecrets();
  const fromFile = readTokenFile();
  return s.telegramBotToken?.trim() || process.env.TELEGRAM_BOT_TOKEN?.trim() || fromFile.botToken;
}

/**
 * Resolve creds: app_secrets RPC → env → local token file. Chat id comes from
 * app_secrets/env/JSON-in-file; when only the bare token is in the file the
 * chat id can be discovered later via the sync route (getUpdates chat ids).
 */
export async function telegramCreds(): Promise<TelegramCreds | null> {
  const botToken = await telegramBotToken();
  const { loadPipelineSecrets } = await import("@/lib/marketing/secrets");
  const s = await loadPipelineSecrets();
  const fromFile = readTokenFile();
  const chatId =
    s.telegramChatId?.trim() || process.env.TELEGRAM_CHAT_ID?.trim() || fromFile.chatId || (await linkedChatId());
  if (!botToken || !chatId) return null;
  return { botToken, chatId };
}

/** Chat id linked via the admin UI (stored in the marketing-ai state blob). */
async function linkedChatId(): Promise<string | undefined> {
  try {
    const { getAiState } = await import("@/lib/marketing/ai-store");
    const v = await getAiState<string | undefined>("telegram_chat_id", undefined);
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** Token present but chat id missing — the owner still needs to link a chat. */
export async function telegramStatus(): Promise<{
  hasToken: boolean;
  hasChat: boolean;
  source: "secrets" | "env" | "file" | "none";
}> {
  const { loadPipelineSecrets } = await import("@/lib/marketing/secrets");
  const s = await loadPipelineSecrets();
  const fromFile = readTokenFile();
  const hasToken = Boolean(s.telegramBotToken?.trim() || fromFile.botToken);
  const hasChat = Boolean(
    s.telegramChatId?.trim() || fromFile.chatId || (await linkedChatId()),
  );
  const source = s.telegramBotToken?.trim()
    ? "secrets"
    : process.env.TELEGRAM_BOT_TOKEN?.trim()
      ? "env"
      : fromFile.botToken
        ? "file"
        : "none";
  return { hasToken, hasChat, source };
}

export function isTelegramConfigured(): boolean {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
      process.env.TELEGRAM_CHAT_ID?.trim(),
  );
}

/** Inline keyboard button shape accepted by the Bot API. */
export interface TelegramButton {
  text: string;
  callback_data: string;
}

export interface TelegramCard {
  text: string;
  /** up to 3 rows of buttons */
  buttons: TelegramButton[][];
  imageUrl?: string;
}

const MAX_CAPTION = 1024;
const MAX_MESSAGE = 4096;

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export async function sendTelegramCard(card: TelegramCard): Promise<void> {
  const creds = await telegramCreds();
  if (!creds) return; // Telegram optional — admin UI still works
  try {
    const method = card.imageUrl ? "sendPhoto" : "sendMessage";
    const body: Record<string, unknown> = {
      chat_id: creds.chatId,
      text: card.imageUrl ? undefined : clip(card.text, MAX_MESSAGE),
      caption: card.imageUrl ? clip(card.text, MAX_CAPTION) : undefined,
      reply_markup: JSON.stringify({ inline_keyboard: card.buttons.slice(0, 3) }),
      parse_mode: "HTML",
    };
    if (card.imageUrl) {
      body.photo = card.imageUrl;
    }
    const res = await fetch(`${API}/bot${creds.botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn("[telegram] send failed:", (await res.text()).slice(0, 300));
    }
  } catch (err) {
    console.warn("[telegram] send error:", (err as Error).message);
  }
}

export async function sendTelegramMessage(text: string): Promise<void> {
  await sendTelegramCard({ text, buttons: [] });
}

/* ------------------------------ callback sync ------------------------------ */

export interface TelegramCallback {
  /** Stable update id — recorded so it is never processed twice. */
  updateId: number;
  /** callback_data, e.g. "social:approve:<id>" */
  data: string;
  /** callback_query id — used to answer the query (stops the spinner). */
  callbackQueryId?: string;
}

interface TelegramUpdate {
  update_id?: number;
  callback_query?: { data?: string; id?: string };
}

interface GetUpdatesReply {
  ok?: boolean;
  result?: TelegramUpdate[];
  description?: string;
}

/**
 * Poll pending callback queries. Never throws (Telegram hiccups must not
 * break the sync route); returns [] on any error.
 */
export async function fetchTelegramCallbacks(
  timeoutSec = 0,
  offset = 0,
): Promise<TelegramCallback[]> {
  const creds = await telegramCreds();
  if (!creds) return [];
  try {
    const url = new URL(`${API}/bot${creds.botToken}/getUpdates`);
    url.searchParams.set("timeout", String(Math.min(timeoutSec, 25)));
    if (offset > 0) url.searchParams.set("offset", String(offset));
    url.searchParams.set("allowed_updates", JSON.stringify(["callback_query"]));
    const res = await fetch(url, {
      signal: AbortSignal.timeout(Math.min(timeoutSec, 25) * 1000 + 10_000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as GetUpdatesReply;
    return (json.result ?? [])
      .filter((u) => u.callback_query && typeof u.update_id === "number")
      .map((u) => ({
        updateId: u.update_id!,
        data: String(u.callback_query!.data ?? ""),
        callbackQueryId: u.callback_query!.id,
      }));
  } catch {
    return [];
  }
}

/** Answer a callback query (stops the spinner in the Telegram UI). */
export async function answerTelegramCallback(callbackQueryId: string): Promise<void> {
  const creds = await telegramCreds();
  if (!creds) return;
  try {
    await fetch(`${API}/bot${creds.botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    });
  } catch {
    /* non-fatal */
  }
}

/* ------------------------------ bot diagnostics ----------------------------- */

interface BotUser {
  result?: { username?: string };
}

/** Bot identity (username only — never the token). null when not reachable. */
export async function telegramBotUsername(): Promise<string | null> {
  const botToken = await telegramBotToken();
  if (!botToken) return null;
  try {
    const res = await fetch(`${API}/bot${botToken}/getMe`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as BotUser;
    return json.result?.username ?? null;
  } catch {
    return null;
  }
}

interface ChatUpdate {
  message?: { chat?: { id?: number; title?: string; username?: string; type?: string; first_name?: string } };
  edited_message?: { chat?: { id?: number; title?: string; username?: string; type?: string; first_name?: string } };
}

interface AllUpdatesReply {
  result?: ChatUpdate[];
}

export interface TelegramChatSummary {
  id: string;
  title: string;
  type: string;
}

/**
 * Chats seen in recent updates — lets the owner discover the chat id by
 * messaging the bot once, then linking it. Token never leaves the server.
 */
export async function fetchTelegramChats(): Promise<TelegramChatSummary[]> {
  const botToken = await telegramBotToken();
  if (!botToken) return [];
  try {
    const res = await fetch(`${API}/bot${botToken}/getUpdates?limit=50`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as AllUpdatesReply;
    const chats = new Map<string, TelegramChatSummary>();
    for (const u of json.result ?? []) {
      const chat = u.message?.chat ?? u.edited_message?.chat;
      if (chat?.id === undefined) continue;
      const id = String(chat.id);
      if (!chats.has(id)) {
        chats.set(id, {
          id,
          title: chat.title ?? chat.first_name ?? chat.username ?? id,
          type: chat.type ?? "unknown",
        });
      }
    }
    return [...chats.values()];
  } catch {
    return [];
  }
}

/** Callback data builders — keep under the 64-byte Bot API limit. */
export function socialCallback(action: string, id: string): string {
  return `social:${action}:${id}`;
}

export function adCallback(action: string, id: string): string {
  return `ad:${action}:${id}`;
}

export function parseCallback(data: string): { kind: "social" | "ad" | "unknown"; action: string; id: string } {
  const [kind, action, id] = data.split(":");
  if (kind !== "social" && kind !== "ad") return { kind: "unknown", action: "", id: "" };
  return { kind, action: String(action ?? ""), id: String(id ?? "") };
}
