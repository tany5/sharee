-- 0009 — Marketing AI: ai_model_ad social post kind
-- ----------------------------------------------------------------------------
-- social_posts.kind gains 'ai_model_ad': the Pollinations flux.1-kontext-pro
-- image-to-image creative (existing product photo → model-wearing-saree ad).
-- Purely additive; safe to re-run.
-- ============================================================================

alter table public.social_posts
  drop constraint if exists social_posts_kind_check;

alter table public.social_posts
  add constraint social_posts_kind_check
  check (kind in ('product_feature','behind_the_loom','styling_tip','festive_pick','promo_poster','ai_model_ad'));
