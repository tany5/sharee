-- ============================================================================
-- TheTanti Marketing AI — combined migration (0007 + 0008 + 0009)
-- Paste this WHOLE FILE into: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run; purely additive.
-- ============================================================================

-- 0007: branded 4:5 post card column
alter table public.social_posts
  add column if not exists post_image_url text;

-- 0008 + 0009: allow the new post kinds (promo poster, AI model ad)
alter table public.social_posts
  drop constraint if exists social_posts_kind_check;

alter table public.social_posts
  add constraint social_posts_kind_check
  check (kind in ('product_feature','behind_the_loom','styling_tip','festive_pick','promo_poster','ai_model_ad'));
