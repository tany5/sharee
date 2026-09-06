# AI Marketing Pipeline — "Saree → Reel" Automation

The Marketing Studio (**Admin → Marketing Studio**) turns a product into a
published Facebook Page video + Instagram Reel — automatically:

```
Queue product (pending)
      ↓
Stage 2 · AI Virtual Try-On   → IDM-VTON on Hugging Face Spaces (free)
      ↓                         renders the saree draped on a model
Stage 3 · Vernacular Ad Copy  → Gemini Flash → Groq → template fallback
      ↓                         (Hinglish/Banglish, ₹199 + COD contract)
Stage 4 · Vertical Reel       → FFmpeg (local, free): 1080×1920, two 5s
      ↓                         scenes, price banner, brand line
Stage 5 · Auto-Publish        → Facebook Page video + Instagram Reel
      ↓                         (Meta Graph API v21)
published
```

State machine (stored on each product, `products.marketing` jsonb):

```
pending → tryon_processing → tryon_completed → rendering_video
        → publishing → published          (any step → failed)
```

Any failure records the exact error on the row and stops — the admin can
**Retry** (from the failed step) or **Cancel** from the Marketing Studio.
Every "Advance"/"Process queue" click runs exactly one stage per product,
so long AI renders never block the UI.

---

## 1. One-time database setup (Supabase SQL editor)

Run both files, in order, from this repo:

1. `supabase/migrations/0004_marketing_pipeline.sql`
   — adds `products.marketing` + `marketing_updated_at`, extends the
   `db_status` check with the pipeline states, creates the `ensure_category`
   (case-insensitive category upsert) and `advance_marketing` helpers,
   an auto-enqueue INSERT trigger, and the public storage buckets
   `base-models`, `model-renders`, `reels`.

2. `supabase/migrations/0005_pipeline_secrets.sql`
   — adds `get_pipeline_secret()` (security-definer) so the pipeline can
   read API keys from `app_secrets` without any service-role key.

The admin UI detects a missing schema and shows a setup banner instead of
erroring.

## 2. Secrets (Supabase → SQL editor)

All are **optional** — the pipeline degrades gracefully:

```sql
insert into public.app_secrets (name, value) values
  ('gemini_api_key',         '<GEMINI_KEY — free: aistudio.google.com>'),
  ('groq_api_key',           '<GROQ_KEY — free: console.groq.com>'),
  ('meta_page_access_token', '<long-lived Page token>'),
  ('meta_fb_page_id',        '<Facebook Page id>'),
  ('meta_ig_user_id',        '<IG professional account id linked to the Page>'),
  ('tryon_space_id',         'yisol/IDM-VTON')
on conflict (name) do update set value = excluded.value;
```

| Missing key | Behaviour |
| --- | --- |
| gemini_api_key | tries Groq, then a deterministic Hinglish template |
| groq_api_key | (only used if Gemini fails/missing) |
| meta_* (any) | publish stage fails with the missing names listed — try-on/copy/reel are kept |
| tryon_space_id | uses `yisol/IDM-VTON` |

Env fallbacks (`GEMINI_API_KEY`, `GROQ_API_KEY`, `META_PAGE_ACCESS_TOKEN`,
`META_FB_PAGE_ID`, `META_IG_USER_ID`, `TRYON_SPACE_ID`) work in demo mode.

## 3. Base models (Stage 2 avatars)

Upload 2–3 photos of real Indian women in simple postures (home / veranda
backdrops) via **Marketing Studio → Base models → Add model photo**. They
land in the `base-models` bucket and are assigned to products
deterministically. Until then a built-in default avatar is used.

## 4. Running the pipeline

1. **Admin → Marketing Studio** → pick products from the catalogue →
   **Queue selected**.
2. Press **Process queue** (or **Auto-run**, which advances every 20 s)
   until everything reads **published**.
3. Watch each row's progress rail: `queued → try-on → reel → publish`.
   The try-on render, generated copy and the playable reel appear inline.

Queueing sets `db_status='pending'` (Supabase) and an INSERT trigger
re-links the category case-insensitively — inserting pending products via
SQL/bulk import also auto-enqueues them.

## 5. Meta publishing (Stage 5)

1. A Facebook Page + an Instagram **professional** account linked to it.
2. A long-lived Page access token with `pages_manage_posts`,
   `instagram_basic`, `instagram_content_publish`
   (generate via Graph API Explorer → exchange for a long-lived token).
3. Store the token + both ids in `app_secrets` (above).

FB posts the MP4 by public URL; IG creates an async REELS container, the
pipeline polls until Meta reports `FINISHED`, then publishes. One platform
failing doesn't block the other.

**Note:** Meta requires the video URL to be publicly reachable — on Vercel
the reels bucket is public, so this works; on localhost the publish stage
will fail with a Meta-side error (everything else still runs).

## 6. Operational notes

- **ZeroGPU quota**: anonymous Space calls get limited free GPU minutes per
  IP; when exhausted the Space errors. Retry later or deploy your own Space
  from the open-source IDM-VTON repo and set `tryon_space_id`. A local
  **mock render** is the final fallback so demos/CI never break.
- **Renders are ~10–20 s** (ffmpeg-static, bundled — no ffmpeg install
  needed); try-on is 1–8 min depending on Space queue.
- **Music**: reels are silent by design; add an audio track later by
  extending `lib/marketing/video.ts` (`-i music.mp3 -map … -shortest`).
- **Cron**: point a scheduled job at
  `POST /api/admin/marketing/advance` with an admin session to walk the
  queue without the UI.
