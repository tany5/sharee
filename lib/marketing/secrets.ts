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
import { supabaseServer } from "@/lib/supabase/server";

export interface PipelineSecrets {
  geminiKey?: string;
  groqKey?: string;
  metaPageToken?: string;
  igUserId?: string;
  fbPageId?: string;
  tryOnSpace?: string;
}

const SECRET_NAMES = [
  "gemini_api_key",
  "groq_api_key",
  "meta_page_access_token",
  "meta_ig_user_id",
  "meta_fb_page_id",
  "tryon_space_id",
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

export async function loadPipelineSecrets(): Promise<PipelineSecrets> {
  const [geminiKey, groqKey, metaPageToken, igUserId, fbPageId, tryOnSpace] =
    await Promise.all(SECRET_NAMES.map(readSecret));
  return {
    geminiKey: geminiKey ?? process.env.GEMINI_API_KEY,
    groqKey: groqKey ?? process.env.GROQ_API_KEY,
    metaPageToken: metaPageToken ?? process.env.META_PAGE_ACCESS_TOKEN,
    igUserId: igUserId ?? process.env.META_IG_USER_ID,
    fbPageId: fbPageId ?? process.env.META_FB_PAGE_ID,
    tryOnSpace: tryOnSpace ?? process.env.TRYON_SPACE_ID,
  };
}
