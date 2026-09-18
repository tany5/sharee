-- ============================================================================
-- RUN ME — Repair double-encoded jsonb (items / address / utm / addresses)
-- Paste this WHOLE FILE into: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run; it only touches rows whose jsonb holds a JSON string.
--
-- WHY: the app wrote `JSON.stringify(...)` into jsonb columns, so the database
-- stored a JSON *string* instead of an object. Reads produced
-- "undefined" customer names/addresses in payment/confirmation emails and
-- empty saved addresses. The app code is fixed; this heals the historical
-- rows so every old order renders and notifies correctly.
-- ============================================================================

-- Orders: unwrap the string form back into real jsonb objects/arrays.
update public.orders
set items   = (items::text)::jsonb
where jsonb_typeof(items) = 'string';

update public.orders
set address = (address::text)::jsonb
where jsonb_typeof(address) = 'string';

update public.orders
set utm = (utm::text)::jsonb
where utm is not null
  and jsonb_typeof(utm) = 'string';

-- Profiles: saved address books (jsonb array stored as a string).
update public.profiles
set addresses = (addresses::text)::jsonb
where jsonb_typeof(addresses) = 'string';
