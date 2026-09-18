-- 0010_cashfree_gateway.sql
-- Cashfree payment gateway support — runs alongside Razorpay (never removes it).
--
-- Adds nullable cashfree_* columns to orders plus a security-definer
-- `confirm_cashfree_payment` RPC mirroring `confirm_payment`: the route layer
-- verifies the payment first (Cashfree Orders API status fetch or the webhook
-- signature), then this RPC ties the confirmation to the exact order, checks
-- the amount, flips the order to paid and returns the row (guest orders are
-- invisible to SELECT under RLS, so the jsonb return is the read path).
--
-- After running this migration, seed the Cashfree secret ONCE in the SQL
-- editor (the secret is also read from env for order creation / webhooks; the
-- DB copy exists so an optional double-check inside SQL stays possible):
--
--   insert into public.app_secrets (name, value) values
--     ('cashfree_secret_key', '<YOUR_CASHFREE_SECRET_KEY>')
--   on conflict (name) do update set value = excluded.value;

alter table public.orders add column if not exists cashfree_order_id   text;
alter table public.orders add column if not exists cashfree_payment_id text;

create index if not exists orders_cashfree_idx on public.orders (cashfree_order_id);

create or replace function public.confirm_cashfree_payment(
  p_cashfree_order_id  text,
  p_cashfree_payment_id text,
  p_amount_paise       integer,
  p_order_id           uuid
) returns jsonb
language plpgsql
security definer
set search_path = extensions, public
as $$
declare
  v_row public.orders;
begin
  -- Idempotent: already-confirmed payments return the paid row, not an error.
  select * into v_row
    from public.orders
   where cashfree_order_id = p_cashfree_order_id
     and payment_status = 'paid'
     and (p_order_id is null or id = p_order_id);
  if found then
    return to_jsonb(v_row);
  end if;

  update public.orders
     set payment_status = 'paid',
         status = 'paid',
         cashfree_payment_id = nullif(p_cashfree_payment_id, ''),
         updated_at = now()
   where cashfree_order_id = p_cashfree_order_id
     and payment_status = 'pending'
     and total * 100 = p_amount_paise
     and (p_order_id is null or id = p_order_id)
   returning * into v_row;

  if found then
    return to_jsonb(v_row);
  end if;

  return null;
end $$;

grant execute on function public.confirm_cashfree_payment to anon, authenticated;
