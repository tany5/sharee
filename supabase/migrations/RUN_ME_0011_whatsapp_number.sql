-- ============================================================================
-- RUN ME — WhatsApp number column (migration 0011)
-- Paste this WHOLE FILE into: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run; purely additive.
--
-- WHY: production was failing guest/checkout orders with
--   "Could not find the 'whatsapp' column of 'orders' in the schema cache"
-- because this migration existed only in the repo and was never applied to
-- the live database. Running it fixes live order placement immediately.
-- ============================================================================

-- WhatsApp number for order & shipping updates.
-- orders.whatsapp — the number the customer asked to be notified on
-- (defaults to their phone when left blank at checkout).
alter table public.orders
  add column if not exists whatsapp text;

-- Backfill: existing orders notify on their phone number.
update public.orders
set whatsapp = (address->>'phone')
where whatsapp is null
  and address is not null
  and address->>'phone' is not null;
