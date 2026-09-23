/**
 * Chatbot IndexedDB — Dexie, mirroring lib/guest-db.ts conventions.
 *
 * Stores ONLY non-sensitive device-local convenience data:
 *   chat messages (text + rich blocks), chatbot preferences, and the local
 *   model's cache metadata. NEVER payment info, auth tokens, or order
 *   financial details (order blocks hold status fields the customer already
 *   sees on /track).
 *
 * Versioned schema; every API no-ops safely during SSR / private mode.
 */
import Dexie, { type EntityTable } from "dexie";
import type { ChatMessage } from "@/lib/ai/types/chat";

export const CHAT_DB_NAME = "thetanti-chat";
export const CHAT_DB_VERSION = 1;

/** History is capped so IndexedDB stays small; purge trims on write. */
export const CHAT_HISTORY_LIMIT = 60;

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: ChatMessage["role"];
  text: string;
  blocks?: ChatMessage["blocks"];
  origin?: ChatMessage["origin"];
  error?: boolean;
  createdAt: number;
  expiresAt: number;
}

export interface ChatMetaRecord {
  key: string;
  value: unknown;
}

export const chatDb = new Dexie(CHAT_DB_NAME) as Dexie & {
  chat_messages: EntityTable<ChatMessageRecord, "id">;
  meta: EntityTable<ChatMetaRecord, "key">;
};

chatDb.version(CHAT_DB_VERSION).stores({
  chat_messages: "id, sessionId, createdAt",
  meta: "key",
});

const hasIdb = () => typeof window !== "undefined" && "indexedDB" in window;

const TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

function expiry(): number {
  return Date.now() + TTL;
}

/* ---------------------------- chat history ------------------------------ */

export async function saveChatMessages(
  sessionId: string,
  messages: ChatMessage[],
): Promise<void> {
  if (!hasIdb()) return;
  try {
    const rows: ChatMessageRecord[] = messages
      .filter((m) => m.text || m.blocks?.length)
      .map((m) => ({
        id: m.id,
        sessionId,
        role: m.role,
        text: m.text,
        blocks: m.blocks,
        origin: m.origin,
        error: m.error,
        createdAt: m.createdAt,
        expiresAt: expiry(),
      }));
    if (rows.length === 0) return;
    await chatDb.chat_messages.bulkPut(rows);
    // Trim history beyond the cap, oldest first.
    const all = await chatDb.chat_messages.where("sessionId").equals(sessionId).toArray();
    const stale = all
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, Math.max(0, all.length - CHAT_HISTORY_LIMIT))
      .map((r) => r.id);
    if (stale.length) await chatDb.chat_messages.bulkDelete(stale);
  } catch {
    /* quota / private mode — chat still works without persistence */
  }
}

export async function loadChatHistory(sessionId: string): Promise<ChatMessage[]> {
  if (!hasIdb()) return [];
  try {
    const rows = await chatDb.chat_messages
      .where("sessionId")
      .equals(sessionId)
      .toArray();
    const now = Date.now();
    return rows
      .filter((r) => r.expiresAt > now)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((r) => ({
        id: r.id,
        role: r.role,
        text: r.text,
        blocks: r.blocks,
        origin: r.origin,
        error: r.error,
        createdAt: r.createdAt,
      }));
  } catch {
    return [];
  }
}

export async function clearChatHistory(sessionId: string): Promise<void> {
  if (!hasIdb()) return;
  try {
    await chatDb.chat_messages.where("sessionId").equals(sessionId).delete();
  } catch {
    /* ignore */
  }
}

/* -------------------------------- meta ---------------------------------- */

/** Small key/value store: chatbot prefs + local model cache metadata. */
export async function setChatMeta(key: string, value: unknown): Promise<void> {
  if (!hasIdb()) return;
  try {
    await chatDb.meta.put({ key, value });
  } catch {
    /* ignore */
  }
}

export async function getChatMeta<T>(key: string): Promise<T | null> {
  if (!hasIdb()) return null;
  try {
    const row = await chatDb.meta.get(key);
    return row ? (row.value as T) : null;
  } catch {
    return null;
  }
}
