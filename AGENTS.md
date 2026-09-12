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
- AI marketing pipeline (`lib/marketing/`): try-on (IDM-VTON Space) → copy
  (Gemini/Groq/template) → FFmpeg reel → Meta publish. State lives in
  `products.marketing` jsonb; setup: `docs/marketing-pipeline.md`.

## Design
- **One palette, in `--tt-*` tokens** (`app/globals.css`): light in `:root`,
  dark in `.dark`. `@theme inline` aliases the legacy utility names
  (`bg`/`surface`/`ink`/`ink2`/`accent`/`accent2`/`bronze`/`muted`/`line`/
  `chip`/`btn`/`btntext`/`tint`/`danger`, plus `bg2`/`footer`/`goldlight`) onto
  them, so every existing class rethemes for free. **Never hardcode a colour in
  a component** — add or use a token (the footer is the one deliberate
  exception: it is espresso in both themes).
- Direction: modern, minimal, editorial, ~10% Bengali. Espresso surfaces
  (`#171311`), ivory text (`#F7F1E8`), terracotta accent (`#C45A5A`) carries the
  Bengali character, muted gold (`#D6AD72`) is an accent only — never the whole
  border/heading colour.
- Fonts: Playfair Display = editorial headings (`font-display` via CSS, h1–h6
  default), Inter = body/UI (prices, buttons, nav, metadata).
- Utilities: `.tt-container` (1200/1280px content rail), `.tt-eyebrow`,
  `no-scrollbar`, `tt-rise` (respects `prefers-reduced-motion`). Radius scale:
  `rounded-lg` 8 / `rounded-card` 12 / `rounded-panel` 16 / `rounded-pill`.
- Dark is the default theme; `.dark` is still class-based and the header toggle
  stores the visitor's choice under `ambika-theme`.
- Copy honesty: only publish claims the store can back (live price rules,
  published policy pages, real catalogue data). If the data is absent, hide the
  element rather than inventing content — see `components/home/trust-strip.tsx`
  and the conditional product rows in `app/(store)/page.tsx`.
- Mobile-first; subtle transitions only, no decorative animation.
- Product visuals: deterministic generative SVGs (`lib/art.ts` +
  `components/product/saree-art.tsx`). Real photos auto-win when
  `public/products/<slug>/1.jpg` exists.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
