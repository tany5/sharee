-- ============================================================================
-- 0007 — Marketing AI: branded 4:5 post card for social posts
-- ----------------------------------------------------------------------------
-- Adds public.social_posts.post_image_url: the locally composed card
-- (product photo + cream copy panel with headline / price / handle) that is
-- published to Meta instead of the raw product image. Purely additive —
-- safe to re-run; existing rows keep NULL (they show the raw image).
-- ============================================================================

alter table public.social_posts
  add column if not exists post_image_url text;
