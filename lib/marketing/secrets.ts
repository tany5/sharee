/**
 * Pipeline secrets — Gemini/Groq keys, Meta page token.
 *
 * Supabase mode: keys live in `public.app_secrets` (same table Razorpay
 * secrets use; RLS blocks all direct reads, the pipeline reads via the
 * security-definer `get_pipeline_secret` RPC added in migration 0005).
 * Demo mode / local dev: env fallbacks (GEMINI_API_KEY, GROQ_API_KEY,
 * META_PAGE_ACCESS_TOKEN) so the pipeline is testable locally.
 */
import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { META_GRAPH_BASE } from "@/lib/marketing/meta-graph";
import { supabaseServer } from "@/lib/supabase/server";

const GRAPH = META_GRAPH_BASE;

export interface PipelineSecrets {
  geminiKey?: string;
  groqKey?: string;
  qwenKey?: string;
  metaPageToken?: string;
  igUserId?: string;
  fbPageId?: string;
  tryOnSpace?: string;
  localTryOnUrl?: string;
  hfToken?: string;
  musicUrl?: string;
  /** Marketing-AI additions (social/ads layer) — optional, additive. */
  telegramBotToken?: string;
  telegramChatId?: string;
  metaAdAccountId?: string;
  pollinationsKey?: string;
}

const SECRET_NAMES = [
  "gemini_api_key",
  "groq_api_key",
  "qwen_api_key",
  "dashscope_api_key",
  "meta_page_access_token",
  "meta_ig_user_id",
  "meta_fb_page_id",
  "tryon_space_id",
  "local_tryon_url",
  "hf_token",
  "music_url",
  "telegram_bot_token",
  "telegram_chat_id",
  "meta_ad_account_id",
  "pollinations_api_key",
] as const;

async function readSecret(name: string): Promise<string | undefined> {
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.rpc("get_pipeline_secret", { p_name: name });
    if (error || !data) return undefined;
    return typeof data === "string" && data ? data : undefined;
  } catch {
    return undefined;
  }
}

function readLocalMetaFile(): Pick<PipelineSecrets, "metaPageToken" | "fbPageId" | "igUserId"> {
  const file = path.resolve(process.cwd(), "secret", "secret", "meta.txt");
  if (!existsSync(file)) return {};
  try {
    const raw = readFileSync(file, "utf8");
    const token = /^\s*Access\s+Token\s*=\s*(.+?)\s*$/im.exec(raw)?.[1]?.trim();
    const pageId = /^\s*Pageid\s*=\s*(.+?)\s*$/im.exec(raw)?.[1]?.trim();
    let igUserId: string | undefined;
    const jsonStart = raw.indexOf("{");
    if (jsonStart >= 0) {
      try {
        const parsed = JSON.parse(raw.slice(jsonStart)) as {
          instagram_business_account?: { id?: unknown };
        };
        igUserId =
          typeof parsed.instagram_business_account?.id === "string"
            ? parsed.instagram_business_account.id
            : undefined;
      } catch {
        /* ignore malformed JSON block */
      }
    }
    return {
      metaPageToken: token || undefined,
      fbPageId: pageId || undefined,
      igUserId,
    };
  } catch {
    return {};
  }
}

export async function loadPipelineSecrets(): Promise<PipelineSecrets> {
  const localMeta = readLocalMetaFile();
  const [
    geminiKey,
    groqKey,
    qwenKey,
    dashscopeKey,
    metaPageToken,
    igUserId,
    fbPageId,
    tryOnSpace,
    localTryOnUrl,
    hfToken,
    musicUrl,
    telegramBotToken,
    telegramChatId,
    metaAdAccountId,
    pollinationsKey,
  ] =
    await Promise.all(SECRET_NAMES.map(readSecret));
  return {
    geminiKey: geminiKey ?? process.env.GEMINI_API_KEY,
    groqKey: groqKey ?? process.env.GROQ_API_KEY,
    qwenKey: qwenKey ?? dashscopeKey ?? process.env.QWEN_API_KEY ?? process.env.DASHSCOPE_API_KEY,
    metaPageToken: metaPageToken ?? process.env.META_PAGE_ACCESS_TOKEN ?? localMeta.metaPageToken,
    igUserId: igUserId ?? process.env.META_IG_USER_ID ?? localMeta.igUserId,
    fbPageId: fbPageId ?? process.env.META_FB_PAGE_ID ?? localMeta.fbPageId,
    tryOnSpace: tryOnSpace ?? process.env.TRYON_SPACE_ID,
    localTryOnUrl: localTryOnUrl ?? process.env.LOCAL_TRYON_URL,
    hfToken: hfToken ?? process.env.HF_TOKEN ?? process.env.HUGGINGFACE_TOKEN,
    musicUrl: musicUrl ?? process.env.MUSIC_URL,
    telegramBotToken: telegramBotToken ?? process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: telegramChatId ?? process.env.TELEGRAM_CHAT_ID,
    metaAdAccountId: metaAdAccountId ?? process.env.META_AD_ACCOUNT_ID,
    pollinationsKey: pollinationsKey ?? process.env.POLLINATIONS_API_KEY,
  };
}

export async function resolveMetaPageToken(secrets: PipelineSecrets): Promise<string | undefined> {
  if (!secrets.metaPageToken || !secrets.fbPageId) return secrets.metaPageToken;
  try {
    const url = new URL(`${GRAPH}/me/accounts`);
    url.searchParams.set("fields", "id,name,access_token");
    url.searchParams.set("access_token", secrets.metaPageToken);
    const res = await fetch(url);
    const json = (await res.json()) as {
      data?: { id?: string; access_token?: string }[];
      error?: { message?: string };
    };
    if (!res.ok || json.error) return secrets.metaPageToken;
    const page = json.data?.find((p) => p.id === secrets.fbPageId);
    return page?.access_token || secrets.metaPageToken;
  } catch {
    return secrets.metaPageToken;
  }
}
