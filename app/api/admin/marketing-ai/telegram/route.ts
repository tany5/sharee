import { NextResponse } from "next/server";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";
import {
  fetchTelegramChats,
  sendTelegramMessage,
  telegramBotUsername,
  telegramStatus,
} from "@/lib/marketing/telegram";
import { syncTelegramActions } from "@/lib/marketing/telegram-sync";
import { getAiState, setAiState } from "@/lib/marketing/ai-store";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/marketing-ai/telegram
 * Connection status (token source / bot username / candidate chats / linked
 * chat) — never returns the token itself.
 */
export async function GET() {
  if (!(await requireAdmin())) return unauthorized();
  try {
    const status = await telegramStatus();
    const username = await telegramBotUsername();
    const chats = await fetchTelegramChats();
    const linked = await getAiState<string | undefined>("telegram_chat_id", undefined);
    return NextResponse.json({
      ok: true,
      ...status,
      botUsername: username,
      chats,
      linkedChatId: typeof linked === "string" ? linked : null,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 503 });
  }
}

/**
 * POST /api/admin/marketing-ai/telegram
 * Body: { action: "link" | "test" | "sync", chatId? }
 *   link — store the chat id (owner picked one from GET chats) in state
 *   test — send a confirmation message to the linked chat
 *   sync — drain Telegram button presses (approve/reject/activate callbacks)
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();

  let body: { action?: string; chatId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const action = String(body.action ?? "");
  try {
    if (action === "link") {
      const chatId = String(body.chatId ?? "").trim();
      if (!/^-?\d+$/.test(chatId)) {
        return NextResponse.json({ ok: false, error: "chatId must be numeric" }, { status: 400 });
      }
      await setAiState("telegram_chat_id", chatId);
      await sendTelegramMessage("✅ TheTanti Marketing AI linked to this chat.");
      return NextResponse.json({ ok: true, linkedChatId: chatId });
    }
    if (action === "test") {
      await sendTelegramMessage("🧪 Test message from TheTanti Marketing AI.");
      return NextResponse.json({ ok: true });
    }
    if (action === "sync") {
      const result = await syncTelegramActions();
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json(
      { ok: false, error: "Expected action link|test|sync" },
      { status: 400 },
    );
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}
