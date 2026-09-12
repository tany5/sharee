# Marketing AI

## Promo poster — bright ₹199 campaign creative (`promo_poster`)

Post kind **Promo poster (₹199)** in Admin → Marketing AI generates the
bright pop-style campaign poster (reference: Indian ecommerce ad aesthetic):

```
Ollama plans (palette, selling points, bg prompt, caption)
  → ComfyUI paints ONLY the background (SD1.5 Realistic_Vision, 2-pass, ~60-150 s on the GTX 1050 Ti)
  → sharp composes: bg + feathered hero (EXISTING model render) + EXACT text
  → Telegram/admin approval → Meta publish (unchanged flow, TEST MODE default)
```

Hard rules baked in (`lib/marketing/promo/`):

- **The image model never renders text.** "ALL SAREES / ₹199 / FLAT /
  SHOP NOW" are sharp/SVG from `PROMO_CAMPAIGN` constants — the price can
  never be misspelled. A product priced ≠ ₹199 refuses to build a promo
  poster (price protection).
- **The hero is never regenerated** — the existing front model render wins,
  else the first product photo (Rule 6).
- **Selling points** come only from the approved pool; palettes only from the
  six fixed palettes (`BRIGHT_POP`, `PINK_MAGENTA`, `YELLOW_RED`,
  `ROYAL_GOLD`, `BLUE_GOLD`, `FESTIVE`).
- Pollinations key missing / failed / slow? The poster silently uses a
  procedural brand gradient — generation never blocks on the cloud.

Modules: `promo/poster-plan.ts` (Ollama planner + validation),
`promo/poster-card.ts` (pure layout + palettes), `promo/poster-image.ts`
(sharp composer), `lib/marketing/pollinations.ts` (optional cloud client —
text→image backgrounds via `tongyi-mai/z-image-turbo`, image→image model ads
via `flux.1-kontext-pro`).

Env: `POLLINATIONS_API_KEY` (or the `pollinations_api_key` pipeline secret).
Set it to upgrade poster backgrounds from gradient to painted scenes —
nothing else changes. ComfyUI is no longer used by this pipeline.

Migration 0008 widens `social_posts.kind` with `promo_poster` (0006 already
includes it for fresh installs). If 0007 (`post_image_url`) is pending, run
it too.

## Branded post card (professional posts)

Every generated social post gets a locally composed **4:5 branded card**
(1080×1350) built from the product's EXISTING photo with `sharp` — no paid
image API, fully offline:

- top: full-bleed photo (dark scrim for legibility), brand chip `THETANTI`
  top-left, terracotta price badge (₹) top-right
- bottom: warm cream panel `#f6ebe1` with the terracotta accent bar, serif
  headline (product name, auto-fitted), caption body, and an
  `@theta.nti` + `site/sarees/slug` footer

Modules: `lib/marketing/post-card.ts` (pure layout, unit-tested) and
`lib/marketing/post-image.ts` (sharp composer). The card is stored on the
`social-media` bucket (`post_image_url`, migration 0007) and is what Meta
publishes, Telegram previews and the admin queue shows. Composition failure
never blocks the flow — posts fall back to the raw product image. — social posts + Meta ads (Ollama + Telegram approvals)

Local AI marketing layer **separate from the product photo pipeline**. The paid
Qwen Image Edit / Kaggle FLUX product flow (`lib/marketing/product-gallery.ts`,
`lib/marketing/qwen.ts`, `lib/marketing/tryon.ts`, `lib/marketing/kaggle.ts`) is
**untouched** — posts and ads never call Qwen Image Edit; they reuse the
product's EXISTING images.

## What it does

```
                        THE TANTI
                            │
             ┌──────────────┴──────────────┐
       PRODUCT AI (untouched)        MARKETING AI (this doc)
             │                             │
   Qwen Image Edit / Kaggle      LOCAL Ollama (qwen2.5:7b default)
             │                             │
      Saree photos                  ┌─────┴─────┐
             │                      │           │
             ▼                   SOCIAL         ADS
      Admin Marketing              │           │
      Studio                       ▼           ▼
                         Telegram APPROVE   Telegram APPROVE (1st)
                                   │           │
                            Facebook/IG    Meta PAUSED
                                   │           │
                             published    Telegram APPROVE (2nd)
                                               │
                                            ACTIVE (spends)
```

- **Organic social**: Ollama writes the caption from product facts; you approve
  it in Telegram or Admin → Marketing AI; it publishes one existing product
  image + caption to the Facebook Page and Instagram feed.
- **Ads**: Ollama writes ad copy; 1st approval creates campaign + adset +
  creative + ad on Meta **all PAUSED**; a **SECOND approval** is required
  before the ad is set ACTIVE and starts spending.
- Everything is idempotent (stable keys + persisted Meta ids) — retries never
  duplicate posts, campaigns, or actions (Rule 11).
- **TEST MODE is ON by default** (`SOCIAL_TEST_MODE` / `ADS_TEST_MODE` unset =
  true): Meta calls are simulated with `TEST-*` ids, so nothing can publish or
  spend on a fresh install.

## Files

| File | Role |
| --- | --- |
| `lib/marketing/ollama.ts` | Local LLM client (JSON mode, qwen2.5:7b default) |
| `lib/marketing/social.ts` | Pure social logic: prompts, parsers, state machine |
| `lib/marketing/social-engine.ts` | Social flow: generate/approve/edit/publish/regenerate |
| `lib/marketing/ads.ts` | Pure ads logic: two-approval machine, budget guards, Meta payloads |
| `lib/marketing/ads-engine.ts` | Ad flow: generate/approve/stage/activate/pause |
| `lib/marketing/telegram.ts` | Bot API: cards, callback polling, chat discovery |
| `lib/marketing/telegram-sync.ts` | Drains button presses → engine actions (offset-persisted) |
| `lib/marketing/ai-store.ts` | social_posts / ads / state (Supabase or demo JSON) |
| `app/api/admin/marketing-ai/*` | Admin API routes |
| `components/admin/admin-marketing-ai.tsx` | Admin → Marketing AI panel |
| `supabase/migrations/0006_marketing_ai.sql` | Tables + RLS + `social-media` bucket |
| `supabase/migrations/0007_social_post_image.sql` | `social_posts.post_image_url` (branded card) |

## 1. Install & run Ollama (free, local)

1. Install Ollama for Windows: https://ollama.com/download
2. Pull the model (one command): `ollama pull qwen2.5:7b`
3. Leave `ollama` running (it listens on `http://127.0.0.1:11434`).

The app talks to Ollama only when `OLLAMA_ENABLE=true` (or
`OLLAMA_TEXT_MODEL`/`OLLAMA_BASE_URL` is set). Without it the social/ad
generators use the honest deterministic template instead — the flow still
works end-to-end.

## 2. Environment variables (all optional; TEST MODE on by default)

Add to `.env.local` **or** store as rows in Supabase `app_secrets`
(`telegram_bot_token`, `telegram_chat_id`, `meta_ad_account_id`, …) — the
secrets loader checks the table first, then env, then the local token file:

| Variable | Purpose |
| --- | --- |
| `OLLAMA_ENABLE=true` | Turn on local Ollama generation |
| `OLLAMA_TEXT_MODEL` | Default `qwen2.5:7b` (do not switch to a hosted API) |
| `OLLAMA_BASE_URL` | Default `http://127.0.0.1:11434` |
| `OLLAMA_TIMEOUT_MS` | Default `90000` (7b needs time on CPU) |
| `TELEGRAM_BOT_TOKEN` | Bot token (also read from `secret/secret/telegrambot.txt`) |
| `TELEGRAM_BOT_TOKEN_FILE` | Override token-file path |
| `TELEGRAM_CHAT_ID` | Approval chat (auto-discoverable, see below) |
| `SOCIAL_TEST_MODE` | `false` = really publish to Facebook/Instagram |
| `ADS_TEST_MODE` | `false` = really create/activate Meta ads |
| `META_AD_ACCOUNT_ID` | e.g. `act_1234567890` (or the numeric id) |
| `META_AD_COUNTRY` | Geo targeting country, default `IN` |
| `META_AGE_MIN` / `META_AGE_MAX` | Age targeting, default 30–55 |
| `MARKETING_AI_DEMO_PATH` | Demo-mode data file override (smoke tests) |

Secrets never appear in logs or the admin UI (Rule 10).

## 3. Telegram setup (approval interface)

1. Create a bot with @BotFather → copy the token into
   `secret/secret/telegrambot.txt` (already wired — the file is read at
   runtime and never committed; JSON, `token: ...` lines, or a bare token all
   parse).
2. Open Admin → **Marketing AI**. The panel shows the token source and the
   bot username (verified via `getMe`).
3. **Message the bot once** (any text) or add it to your group, then reload
   the panel — your chat appears as a "Link" button. Click it: the chat id is
   stored server-side and a confirmation message is sent.
4. Press **Send test message** to confirm.

Approvals: every generated post/ad sends a Telegram card with buttons —
social `✅ Approve / ❌ Reject / 🔄 Regenerate`; ads
`✅ Approve (create PAUSED) / ❌ Reject / 🔄 Regenerate`, and once PAUSED a
second card with `🚀 ACTIVATE (₹X/day)`. Press **Sync Telegram** in the admin
panel (or hit `POST /api/admin/marketing-ai/telegram {action:"sync"}` from
n8n/cron) to drain button presses. Processed updates are persisted, so
nothing fires twice.

## 4. Supabase setup (production backend)

Run in the SQL editor:

```sql
-- 0006_marketing_ai.sql (already in supabase/migrations)
```

This creates `social_posts`, `ads`, `state` (all admin-only RLS) and the
public `social-media` bucket. Meta requires **public HTTPS** creative URLs —
when publishing/staging, local product images are uploaded to that bucket
once and reused.

Demo mode needs none of this (and cannot publish for real — TEST MODE only).

## 5. Meta ads setup (only when leaving ADS_TEST_MODE)

1. Business assets: a Facebook Page + ad account; the IG professional account
   must be linked to that Page (the same setup the reel pipeline already
   documents in `docs/marketing-pipeline.md`).
2. Secrets (env or `app_secrets`): `meta_page_access_token` (Page-scoped,
   with `ads_management` added), `meta_fb_page_id`, `meta_ig_user_id`,
   `meta_ad_account_id`.
3. Ads API v21: campaigns are created with `special_ad_categories: []`,
   adsets use `LOWEST_COST_WITHOUT_CAP` bidding and INR daily budgets
   (₹50–₹1000 guard rails, whole rupees), creatives use
   `object_story_spec.link_data.picture` (public URL) and every object is
   created `status=PAUSED`.
4. Add `ads_management` to the token's permissions before going live.

## 6. Testing what was actually tested

- `npm test` → 95 tests, including `lib/marketing/marketing-ai.test.ts`
  (parsers, state machines, budget guards, Meta payload builders, Telegram
  token-file parsing) and `lib/marketing/marketing-ai.smoke.test.ts`
  (**real engine flow**: generate → approve → publish; ad generate →
  approve+stage PAUSED → activate, idempotency on retries, reject →
  regenerate).
- `npm run typecheck`, `npm run lint` — clean (two pre-existing lint errors
  in `.probe-mask.cjs` are unrelated and predate this work).
- Manual TEST MODE run: Admin → Marketing AI → pick a product →
  **Generate social post** → Approve → Publish → the post shows
  `Published … · TEST ids`. Same for ads: **Generate ad** → Approve →
  `PAUSED (TEST ids)` → **ACTIVATE** → active with TEST ids. No Meta call is
  made while TEST MODE chips show TEST MODE.
- Verified against the live dev server (Supabase mode): admin auth + admin
  guard work, and the Marketing AI routes answer `503 needsMigration` with the
  0006 hint until you run the migration — no crashes, no half-states.

## 7. Going to production

1. Ollama: `ollama pull qwen2.5:7b`, set `OLLAMA_ENABLE=true`.
2. Telegram: token file + link the chat (§3).
3. Supabase: run migrations 0006 and 0007 (§4).
4. Social live: set `SOCIAL_TEST_MODE=false` (needs Supabase backend for
   public image URLs).
5. Ads live: set `ADS_TEST_MODE=false` (needs Supabase + Meta ad account +
   `ads_management` token). The spend path stays gated behind the Telegram/
   admin **ACTIVATE** second approval regardless.

## Known limitations

- Demo mode cannot publish for real (no public HTTPS URLs) — TEST MODE only,
  by design.
- Single-image posts/ads only (existing product photo); no video path here
  (the reel pipeline keeps its own flow).
- The Telegram sync runs when the admin panel is open or when something calls
  the sync endpoint — schedule it with n8n/cron for unattended approvals.
- Local Windows host: no webhook support assumed; polling `getUpdates` with a
  persisted offset is the designed path.
