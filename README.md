# Ambika — All Sarees ₹199

Mobile-first saree storefront around one promise: **every saree is ₹199**.
Next.js 15 (App Router) + TypeScript + Tailwind CSS v4. Runs in **demo mode**
by default — no accounts or payment keys required — and can be pointed at a
real **Supabase** project (database + auth + the public “Sharee” storage
bucket) by flipping one flag.

Design system: Judson (headings) + Teachers (body), warm brown/gold palette
(`#5D350E #886644 #878A5D #9D9D9D #F6EBE1`) with a class-based **light/dark
theme** toggle (follows OS preference by default).

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

Checks:

```bash
npm run typecheck  # tsc --noEmit
npm test           # vitest (cart/order/validation logic)
npm run lint
npm run build
```

## What's implemented

| Area | Detail |
| --- | --- |
| Home | Announcement bar, hero, value props, category cards, best sellers, new arrivals, reviews, social strip |
| Shop | `/sarees` (search, category/colour filters, sort), `/categories`, `/categories/[slug]` |
| Product page | Gallery, colour selector, qty, add-to-cart/buy-now, sticky mobile bar, JSON-LD, related sarees |
| Cart | Qty steppers, free-shipping progress (free ≥ ₹999, else ₹49), totals |
| Checkout | Guest-friendly: delivery details (validated server-side), UPI/Cards/Net Banking/COD, summary |
| Orders | POST `/api/orders` creates a server-validated order; confirmation page fires `Purchase` only post-verification |
| Wishlist / Account | Device-local wishlist; accounts (register/login, address book, order history with live fulfilment status) |
| Admin | `/admin` — dashboard (revenue, COGS, **profit & margin %**), products CRUD + multi-image upload, categories, orders dispatch flow, customers |
| Policies & SEO | About, Contact, Shipping/Return/Privacy, sitemap, robots, per-product metadata + structured data |
| Analytics | Meta Pixel + GA4 load only when IDs are set (`.env`); UTM/fbclid captured onto each order |

## Demo mode & the road to production

The whole storefront runs on a **seed catalogue** (`lib/data/catalog.ts`, ~29
sarees, 6 categories) and **simulated payments**, with accounts/orders/admin
persisted to a file-backed demo store (`.demo-data/db.json`).

### Switching the backend: Demo store → Supabase

All data access flows through one facade (`lib/backend/index.ts`) that routes
to either backend. To go live:

```bash
# 1. copy the example env and paste your Supabase project keys
cp .env.example .env.local

# 2. apply the runtime schema (tables, RLS, triggers, “Sharee” storage bucket)
#    Supabase Dashboard → SQL → New query → paste supabase/migrations/0001_init.sql → Run

# 3. flip the switch
NEXT_PUBLIC_USE_SUPABASE=true
```

Then restart the dev server. Notes:

- **No service-role key is used.** Everything runs through the publishable
  key + Row Level Security: anon browses the catalogue and can guest-checkout;
  signed-in users manage their own profile/addresses/orders; profile rows with
  `role = 'admin'` manage products, categories, orders and customers.
- **First user = admin.** The first account registered after the migration is
  auto-promoted to admin (see the `handle_new_user` trigger), so register once
  and the admin panel unlocks. The empty catalogue then seeds itself from the
  seed data on the first admin visit to the product list.
- **Email confirmation** should be disabled in Supabase Auth settings
  (Authentication → Sign In / Providers → Email) so sign-ups log straight in;
  otherwise the app shows a “check your email” message instead.
- **Product photos** upload to the public **`Sharee`** storage bucket from the
  admin panel; storefront pages render those public CDN URLs.

Remaining steps to production (unchanged):

1. **Razorpay** — `app/api/webhooks/razorpay/route.ts` is a signature-verified
   stub; the real flow: server creates Razorpay order → client checkout with
   `order_id` → signature + webhook verified → `payment_status` flipped to
   `paid` → `Purchase` event.
2. **Tracking** — set `NEXT_PUBLIC_META_PIXEL_ID` / `NEXT_PUBLIC_GA4_ID`.
3. **Real photos** — drop `public/products/<slug>/1.jpg` (or upload via the
   admin panel) and artwork switches to photography automatically.
   `Purchase` fires only on the verified order-success page (guarded per order
   in sessionStorage), never on the Place Order click. Attribution lands in
   `order.utm` and is saved with the order.
5. **Admin** — not built yet (Phase 4). Planned slot: `app/admin/*` guarded by
   Supabase Auth role `admin`, CRUD via the same `queries.ts` layer.

Set `NEXT_PUBLIC_USE_DEMO=0` once production integrations are configured
(`isDemoMode()` currently gates only the demo-checkout notice).

## Project structure

```
app/
  (store)/          storefront routes (/, sarees, categories, cart, checkout,
                    order-success, wishlist, account, policies)
  api/orders        demo order creation (server-validated, rate-limited)
  api/webhooks/razorpay   Razorpay webhook stub
  api/revalidate    on-demand revalidation stub
  sitemap.ts robots.ts not-found.ts icon.svg
components/
  ui.tsx layout/ product/ cart/ checkout/ order/ wishlist/ account/
  store/providers.tsx   cart + wishlist contexts (localStorage)
lib/
  data/             catalogue + async query layer
  site.ts           ONE place for brand name / price / shipping rules
  cart.ts orders.ts validations.ts  pure business logic (unit-tested)
  analytics.ts meta.ts utm.ts client-store.ts art.ts color-dots.ts
supabase/migrations/0001_init.sql
public/products/    drop real photography here: <slug>/1.jpg
```

## Notes

- **Cart / wishlist / orders are stored in the browser** (`localStorage`) in
  demo mode; the server recomputes every price from the catalogue and never
  trusts client totals.
- Prices are integers/paise-safe and shipping follows one rule everywhere:
  free at/above ₹999, flat ₹49 below — see `lib/site.ts`.
- Brand name, tagline, contact details and shipping rules all live in
  `lib/site.ts` — change once, applied everywhere.
- Fonts are self-hosted by `next/font` (Judson, Teachers) — no runtime Google
  dependency.
