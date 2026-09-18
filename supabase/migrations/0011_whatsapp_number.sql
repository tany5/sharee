-- WhatsApp number for order & shipping updates.
-- orders.whatsapp — the number the customer asked to be notified on
-- (defaults to their phone when left blank at checkout).
-- addresses (public.profiles.addresses jsonb) needs no schema change — the
-- DeliveryAddress type gains an optional `whatsapp` key stored in the jsonb.

alter table public.orders
  add column if not exists whatsapp text;

-- Backfill: existing orders notify on their phone number.
update public.orders
set whatsapp = (address->>'phone')
where whatsapp is null
  and address is not null
  and address->>'phone' is not null;
