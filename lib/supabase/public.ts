/**
 * Cookie-less public Supabase client for catalogue reads.
 *
 * The request-scoped client (lib/supabase/server.ts) reads cookies, which
 * forces every storefront page to be fully dynamic and makes the results
 * uncacheable. Public catalogue data (active products, categories) is
 * readable by the anon role through RLS, so it does not need a user session.
 *
 * This client uses no cookies and no per-request state, which makes it safe
 * to call inside unstable_cache — the foundation of the storefront catalogue
 * cache (lib/data/catalogue-cache.ts).
 *
 * Never use this client for orders, profiles, or admin writes — those must
 * stay on the request-scoped RLS client.
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function supabasePublic(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env vars are not configured");
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
