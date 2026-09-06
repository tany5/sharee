-- ---------------------------------------------------------------------------
-- 0005 — Pipeline secrets RPC.
--
-- Pipeline keys (Gemini/Groq, Meta page token, IG/FB ids, try-on space) live
-- in public.app_secrets — the same table Razorpay secrets use. RLS blocks all
-- direct reads; this security-definer RPC is the only read path, and it is
-- callable by authenticated users (the app routes further gate on is_admin).
--
-- Seed keys once (values optional — the pipeline degrades gracefully and
-- falls back to templates/mock when a key is missing):
--
--   insert into public.app_secrets (name, value) values
--     ('gemini_api_key',          '<YOUR_GEMINI_KEY>'),
--     ('groq_api_key',            '<YOUR_GROQ_KEY>'),
--     ('meta_page_access_token',  '<LONG_LIVED_PAGE_TOKEN>'),
--     ('meta_ig_user_id',         '<IG_PROFESSIONAL_ACCOUNT_ID>'),
--     ('meta_fb_page_id',         '<FACEBOOK_PAGE_ID>'),
--     ('tryon_space_id',          'Kwai-Kolors/Kolors-Virtual-Try-On')
--   on conflict (name) do update set value = excluded.value;
-- ---------------------------------------------------------------------------

create or replace function public.get_pipeline_secret(p_name text)
returns text
language sql
security definer
set search_path = public
as $$
  select value from public.app_secrets where name = p_name;
$$;

grant execute on function public.get_pipeline_secret to authenticated;
