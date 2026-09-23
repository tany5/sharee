/**
 * Chat-history facade — session identity + load/save via lib/ai/storage.
 * Session ids are random device-local strings (no personal info).
 */
import type { ChatMessage } from "@/lib/ai/types/chat";
import {
  clearChatHistory,
  getChatMeta,
  loadChatHistory,
  saveChatMessages,
  setChatMeta,
} from "./indexeddb";

const SESSION_KEY = "chatSessionId";

function newSessionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** Stable per-device chat session id (persisted in IndexedDB meta). */
export async function getOrCreateSessionId(): Promise<string> {
  const existing = await getChatMeta<string>(SESSION_KEY);
  if (existing) return existing;
  const id = newSessionId();
  await setChatMeta(SESSION_KEY, id);
  return id;
}

export async function loadHistory(sessionId: string): Promise<ChatMessage[]> {
  return loadChatHistory(sessionId);
}

export async function persistHistory(
  sessionId: string,
  messages: ChatMessage[],
): Promise<void> {
  await saveChatMessages(sessionId, messages);
}

export async function clearHistory(sessionId: string): Promise<void> {
  await clearChatHistory(sessionId);
}
