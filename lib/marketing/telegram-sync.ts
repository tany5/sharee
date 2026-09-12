/**
 * Telegram sync engine — drains pending callback queries (button presses)
 * and applies them to the social/ads records. Idempotent: the getUpdates
 * offset is persisted in the marketing-ai state blob, so processed updates
 * are never replayed (Rule 11 for actions, not just Meta objects).
 *
 * Called by POST /api/admin/marketing-ai/telegram (admin UI "Sync" button or
 * a local cron/n8n ping). No webhook URL is needed, so this works on a
 * Windows desktop behind NAT.
 */
import "server-only";
import {
  answerTelegramCallback,
  fetchTelegramCallbacks,
  parseCallback,
  sendTelegramMessage,
} from "@/lib/marketing/telegram";
import { getAiState, setAiState } from "@/lib/marketing/ai-store";
import {
  approveSocialPost,
  publishSocialPost,
  regenerateSocialPost,
  rejectSocialPost,
} from "@/lib/marketing/social-engine";
import {
  approveAd,
  activateAd,
  pauseAd,
  regenerateAd,
  rejectAd,
  stageAd,
} from "@/lib/marketing/ads-engine";

const OFFSET_KEY = "telegram_updates_offset";

export interface TelegramSyncResult {
  processed: number;
  actions: string[];
  errors: string[];
}

/** Process all pending Telegram callbacks. Never throws. */
export async function syncTelegramActions(): Promise<TelegramSyncResult> {
  const result: TelegramSyncResult = { processed: 0, actions: [], errors: [] };
  try {
    const offset = await getAiState<number>(OFFSET_KEY, 0);
    const callbacks = await fetchTelegramCallbacks(0, offset);
    if (callbacks.length === 0) return result;

    // Telegram offsets are monotonic: confirm the highest update id seen.
    const maxUpdateId = Math.max(...callbacks.map((c) => c.updateId));

    for (const cb of callbacks) {
      try {
        const { kind, action, id } = parseCallback(cb.data);
        let outcome = "";
        if (kind === "social") {
          outcome = await handleSocialAction(action, id);
        } else if (kind === "ad") {
          outcome = await handleAdAction(action, id);
        } else {
          outcome = "Unknown action";
        }
        result.actions.push(outcome);
      } catch (err) {
        result.errors.push(`${cb.data}: ${(err as Error).message}`);
      } finally {
        result.processed += 1;
        if (cb.callbackQueryId) await answerTelegramCallback(cb.callbackQueryId);
      }
    }
    await setAiState(OFFSET_KEY, maxUpdateId + 1);
    if (result.errors.length > 0) {
      await sendTelegramMessage(
        `⚠️ Marketing AI: ${result.errors.length} action(s) failed:\n${result.errors.map((e) => `• ${e}`).join("\n")}`,
      );
    }
  } catch (err) {
    result.errors.push((err as Error).message);
  }
  return result;
}

async function handleSocialAction(action: string, id: string): Promise<string> {
  switch (action) {
    case "approve": {
      await approveSocialPost(id, "telegram");
      const { post, simulated } = await publishSocialPost(id, "telegram");
      await sendTelegramMessage(
        simulated
          ? `🧪 TEST MODE — post for ${post.productName} marked published (nothing went live).`
          : `🚀 Published to Facebook + Instagram: ${post.productName}`,
      );
      return `social ${id}: approved + published`;
    }
    case "reject": {
      const post = await rejectSocialPost(id, "Rejected via Telegram", "telegram");
      await sendTelegramMessage(`🗑 Post for ${post.productName} rejected.`);
      return `social ${id}: rejected`;
    }
    case "regen": {
      const post = await regenerateSocialPost(id);
      return `social ${id}: regenerated (${post.engine})`;
    }
    default:
      return `social ${id}: unknown action "${action}"`;
  }
}

async function handleAdAction(action: string, id: string): Promise<string> {
  switch (action) {
    case "approve": {
      const ad = await approveAd(id, "telegram");
      const { ad: staged, simulated } = await stageAd(ad.id);
      await sendTelegramMessage(
        simulated
          ? `🧪 TEST MODE — ad for ${staged.productName} created PAUSED (no Meta objects, no spending).`
          : `⏸ Ad for ${staged.productName} created on Meta in PAUSED state.\nBudget ₹${staged.dailyBudgetInr}/day. A SECOND approval is required to start spending.`,
      );
      await notifyAdCardForActivation(staged.id);
      return `ad ${id}: approved + staged PAUSED`;
    }
    case "activate": {
      const ad = await activateAd(id, "telegram");
      await sendTelegramMessage(
        `🚀 Ad for ${ad.productName} is ACTIVE — spending ₹${ad.dailyBudgetInr}/day.`,
      );
      return `ad ${id}: activated (2nd approval)`;
    }
    case "reject": {
      const ad = await rejectAd(id, "Rejected via Telegram", "telegram");
      await sendTelegramMessage(`🗑 Ad for ${ad.productName} rejected.`);
      return `ad ${id}: rejected`;
    }
    case "regen": {
      const ad = await regenerateAd(id);
      return `ad ${id}: regenerated (${ad.engine})`;
    }
    case "pause": {
      const ad = await pauseAd(id);
      await sendTelegramMessage(`⏸ Ad for ${ad.productName} paused.`);
      return `ad ${id}: paused`;
    }
    default:
      return `ad ${id}: unknown action "${action}"`;
  }
}

/** Re-send the activation card (2nd approval) for a staged ad. */
async function notifyAdCardForActivation(id: string): Promise<void> {
  const { getAd } = await import("@/lib/marketing/ai-store");
  const { notifyAdCard } = await import("@/lib/marketing/ads-engine");
  const ad = await getAd(id);
  if (ad) await notifyAdCard(ad);
}
