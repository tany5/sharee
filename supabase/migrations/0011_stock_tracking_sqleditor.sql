-- ============================================================================
-- 0011 - Stock decrement + courier tracking  (SQL-editor edition)
-- ----------------------------------------------------------------------------
-- Function bodies use NAMED dollar tags (dec, restock, track - written as
-- dollar-sign tag dollar-sign in the file) with zero quote escaping, so
-- nothing can be corrupted by pasting into the Supabase SQL Editor. Also
-- runs in psql. Fully idempotent - safe to re-run.
--
-- Creates:
--   1) orders.courier / awb / tracking_url columns
--   2) order_stock_holds guard table (blocks double stock decrement)
--   3) decrement_stock(p_order_id, p_items)  - stock hold on order creation
--   4) restock_order(p_order_id, p_items)    - stock return on cancellation
--   5) track_order(p_number, p_phone)        - phone-gated public tracking
-- ============================================================================

-- 1) Tracking columns ---------------------------------------------------------
alter table public.orders add column if not exists courier text;
alter table public.orders add column if not exists awb text;
alter table public.orders add column if not exists tracking_url text;

-- 2) Stock-hold guard table ---------------------------------------------------
create table if not exists public.order_stock_holds (
  order_id   uuid primary key references public.orders(id) on delete cascade,
  items      jsonb not null,
  created_at timestamptz not null default now()
);
revoke all on table public.order_stock_holds from anon, authenticated;

-- 3) decrement_stock - subtract ordered qty from stock (security definer) ------
create or replace function public.decrement_stock(
  p_order_id uuid,
  p_items    jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $dec$
declare
  v_item   jsonb;
  v_slug   text;
  v_qty    integer;
  v_left   integer;
begin
  -- Idempotent retry guard: stock already held for this order.
  if exists (select 1 from public.order_stock_holds where order_id = p_order_id) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  -- Validate every item BEFORE writing anything. A raise here joins the
  -- caller transaction and rolls the whole call back atomically.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_slug := coalesce(v_item->>'slug', '');
    v_qty  := coalesce((v_item->>'qty')::int, 0);
    if v_slug = '' or v_qty <= 0 then
      raise exception 'decrement_stock: invalid item %', v_item::text;
    end if;
    select stock into v_left from public.products where slug = v_slug;
    if not found then
      raise exception 'decrement_stock: unknown product %', v_slug;
    end if;
    if v_left < v_qty then
      raise exception 'decrement_stock: insufficient stock for %', v_slug;
    end if;
  end loop;

  update public.products p
     set stock = p.stock - ((item->>'qty')::int),
         updated_at = now()
    from jsonb_array_elements(p_items) as item
   where p.slug = item->>'slug';

  -- Record the hold so a retried call cannot decrement twice.
  insert into public.order_stock_holds (order_id, items)
  values (p_order_id, p_items);

  return jsonb_build_object('ok', true);
end
$dec$;

-- 4) restock_order - give stock back when an order is cancelled ----------------
create or replace function public.restock_order(
  p_order_id uuid,
  p_items    jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $restock$
declare
  v_held jsonb;
begin
  -- Restock what was actually held (falls back to p_items for orders that
  -- predate the holds table).
  select items into v_held from public.order_stock_holds where order_id = p_order_id;
  if v_held is null then
    v_held := p_items;
  else
    delete from public.order_stock_holds where order_id = p_order_id;
  end if;

  update public.products p
     set stock = p.stock + ((v_item->>'qty')::int),
         updated_at = now()
    from jsonb_array_elements(v_held) as v_item
   where p.slug = v_item->>'slug';

  return jsonb_build_object('ok', true, 'restored', v_held is not null);
end
$restock$;

-- 5) track_order - phone-gated public lookup for /track ------------------------
-- Verifies the phone (last 10 digits, +91/0 tolerant) against the order
-- address and returns a customer-safe jsonb only on match.
create or replace function public.track_order(
  p_number text,
  p_phone  text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $track$
declare
  v_row     public.orders;
  v_digits  text;
  v_phone   text;
  v_item    jsonb;
  v_items   jsonb;
begin
  if p_number is null or p_phone is null then
    return null;
  end if;

  v_digits := regexp_replace(p_phone, '[^0-9]', '', 'g');
  if length(v_digits) > 10 then
    v_digits := right(v_digits, 10);
  end if;
  if length(v_digits) <> 10 then
    return null;
  end if;

  select * into v_row
    from public.orders
   where number = p_number
   limit 1;
  if not found then
    return null;
  end if;

  v_phone := coalesce(v_row.whatsapp, v_row.address->>'phone', '');
  v_phone := regexp_replace(v_phone, '[^0-9]', '', 'g');
  if length(v_phone) > 10 then
    v_phone := right(v_phone, 10);
  end if;
  if v_phone <> v_digits then
    return null;
  end if;

  -- Customer-safe item projection (name/qty/price/color - no cost snapshots).
  v_items := '[]'::jsonb;
  for v_item in select * from jsonb_array_elements(coalesce(v_row.items, '[]'::jsonb)) loop
    v_items := v_items || jsonb_build_object(
      'name',  v_item->>'name',
      'qty',   v_item->'qty',
      'price', v_item->'price',
      'color', v_item->>'color'
    );
  end loop;

  return jsonb_build_object(
    'number',            v_row.number,
    'createdAt',         v_row.created_at,
    'estimatedDelivery', v_row.estimated_delivery,
    'paymentStatus',     v_row.payment_status,
    'paymentMethod',     v_row.payment_method,
    'fulfilment',        v_row.fulfilment,
    'tracking', case
       when v_row.awb is null then null
       else jsonb_build_object(
              'courier', v_row.courier,
              'awb',     v_row.awb,
              'url',     v_row.tracking_url)
     end,
    'items',             v_items,
    'subtotal',          v_row.subtotal,
    'shipping',          v_row.shipping,
    'total',             v_row.total,
    'address',           v_row.address
  );
end
$track$;

grant execute on function public.track_order(p_number text, p_phone text) to anon, authenticated;
grant execute on function public.decrement_stock(p_order_id uuid, p_items jsonb) to anon, authenticated;
grant execute on function public.restock_order(p_order_id uuid, p_items jsonb) to anon, authenticated;
