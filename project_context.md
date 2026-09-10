# Project Context: TheTanti / Ambika Saree Store

Generated as a practical alternative to `grapify init --deep-scan`, because the
published npm package `grapify@1.0.7` does not provide a CLI binary or repository
mapping commands.

## Executive Summary

This repository is a Next.js App Router ecommerce app for a saree storefront.
It has two main user surfaces:

- Storefront: product browsing, product detail pages, cart, checkout, order
  success/failure, wishlist, account, policies, SEO routes.
- Admin: dashboard, product/category/customer/order management, media upload,
  AI marketing pipeline controls, model management.

The core architecture deliberately separates UI from business rules:

- Pages and route handlers live in `app/`.
- React UI lives in `components/`.
- Domain/business/data logic lives in `lib/`.
- Supabase schema lives in `supabase/migrations/`.
- AI marketing setup notes live in `docs/marketing-pipeline.md`.

Important invariant: browser-provided prices and quantities are not trusted.
Orders are revalidated server-side against the active backend before persistence
or payment confirmation.

## Stack

- Next.js App Router with TypeScript.
- React 19.
- Tailwind CSS v4 via `@tailwindcss/postcss`.
- Supabase SSR/client libraries for production backend.
- File-backed local demo backend for zero-config development.
- Razorpay integration for live online payments.
- Vitest for pure business logic tests.
- `ffmpeg-static`, `sharp`, and custom marketing modules for AI media workflow.

Package scripts:

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm test
```

## Top-Level Structure

```text
app/                  Next.js layouts, pages, route handlers, SEO files
components/           React components grouped by feature/surface
lib/                  Domain logic, data facade, backend adapters, integrations
docs/                 Operational documentation
public/               Logos, banners, model assets, static images
supabase/migrations/  Database schema, RLS, functions, marketing pipeline SQL
```

## Route Map

### Storefront Routes

Route group: `app/(store)/`

- `/` -> `app/(store)/page.tsx`
- `/sarees` -> `app/(store)/sarees/page.tsx`
- `/sarees/[slug]` -> `app/(store)/sarees/[slug]/page.tsx`
- `/categories` -> `app/(store)/categories/page.tsx`
- `/categories/[slug]` -> `app/(store)/categories/[slug]/page.tsx`
- `/cart` -> `app/(store)/cart/page.tsx`
- `/checkout` -> `app/(store)/checkout/page.tsx`
- `/order-success` -> `app/(store)/order-success/page.tsx`
- `/order-failure` -> `app/(store)/order-failure/page.tsx`
- `/wishlist` -> `app/(store)/wishlist/page.tsx`
- `/account` -> `app/(store)/account/page.tsx`
- `/about`, `/contact`, `/shipping-policy`, `/return-policy`,
  `/privacy-policy`

Storefront shell: `app/(store)/layout.tsx`

- Wraps children in `StoreProvider` and `AuthProvider`.
- Adds `SiteHeader`, `SiteFooter`, mobile `BottomNav`, analytics scripts, and
  page-view tracking.

### Admin Routes

Admin login:

- `/admin/login` -> `app/admin/login/page.tsx`

Admin protected route group: `app/admin/(panel)/`

- `/admin` -> dashboard
- `/admin/products`
- `/admin/products/new`
- `/admin/products/[slug]`
- `/admin/categories`
- `/admin/orders`
- `/admin/customers`
- `/admin/models`
- `/admin/marketing`

Admin shell: `app/admin/(panel)/layout.tsx`

- Calls `currentUser()`.
- Redirects to `/admin/login` unless the user exists and has `role === "admin"`.
- Renders `components/admin/admin-shell.tsx`.

### API Routes

Auth:

- `app/api/auth/register/route.ts`
- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/me/route.ts`

Orders and payments:

- `app/api/orders/route.ts`
- `app/api/orders/status/route.ts`
- `app/api/payments/verify/route.ts`
- `app/api/webhooks/razorpay/route.ts`

Account:

- `app/api/account/orders/route.ts`
- `app/api/account/addresses/route.ts`
- `app/api/account/addresses/[id]/route.ts`

Admin:

- `app/api/admin/summary/route.ts`
- `app/api/admin/products/route.ts`
- `app/api/admin/products/[slug]/route.ts`
- `app/api/admin/products/generate-photos/route.ts`
- `app/api/admin/categories/route.ts`
- `app/api/admin/orders/route.ts`
- `app/api/admin/orders/[id]/route.ts`
- `app/api/admin/customers/route.ts`
- `app/api/admin/media/route.ts`
- `app/api/admin/marketing/route.ts`
- `app/api/admin/marketing/manage/route.ts`
- `app/api/admin/marketing/advance/route.ts`
- `app/api/admin/marketing/base-models/route.ts`

Other:

- `app/api/media/[file]/route.ts`
- `app/api/revalidate/route.ts`
- `app/sitemap.ts`
- `app/robots.ts`
- `app/not-found.tsx`

## Data and Backend Architecture

### Main Read Path

Storefront pages should read data through:

```text
page.tsx
  -> lib/data/queries.ts
    -> lib/backend/index.ts
      -> demo backend OR Supabase backend
```

`lib/data/queries.ts` exposes:

- `getCategories()`
- `getProducts(filter)`
- `getProductBySlug(slug)`
- `getFeatured(limit)`
- `getNewArrivals(limit)`
- `getRelated(product, limit)`
- `getFilterColors()`

It must remain the page-level data access layer. Pages should not import the
seed catalogue directly.

### Backend Facade

Primary file: `lib/backend/index.ts`

This is the single import point for backend operations. It switches between:

- Demo backend: `lib/demo/db.ts`
- Supabase backend: `lib/supabase/backend.ts`

The switch is controlled by `lib/backend/env.ts`:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_USE_SUPABASE=true or 1
```

If those are not all set, the app uses the demo store.

Facade responsibilities include:

- Auth registration/login/logout/current user.
- Product/category reads and admin mutations.
- Order persistence and order lookup.
- Razorpay payment confirmation.
- Customer stats.
- Media upload.
- Supabase first-run catalogue seeding.

### Demo Backend

Primary file: `lib/demo/db.ts`

The demo backend persists state to:

```text
.demo-data/db.json
.demo-data/uploads/
```

It stores:

- Products and categories.
- Users and sessions.
- Orders.
- Uploaded media.

It seeds from `lib/data/catalog.ts` on first use and creates a demo admin:

```text
admin@thetanti.in / admin123
```

### Supabase Backend

Primary files:

- `lib/supabase/server.ts`
- `lib/supabase/backend.ts`
- `lib/supabase/rows.ts`
- `supabase/migrations/*.sql`

The Supabase path uses request-scoped SSR clients and Row Level Security. There
is no service-role key in normal app code.

The schema mirrors the demo domain types so UI and business logic do not need
to know which backend is active.

## Business Logic

### Cart

Primary file: `lib/cart.ts`

Pure functions:

- `addItemToCart`
- `setItemQty`
- `removeItem`
- `cartCount`
- `shippingFor`
- `totalsFor`
- `summarizeCart`

Rules:

- `MAX_QTY_PER_ITEM = 5`
- Free shipping at `SITE.freeShippingThreshold`
- Flat shipping fee below threshold

Tests: `lib/cart.test.ts`

### Orders

Primary file: `lib/orders.ts`

Core function:

- `createDemoOrder(input)`

Despite the name, this is the shared order creation/validation routine. It can
resolve products from either the seed catalogue or an injected backend resolver.

Important rules:

- Payment method must be one of UPI, card, netbanking, COD.
- Address is validated server-side.
- Cart cannot be empty.
- A single order is capped at 30 item lines.
- Each line quantity must be valid and below `MAX_QTY_PER_ITEM`.
- Products are resolved from a trusted source.
- Stock is enforced server-side.
- Subtotal, shipping, and total are recomputed server-side.
- Unit cost is snapshotted for profit reporting.
- Razorpay-live online payments start as `pending`, not `paid`.

Tests: `lib/orders.test.ts`

### Validations

Primary file: `lib/validations.ts`

Used by order creation and account/address flows.

Tests: `lib/validations.test.ts`

## Payment Flow

Primary files:

- `app/api/orders/route.ts`
- `app/api/payments/verify/route.ts`
- `app/api/webhooks/razorpay/route.ts`
- `lib/payments/razorpay.ts`
- `lib/payments/client.ts`

Flow:

```text
Checkout UI
  -> POST /api/orders
    -> createDemoOrder()
    -> resolve trusted products via backend
    -> persist order
    -> if Razorpay live and not COD, create Razorpay order
  -> Razorpay Checkout
  -> POST /api/payments/verify
    -> verify HMAC signature
    -> confirmRazorpayPayment()
    -> backend cross-checks amount/order and marks paid
  -> order-success page
    -> fires Purchase analytics only after verified paid order
```

Security notes:

- The server computes totals.
- Razorpay HMAC is verified server-side.
- Supabase confirmation uses a security-definer RPC.
- Guest order confirmation avoids RLS read issues by using the RPC return value.

## Client State

Primary files:

- `components/store/providers.tsx`
- `lib/client-store.ts`
- `lib/client-hooks.ts`

Client-side local state includes:

- Cart.
- Wishlist.

`StoreProvider` exposes:

- `useCart()`
- `useWishlist()`

Cart lines can store name/price snapshots for display, but final order totals
are still recomputed by the server.

## Auth and Accounts

Primary files:

- `components/auth/auth-provider.tsx`
- `lib/auth/session.ts`
- `lib/auth/password.ts`
- `app/api/auth/*`
- `app/api/account/*`
- `components/account/account-view.tsx`

Demo auth uses local password hashing and an HTTP-only session cookie.
Supabase auth uses Supabase Auth and profile rows.

Public user shape is defined in `lib/types.ts`.

## Admin Surface

Primary components:

- `components/admin/admin-shell.tsx`
- `components/admin/admin-dashboard.tsx`
- `components/admin/admin-products.tsx`
- `components/admin/product-editor.tsx`
- `components/admin/admin-categories.tsx`
- `components/admin/admin-orders.tsx`
- `components/admin/admin-customers.tsx`
- `components/admin/admin-models.tsx`
- `components/admin/admin-marketing.tsx`
- `components/admin/admin-login.tsx`

Admin API access is guarded through:

- `lib/admin/guard.ts`

The admin panel manages:

- Products, categories, images.
- Order fulfilment.
- Customers.
- Marketing pipeline queue/stages.
- Base model uploads for marketing imagery.

## Marketing Pipeline

Primary documentation:

- `docs/marketing-pipeline.md`

Primary code:

- `lib/marketing/engine.ts`
- `lib/marketing/store.ts`
- `lib/marketing/status.ts`
- `lib/marketing/types.ts`
- `lib/marketing/tryon.ts`
- `lib/marketing/copy.ts`
- `lib/marketing/posts.ts`
- `lib/marketing/video.ts`
- `lib/marketing/publish.ts`
- `lib/marketing/storage.ts`
- `lib/marketing/secrets.ts`

Pipeline statuses:

```text
pending
  -> tryon_processing
  -> tryon_completed
  -> rendering_video
  -> publishing
  -> published

any stage -> failed
```

The endpoint `POST /api/admin/marketing/advance` runs one stage for every
in-flight product. The admin UI can call it repeatedly; it is also intended for
future cron use.

External services are optional where possible:

- Try-on: Hugging Face Spaces, with mock/local fallback support.
- Copy: Gemini -> Groq -> deterministic template.
- Reel: local FFmpeg.
- Publishing: Meta Graph API, fails if Meta credentials are missing.

Marketing state lives in each product's `marketing` blob:

- Demo: JSON object in `.demo-data/db.json`.
- Supabase: `products.marketing` jsonb.

## Product Images and Visuals

Primary files:

- `lib/photos.ts`
- `lib/art.ts`
- `components/product/saree-art.tsx`
- `components/product/product-image.tsx`
- `components/product/worn-image.tsx`

Visual priority:

1. Real product photos when available.
2. Uploaded/admin-managed images.
3. Deterministic generated saree SVG art.

Important component rule from project instructions:

- Client components should use `SareeArt` directly.
- `components/product/product-image.tsx` is server-only.

## Design System

Primary file: `app/globals.css`

Design tokens are CSS variables mapped into Tailwind utilities through
`@theme inline`.

Core tokens include:

- `bg`
- `surface`
- `surface2`
- `ink`
- `ink2`
- `accent`
- `accent2`
- `bronze`
- `muted`
- `line`
- `chip`
- `btn`
- `btntext`
- `tint`
- `danger`

Brand palette from project instructions:

```text
#5D350E
#886644
#878A5D
#9D9D9D
#F6EBE1
```

Dark mode is class-based via `.dark` on `<html>`.

Root layout:

- `app/layout.tsx`
- Loads Judson and Teachers fonts.
- Initializes dark mode from `localStorage`/system preference.
- Sets global metadata and viewport theme colors.

## SEO and Analytics

Primary files:

- `app/layout.tsx`
- `app/sitemap.ts`
- `app/robots.ts`
- `components/analytics/analytics-scripts.tsx`
- `components/analytics/page-view-tracker.tsx`
- `lib/analytics.ts`
- `lib/meta.ts`
- `lib/utm.ts`

Analytics loads only when IDs are configured.

UTM/fbclid attribution is captured onto orders.

Critical analytics rule:

- `Purchase` fires only on the verified order-success flow, not on checkout
  click.

## Domain Types

Primary file: `lib/types.ts`

Important types:

- `Category`
- `Product`
- `CartItem`
- `DeliveryAddress`
- `AddressBookAddress`
- `Order`
- `OrderItem`
- `PublicUser`
- `PaymentMethodId`
- `FulfilmentStatus`
- `DbStatus`

Keep this file framework-free.

## Configuration

Primary file: `lib/site.ts`

Centralized values:

- Brand name: `TheTanti`
- Legal name
- Tagline
- Price promise
- Currency
- Free shipping threshold
- Shipping fee
- Announcement text
- Contact info
- Canonical site URL
- Payment method labels/blurbs

Change brand, pricing, or shipping rules here first.

## Database Migrations

Files:

- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0002_fix_first_user_admin.sql`
- `supabase/migrations/0003_guest_checkout.sql`
- `supabase/migrations/0004_marketing_pipeline.sql`
- `supabase/migrations/0005_pipeline_secrets.sql`

Broad responsibilities:

- Core products/categories/profiles/orders schema.
- Row Level Security policies.
- First-user admin bootstrap.
- Guest checkout compatibility.
- Payment confirmation RPC.
- Marketing pipeline columns/status helpers/storage buckets.
- Pipeline secrets helper.

## Test Coverage

Test runner: Vitest.

Config: `vitest.config.ts`

Included tests:

- `lib/cart.test.ts`
- `lib/orders.test.ts`
- `lib/validations.test.ts`
- `lib/payments/razorpay.test.ts`
- `lib/marketing/marketing.test.ts`

The tests focus on pure logic and integration boundary behavior.

## Common Change Guide

### Add or Change Storefront Product Data

Look at:

- `lib/data/catalog.ts` for seed/demo catalogue.
- Admin product editor and API routes for runtime product management.
- `lib/backend/index.ts` for backend-facing reads/writes.
- `lib/supabase/rows.ts` if schema mapping changes.

### Change Pricing or Shipping

Start at:

- `lib/site.ts`
- `lib/cart.ts`
- `lib/orders.ts`
- related tests in `lib/*.test.ts`

Do not rely on browser totals.

### Change Checkout or Orders

Start at:

- `components/checkout/checkout-view.tsx`
- `app/api/orders/route.ts`
- `lib/orders.ts`
- `lib/cart.ts`
- `lib/validations.ts`
- `app/api/payments/verify/route.ts` for online payment completion

### Change Admin Product Management

Start at:

- `components/admin/admin-products.tsx`
- `components/admin/product-editor.tsx`
- `app/api/admin/products/route.ts`
- `app/api/admin/products/[slug]/route.ts`
- `app/api/admin/media/route.ts`
- `lib/backend/index.ts`

### Change Product Listing or Filtering

Start at:

- `app/(store)/sarees/page.tsx`
- `components/product/listing-tools.tsx`
- `components/product/product-grid.tsx`
- `lib/data/queries.ts`

### Change Product Detail Page

Start at:

- `app/(store)/sarees/[slug]/page.tsx`
- `components/product/product-page.tsx`
- `components/product/card-carousel.tsx`
- `components/product/product-image.tsx`
- `components/product/saree-art.tsx`

### Change Marketing Pipeline

Start at:

- `docs/marketing-pipeline.md`
- `components/admin/admin-marketing.tsx`
- `app/api/admin/marketing/*`
- `lib/marketing/engine.ts`
- `lib/marketing/status.ts`
- `lib/marketing/types.ts`

### Change Backend Mode or Supabase Integration

Start at:

- `lib/backend/env.ts`
- `lib/backend/index.ts`
- `lib/supabase/backend.ts`
- `lib/supabase/server.ts`
- `supabase/migrations/*.sql`

### Change Theme or Brand Look

Start at:

- `app/globals.css`
- `lib/site.ts`
- `components/layout/*`
- `components/ui.tsx`

Use existing tokens instead of raw colors in components.

## Architectural Invariants

- Business logic stays in `lib/`, not React components.
- Storefront pages fetch through `lib/data/queries.ts`.
- API routes revalidate sensitive data server-side.
- Browser cart snapshots are display hints, not pricing authority.
- Client components must not import server-only modules.
- Admin routes require an admin user.
- Supabase mode uses RLS and publishable keys, not service-role keys.
- Purchase analytics fires only after verified success.
- Brand/pricing/shipping config belongs in `lib/site.ts`.
- Design colors should flow through `app/globals.css` tokens.

## Quick Mental Model

```text
User browsing
  -> app/(store) pages
  -> lib/data/queries
  -> lib/backend facade
  -> demo JSON store or Supabase

Cart/wishlist interaction
  -> StoreProvider
  -> localStorage
  -> lib/cart pure helpers

Checkout
  -> checkout component
  -> POST /api/orders
  -> lib/orders validates/recomputes
  -> backend persists
  -> Razorpay optional
  -> verify route/webhook marks paid
  -> order-success fires Purchase

Admin changes
  -> protected admin pages
  -> app/api/admin routes
  -> lib/backend facade
  -> demo JSON store or Supabase
  -> storefront sees updated data on refresh

Marketing
  -> Admin Marketing Studio
  -> /api/admin/marketing/*
  -> lib/marketing/engine
  -> try-on/copy/posts/video/publish modules
  -> marketing blob on product
```

## Grapify Install Note

The command requested by the user installed `grapify@1.0.7`, but that package
is not a repository mapping CLI. Its package metadata has no `bin` field, so no
`grapify` executable is placed on PATH. The package exports JavaScript functions
for simple chart-like data generation.

Observed:

```text
npm list -g grapify --depth=0 -> grapify@1.0.7
grapify --version -> command not recognized
grapify init --deep-scan --output=project_context.md -> command not recognized
```

This file is therefore the manual project context map.
