/**
 * Backend selector. The app runs in one of two modes:
 *
 *  - demo (default)  — the file-backed store in `.demo-data/db.json` + uploads.
 *                      Zero accounts needed; used for local dev & previews.
 *  - supabase         — real Supabase database + Auth + the public "Sharee"
 *                      storage bucket. Activated when env keys are present AND
 *                      NEXT_PUBLIC_USE_SUPABASE is truthy ("true"/"1").
 *
 * The switch is deliberate so a partially provisioned Supabase project never
 * breaks local development: add the keys to `.env.local`, run
 * supabase/migrations/0001_init.sql in the SQL editor, then set
 * NEXT_PUBLIC_USE_SUPABASE=true.
 */
export function isSupabaseBackend(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const flag = process.env.NEXT_PUBLIC_USE_SUPABASE?.trim().toLowerCase();
  return Boolean(url && key && (flag === "true" || flag === "1"));
}

/** Human label for the README/admin login hint. */
export function backendName(): "Supabase" | "Demo store" {
  return isSupabaseBackend() ? "Supabase" : "Demo store";
}

export const SUPABASE_STORAGE_BUCKET = "Sharee";
