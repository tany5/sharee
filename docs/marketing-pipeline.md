# AI Marketing Pipeline — "Saree → Reel" Automation

The Marketing Studio (**Admin → Marketing Studio**) turns a product into a
published Facebook Page video + Instagram Reel — automatically:

```
Queue product (pending)
      ↓
Stage 2 · AI Virtual Try-On   → CatVTON on Hugging Face Spaces (free)
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
  ('local_tryon_url',        'http://127.0.0.1:8787/model-images'),
  ('tryon_space_id',         'zhengchong/CatVTON'),
  ('hf_token',               '<optional free Hugging Face token>')
on conflict (name) do update set value = excluded.value;
```

| Missing key | Behaviour |
| --- | --- |
| gemini_api_key | tries Groq, then a deterministic Hinglish template |
| groq_api_key | (only used if Gemini fails/missing) |
| meta_* (any) | publish stage fails with the missing names listed — try-on/copy/reel are kept |
| local_tryon_url | falls back to Hugging Face Spaces |
| tryon_space_id | uses IDM-VTON first (verified working), then CatVTON as fallback |
| hf_token | anonymous Hugging Face requests are used |

> **`hf_token` is strongly recommended.** The try-on Spaces run on ZeroGPU,
> which rations *anonymous* traffic harshly — a few renders per IP, then
> `GPU quota exhausted` errors. A **free** Hugging Face token
> (huggingface.co → Settings → Access Tokens) lifts the quota massively and
> takes one minute to add to `app_secrets`.

### Product photos on upload (resumable generation)

When you upload a saree photo in **Admin → Add a saree**, the product saves
instantly; the editor then generates **front / side / back photos of a model
wearing your saree** (IDM-VTON, full-body drape). Generation is *resumable*:
each request generates what it can inside a ~55 s budget and saves every photo
the moment it lands — if a GPU queue stalls or the quota runs out mid-way, the
generated photos are kept and "Generate wearing photos" (or the automatic
retry) resumes with the missing poses only.

Env fallbacks (`GEMINI_API_KEY`, `GROQ_API_KEY`, `META_PAGE_ACCESS_TOKEN`,
`META_FB_PAGE_ID`, `META_IG_USER_ID`, `LOCAL_TRYON_URL`, `TRYON_SPACE_ID`,
`HF_TOKEN`) work in demo mode.

### Local try-on endpoint

For best free try-on quality, run CatVTON on a free Google Colab T4 and set
`local_tryon_url` / `LOCAL_TRYON_URL` to the public `/tryon` endpoint. The app
prefers that external endpoint first because it uses the uploaded saree image
directly. If no external endpoint is configured, the admin photo generator
checks the local TheTanti engine at `http://127.0.0.1:8787/model-images`. Keep
`D:\TheTanti-AI\start-comfyui.cmd` and `D:\TheTanti-AI\start-engine.cmd`
running for that fallback.

The Colab runner lives at `D:\TheTanti-AI\colab`:

- `catvton_colab_endpoint.py`: FastAPI wrapper around the official CatVTON
  pipeline.
- `README.md`: Colab install, Cloudflare tunnel and store connection steps.

The local engine accepts JSON:

- `slug`
- `pose`: `front`, `side`, `back` or `full_saree`
- `name`, `color`, `fabric`
- `image_path`: temporary copy of the uploaded saree photo

Each local run writes the generated catalogue image to
`D:\TheTanti-AI\generated\local-images` and a matching full-body saree mask to
`D:\TheTanti-AI\generated\masks`. The mask is white where ComfyUI should replace
the blouse, pallu, pleats and lower drape, and black where it should preserve
face, hair, hands, feet and background.

Every completed try-on image is also copied on this PC to
`D:\TheTanti-AI\generated\tryon-downloads` before it is uploaded into the
product gallery. Override the folder with `TRYON_DOWNLOAD_DIR` if needed.

For front/side/back/full model views with the same face, upload a pose set in
**Admin -> Saree Models** using the same model name plus pose suffixes, for
example `brand-model-front.jpg`, `brand-model-side.jpg`,
`brand-model-back.jpg`, `brand-model-full_saree.jpg`. Workflow B will choose
the matching pose image when calling CatVTON.

## 3. Base models (Stage 2 avatars)

The free workflow ships with synthetic AI base models, so the built-in choices
do not depend on third-party model photography. If you want a custom brand
look, upload 2–3 brand-owned model photos in simple postures via
**Admin → Saree Models → Upload model**. They land in the
`base-models` bucket and are assigned to products deterministically.

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
  from the open-source CatVTON or IDM-VTON repo and set `tryon_space_id`.
  A local **mock render** is the final fallback for non-product marketing
  demos/CI.
- **Renders are ~10–20 s** (ffmpeg-static, bundled — no ffmpeg install
  needed); try-on is 1–8 min depending on Space queue.
- **Music**: reels are silent by design; add an audio track later by
  extending `lib/marketing/video.ts` (`-i music.mp3 -map … -shortest`).
- **Cron**: point a scheduled job at
  `POST /api/admin/marketing/advance` with an admin session to walk the
  queue without the UI.
