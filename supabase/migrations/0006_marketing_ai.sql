-- ============================================================================
-- 0006 — Marketing AI: social posts + ads (Telegram-approved, double-gated)
-- ----------------------------------------------------------------------------
-- Organic social + paid ads layer, separate from the product pipeline
-- (products.marketing stays untouched). Three admin-only tables:
--
--   social_posts — organic Facebook/Instagram posts
--       state: draft → pending_approval → approved → published
--              (draft|pending_approval → rejected)
--   ads         — Meta ad records with the TWO-approval gate
--       state: draft → pending_approval → approved → staged (PAUSED on Meta)
--              → pending_activation → active
--   state       — tiny key/value blob (Telegram getUpdates offset, etc.)
--
-- RLS: admins only (public.is_admin() from 0001). Storage: public read on the
-- new `social-media` bucket so Meta creatives can fetch public HTTPS URLs.
-- ============================================================================

create table if not exists public.social_posts (
  id               text primary key,
  key              text not null unique,
  product_slug     text not null,
  product_name     text not null,
  product_price    numeric not null default 199,
  product_category text not null default '',
  image_url        text not null,
  public_image_url text,
  kind             text not null check (kind in ('product_feature','behind_the_loom','styling_tip','festive_pick','promo_poster','ai_model_ad')),
  language         text not null check (language in ('hinglish','banglish')),
  caption          jsonb not null,
  engine           text not null default '',
  state            text not null check (state in ('draft','pending_approval','approved','published','rejected')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  generated_at     timestamptz,
  approved_at      timestamptz,
  published_at     timestamptz,
  rejected_reason  text,
  fb_post_id       text,
  ig_media_id      text,
  fb_photo_id      text,
  ig_image_id      text,
  publish_error    text
);

create index if not exists social_posts_state_idx on public.social_posts (state);
create index if not exists social_posts_product_idx on public.social_posts (product_slug);

create table if not exists public.ads (
  id                 text primary key,
  key                text not null unique,
  product_slug       text not null,
  product_name       text not null,
  product_price      numeric not null default 199,
  product_category   text not null default '',
  image_url          text not null,
  public_image_url   text,
  objective          text not null check (objective in ('OUTCOME_TRAFFIC','OUTCOME_ENGAGEMENT','OUTCOME_SALES')),
  destination        text not null default 'website' check (destination in ('website','whatsapp')),
  destination_url    text not null,
  language           text not null check (language in ('hinglish','banglish')),
  copy               jsonb not null,
  daily_budget_inr   integer not null check (daily_budget_inr between 50 and 1000),
  engine             text not null default '',
  state              text not null check (state in ('draft','pending_approval','approved','staged','pending_activation','active','paused','rejected')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  generated_at       timestamptz,
  first_approved_at  timestamptz,
  staged_at          timestamptz,
  second_approved_at timestamptz,
  activated_at       timestamptz,
  rejected_reason    text,
  meta_campaign_id   text,
  meta_adset_id      text,
  meta_creative_id   text,
  meta_ad_id         text,
  meta_status        text,
  staging_error      text
);

create index if not exists ads_state_idx on public.ads (state);
create index if not exists ads_product_idx on public.ads (product_slug);

-- Tiny key/value store (Telegram getUpdates offset, sync bookkeeping).
create table if not exists public.state (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS: admin-only for all three tables.
-- ---------------------------------------------------------------------------
alter table public.social_posts enable row level security;
alter table public.ads         enable row level security;
alter table public.state       enable row level security;

drop policy if exists social_posts_admin on public.social_posts;
create policy social_posts_admin on public.social_posts
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists ads_admin on public.ads;
create policy ads_admin on public.ads
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists marketing_ai_state_admin on public.state;
create policy marketing_ai_state_admin on public.state
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: public `social-media` bucket (Meta fetches creative images from
-- public HTTPS URLs). Admin manages; everyone reads.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('social-media', 'social-media', true)
on conflict (id) do update set public = true;

do $$
begin
  drop policy if exists "Marketing AI social read" on storage.objects;
  create policy "Marketing AI social read" on storage.objects
    for select
    using (bucket_id = 'social-media');

  drop policy if exists "Marketing AI social manage" on storage.objects;
  create policy "Marketing AI social manage" on storage.objects
    for all
    using (bucket_id = 'social-media' and public.is_admin())
    with check (bucket_id = 'social-media' and public.is_admin());
end $$;
