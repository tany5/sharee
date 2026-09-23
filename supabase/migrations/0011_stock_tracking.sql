-- ============================================================================
-- 0011 — Stock decrement + courier tracking
-- -----------------------------------------------------------------------------
-- 1) orders.courier / awb / tracking_url — admin-entered shipment details.
-- 2) decrement_stock(p_order_id, p_items) — security-definer RPC that subtracts
--    ordered quantities from products.stock AFTER the order row is inserted.
--    Called by supabaseAddOrder(); on any failure the caller deletes the order,
--    so an order can never exist without its stock hold.
-- 3) restock_order(p_items) — restores stock when an admin cancels an order.
-- 4) track_order(p_number, p_phone) — public lookup for /track: verifies the
--    phone (last 10 digits, +91/0-tolerant) against the order address and
--    returns a customer-safe jsonb (no email/utm/ids) only on match.
--
-- RLS blocks anon/authenticated writes to products, so 2 & 3 run as definer —
-- the same pattern as confirm_payment in 0001. All calls come from the server
-- (the app holds no elevated client), and each RPC is idempotence-aware:
--   decrement_stock refuses to double-decrement an already-decremented order
--   (guard row in order_stock_holds), so a retried order creation is safe.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tracking columns
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists courier text;
alter table public.orders add column if not exists awb text;
alter table public.orders add column if not exists tracking_url text;

-- ---------------------------------------------------------------------------
-- Stock-hold guard (prevents double-decrement on retried order creation)
-- ---------------------------------------------------------------------------
create table if not exists public.order_stock_holds (
  order_id   uuid primary key references public.orders(id) on delete cascade,
  items      jsonb not null,          -- [{slug, qty}] as held
  created_at timestamptz not null default now()
);
revoke all on table public.order_stock_holds from anon, authenticated;

-- ---------------------------------------------------------------------------
-- decrement_stock — subtract ordered qty from stock (security definer)
-- ---------------------------------------------------------------------------
create or replace function public.decrement_stock(
  p_order_id uuid,
  p_items    jsonb          -- array of {slug, qty}
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_item   jsonb;
  v_slug   text;
  v_qty    integer;
  v_left   integer;
begin
  -- Guard: this order already holds stock — nothing to do (idempotent retry).
  if exists (select 1 from public.order_stock_holds where order_id = p_order_id) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  -- Fail fast if any requested item would go negative BEFORE writing anything.
  -- (Inside a function body every statement joins the caller's transaction, so
  -- raising here rolls the whole call back atomically.)
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

  -- Apply the decrements.
  for v_item in select * from jsonb_array_elements(p_items) loop
    update public.products
       set stock = stock - ((v_item->>'qty')::int),
           updated_at = now()
     where slug = v_item->>'slug';
  end loop;

  -- Record the hold so a retried call cannot decrement twice.
  insert into public.order_stock_holds (order_id, items)
  values (p_order_id, p_items);

  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- restock_order — give stock back when an order is cancelled (admin path)
-- ---------------------------------------------------------------------------
create or replace function public.restock_order(
  p_order_id uuid,
  p_items    jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_held jsonb;
begin
  -- Restock what was actually held (0 rows if the order never decremented).
  select items into v_held from public.order_stock_holds where order_id = p_order_id;
  if v_held is null then
    -- Order predates the holds table: restore from the given items.
    v_held := p_items;
  else
    delete from public.order_stock_holds where order_id = p_order_id;
  end if;

  update public.products
     set stock = stock + ((v_item->>'qty')::int),
         updated_at = now()
    from jsonb_array_elements(v_held) as v_item
   where v_item->>'slug' = public.products.slug;

  return jsonb_build_object('ok', true, 'restored', v_held is not null);
end $$;

-- ---------------------------------------------------------------------------
-- track_order — phone-gated public lookup for /track
-- ---------------------------------------------------------------------------
create or replace function public.track_order(
  p_number text,
  p_phone  text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
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

  v_digits := regexp_replace(p_phone, '\D', '', 'g');
  -- Keep the trailing 10 digits (accepts +91/91/0 prefixes and spacing).
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
  v_phone := regexp_replace(v_phone, '\D', '', 'g');
  if length(v_phone) > 10 then
    v_phone := right(v_phone, 10);
  end if;
  if v_phone <> v_digits then
    return null;
  end if;

  -- Customer-safe item projection (name/qty/price/color — no cost snapshots).
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
              -- tracking_url is the raw saved value; the app derives the
              -- deep link (lib/tracking.ts) exactly as it does in demo mode.
              'url',     v_row.tracking_url)
     end,
    'items',             v_items,
    'subtotal',          v_row.subtotal,
    'shipping',          v_row.shipping,
    'total',             v_row.total,
    'address',           v_row.address
  );
end $$;

grant execute on function public.track_order     to anon, authenticated;
grant execute on function public.decrement_stock to anon, authenticated;
grant execute on function public.restock_order   to anon, authenticated;
