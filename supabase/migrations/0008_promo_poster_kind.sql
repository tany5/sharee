-- ============================================================================
-- 0008 — Marketing AI: promo_poster creative kind
-- ----------------------------------------------------------------------------
-- social_posts.kind gains 'promo_poster' (the bright ₹199 campaign poster
-- composed with ComfyUI background + sharp text). For FRESH installs, 0006
-- already includes the new check (kept in sync). Safe to re-run.
-- ============================================================================

alter table public.social_posts
  drop constraint if exists social_posts_kind_check;

alter table public.social_posts
  add constraint social_posts_kind_check
  check (kind in ('product_feature','behind_the_loom','styling_tip','festive_pick','promo_poster'));

-- NOTE: if 0007 (social_posts.post_image_url) has not been applied yet, run it too:
--   alter table public.social_posts add column if not exists post_image_url text;
