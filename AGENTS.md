# AGENTS.md — Ambika saree store

## Stack
- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 (`@tailwindcss/postcss`).
- No UI kit: hand-rolled components in `components/` using design tokens from
  `app/globals.css` (`@theme inline` maps `--color-*` CSS vars → utilities like
  `bg-bg`, `text-ink`, `border-line`, `bg-btn`).
- Dark mode is class-based: `.dark` on `<html>`, `@custom-variant dark` in CSS.
- Tests: Vitest (`npm test` runs `lib/**/*.test.ts`, node env).
- Package manager: **npm**. Run `npm run typecheck` before finishing changes.

## Architecture rules (keep them)
- Business logic stays out of components:
  `lib/cart.ts`, `lib/orders.ts`, `lib/validations.ts` are pure and unit-tested.
- Pages fetch through `lib/data/queries.ts` (async) — never import
  `catalog.ts` arrays into page components directly. The seed catalogue is the
  stand-in for Supabase; migrations live in `supabase/migrations/`.
- **Never trust browser prices/quantities** — the order API
  (`app/api/orders/route.ts`) revalidates everything server-side.
- `Purchase` analytics fires ONLY on order-success after verification
  (`components/order/order-success-view.tsx`), never on checkout click.
- Client components must never import server-only modules
  (`components/product/product-image.tsx` is server-only; grids/carts use
  `SareeArt` directly from `components/product/saree-art.tsx`).
- Brand/pricing config: `lib/site.ts` (name, ₹199, free-shipping ≥ ₹999).

## Design
- Palette is fixed by the brand: `#5D350E #886644 #878A5D #9D9D9D #F6EBE1`
  (light) with derived deeper browns for dark surfaces. Don't introduce new
  hues; use tokens (bg/surface/ink/accent/bronze/muted/line/btn) not raw hex in
  components (footer + a few text-on-art chips are deliberate exceptions).
- Fonts: Judson = headings (`.font-display` via CSS, h1–h6 default), Teachers =
  body. Mobile-first; avoid decorative animations.
- Product visuals: deterministic generative SVGs (`lib/art.ts` +
  `components/product/saree-art.tsx`). Real photos auto-win when
  `public/products/<slug>/1.jpg` exists.
