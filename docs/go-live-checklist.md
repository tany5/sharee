# TheTanti — Merge & Deploy Runbook (Chatbot + Tracking + Stock)

Everything currently on branch `codex/reels-ai-backend-video` is uncommitted.
This runbook takes it from local → GitHub → Vercel production, including the
Supabase SQL that must run BEFORE the new code goes live.

**Order matters:** SQL first (step B), then deploy (steps C–E). The tracking
API returns "not found" until `track_order()` exists; everything else keeps
working either way, but the SQL takes 2 minutes so do it first.

---

## A. Commit & push to GitHub (5 min)

Work in the repo root (`D:\thetanti`). One commit is fine — it's one feature
wave. If you prefer several, keep the file groups below together.

```bash
# 1. Stage exactly the feature files (from repo root)
git add app/(store)/layout.tsx \
        "app/(store)/account/orders" "app/(store)/track" \
        "app/admin/(panel)/orders/[id]" app/api/orders/track \
        app/api/admin/orders app/globals.css \
        components/account components/admin components/order \
        components/product components/chatbot \
        lib/ai lib/backend lib/demo lib/notify lib/supabase lib/types.ts \
        lib/tracking.ts lib/tracking.test.ts lib/demo/stock-flow.test.ts \
        public/ai docs/thetanti-chatbot.md \
        supabase/migrations package.json package-lock.json vitest.config.ts

# 2. Sanity: these should NOT be staged (local-only clutter)
#    .admin-cookie.txt .after-batch.ps1 .drape-* .wrangler-dev.log
#    .e2e-ck.txt dev-server.log .probe-mask.cjs sample-promo-poster.* .env.local
git status --short | grep "^?? \."

# 3. Commit
git commit -m "feat: AI shopping assistant, courier tracking, stock RPCs, invoices

- Floating chatbot: local browser LLM (Transformers.js via CDN, WebGPU with
  WASM fallback), deterministic intents, keyword RAG over site knowledge,
  validated product/order/cart tools, IndexedDB history. No AI API keys,
  nothing AI in server bundles.
- Public /track page + /api/orders/track (order number + phone auth).
- Order invoices (customer + admin) with print-to-PDF.
- Migration 0011: courier/AWB columns, decrement_stock/restock_order RPCs,
  phone-gated track_order() - paste-safe SQL-editor edition included."

# 4. Push the branch
git push -u origin codex/reels-ai-backend-video
```

### Merge to main — pick ONE of these two ways

**Way 1 — GitHub PR (recommended, gives you a review page):**
1. Open `https://github.com/tany5/sharee` — you'll see a yellow bar:
   "codex/reels-ai-backend-video had recent pushes" → **Compare & pull request**.
2. Base: `main` ← Compare: `codex/reels-ai-backend-video` → **Create pull request**.
3. **Merge pull request** → **Confirm merge**.

**Way 2 — Merge locally:**
```bash
git checkout main
git pull origin main
git merge codex/reels-ai-backend-video
git push origin main
```

**Pre-commit gate (already green, re-run to be sure):**
```bash
npm run typecheck && npm test && npm run build
```

---

## B. Supabase — run migration 0011 (2 min, do BEFORE deploying)

Dashboard → your project → **SQL Editor** → paste **the whole file**:

```
supabase/migrations/0011_stock_tracking_sqleditor.sql
```

(paste-safe edition - named dollar-tag function bodies, zero quote-escaping;
the original `0011_stock_tracking.sql` also works in psql/CLI but has tripped
on dashboard pastes)

**Paste hygiene (both failed attempts were partial/mangled copies):**
copy from the FILE, not from chat. Open the file in VS Code/Notepad → Ctrl+A,
Ctrl+C → in the SQL Editor Ctrl+A then Ctrl+V (replace everything) → Run.
Before hitting Run, sanity-check: ~197 lines total, first line starts with
`-- ============`, last line is a `grant execute ...` statement.

**Verify it worked — run each, expect a result not an error:**
```sql
select proname from pg_proc where proname in
  ('decrement_stock','restock_order','track_order');
-- expect 3 rows

select column_name from information_schema.columns
 where table_schema='public' and table_name='orders'
   and column_name in ('courier','awb','tracking_url');
-- expect 3 rows

select * from public.track_order('AMB-000000-0000','0000000000');
-- expect: null (no match) - proves the function exists and runs
```

CLI alternative (skips copy/paste entirely):
```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/0011_stock_tracking_sqleditor.sql
```

Rollback note: all statements are `create or replace` / `add column if not
exists` — safe to re-run; nothing is destroyed.

---

## C. Vercel — deploy (5 min)

### Easiest path — Git integration (auto-deploy on push to main)

1. Check it's connected: vercel.com/dashboard → your project → Settings → Git
   → "Git Integration" should point at `tany5/sharee` (production branch `main`).
2. After step A's merge to `main`, Vercel deploys automatically.
3. Watch the Deployments tab; expect "Ready" in ~2–3 min.

### CLI alternative (no Git needed)

```bash
npx vercel login
npx vercel --prod
```
(If prompted, link to the existing TheTanti project, not a new one.)

### Environment variables (unchanged — nothing new is required)

The chatbot needs **zero** new env vars. Confirm the existing set is intact:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`NEXT_PUBLIC_USE_SUPABASE`, payment gateway keys (Razorpay/Cashfree),
`PAYMENT_GATEWAY`, plus whatever notify/email vars you already have.
**Never** add OPENAI/GEMINI/ANTHROPIC keys — the design doesn't use them.

---

## D. Post-deploy verification (10 min)

| # | Check | How | Pass looks like |
|---|---|---|---|
| 1 | Site up | open https://www.thetanti.shop | homepage renders, no error banner |
| 2 | Chatbot FAB | bottom-right pink sparkle button | panel opens; "Preparing your shopping assistant…" then answers |
| 3 | FAQ path | "how much is shipping?" | FREE-shipping answer instantly, "on-device" tag |
| 4 | Product path | "show me cotton sarees" | real product cards, ₹199, Add-to-cart works |
| 5 | Seller path | "I want to become a seller" | single-brand answer with contact info (no leaked internal labels) |
| 6 | Order auth | "where is my order?" signed-OUT | sign-in suggestion, never order data |
| 7 | Tracking page | /track with a real order number + its phone | status timeline; courier deep-link after dispatch |
| 8 | Invoice | on /track or account → order → invoice | clean A4 print preview, Print/Save PDF works |
| 9 | Stock RPC | place an order; check Supabase `products.stock` | stock drops after paid order; `order_stock_holds` has the row |
| 10 | Admin fulfilment | /admin → order → mark dispatched + AWB | /track then shows courier + AWB |
| 11 | No bundle bloat | Deployments → build logs | same function sizes as before; no new functions listed |

### If the chatbot button doesn't appear
1. Hard-refresh (Ctrl+Shift+R) — the chunk is lazy-loaded.
2. Check the console for a blocked `cdn.jsdelivr.net` request (ad-blockers) —
   FAQ/product answers still work; the LLM just stays in fallback mode.
3. First open downloads ~350 MB of model weights ONCE (then browser-cached).
   On metered connections it may take a minute — the panel stays usable while
   it loads.

### If /track says "no order matches"
Migration 0011 hasn't run yet, or the phone isn't the one used at checkout.
Re-check step B's verification queries.

---

## E. Rollback (if anything's wrong)

Vercel: Deployments → last-known-good → "Promote to Production" (instant).
SQL: no rollback needed — 0011 only adds columns/functions and is unused by
the previous code. Chatbot: it's client-side only; worst case it never loads
and the site behaves exactly as before.
