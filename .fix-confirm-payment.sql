-- ============================================================================
-- FIX: "function hmac(text, text, unknown) does not exist" in confirm_payment
-- ----------------------------------------------------------------------------
-- Why payments never complete after Razorpay success: Supabase ships pgcrypto
-- pre-installed in the `extensions` schema, but confirm_payment ran with
-- `set search_path = public`, so hmac() could not be resolved inside the
-- function and every verify/webhook call failed.
--
-- This recreates the function with `extensions` on its search path (and
-- ensures pgcrypto exists there). Idempotent — safe to run again.
-- Paste the WHOLE block into Supabase → SQL Editor → Run.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Drop the legacy 6-arg variant if it still exists anywhere.
drop function if exists public.confirm_payment(text, text, text, text, text, integer);

create or replace function public.confirm_payment(
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_payment_signature text,
  p_webhook_body text,
  p_webhook_signature text,
  p_amount_paise integer,
  p_order_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = extensions, public
as $$
declare
  v_key_secret text;
  v_wh_secret  text;
  v_expected   text;
  v_row        public.orders;
begin
  if p_webhook_body is not null and p_webhook_body <> '' then
    select value into v_wh_secret from public.app_secrets where name = 'razorpay_webhook_secret';
    if v_wh_secret is null then
      raise exception 'Razorpay webhook secret is not configured';
    end if;
    v_expected := encode(hmac(p_webhook_body, v_wh_secret, 'sha256'), 'hex');
    if v_expected <> lower(p_webhook_signature) then
      return null;
    end if;
  else
    select value into v_key_secret from public.app_secrets where name = 'razorpay_key_secret';
    if v_key_secret is null then
      raise exception 'Razorpay key secret is not configured';
    end if;
    v_expected := encode(
      hmac(p_razorpay_order_id || '|' || p_razorpay_payment_id, v_key_secret, 'sha256'),
      'hex'
    );
    if v_expected <> lower(p_payment_signature) then
      return null;
    end if;
  end if;

  -- Idempotent: already-confirmed payments return the paid row, not an error.
  select * into v_row
    from public.orders
   where razorpay_order_id = p_razorpay_order_id
     and payment_status = 'paid'
     and (p_order_id is null or id = p_order_id);
  if found then
    return to_jsonb(v_row);
  end if;

  update public.orders
     set payment_status = 'paid',
         status = 'paid',
         razorpay_order_id = p_razorpay_order_id,
         razorpay_payment_id = p_razorpay_payment_id,
         updated_at = now()
   where razorpay_order_id = p_razorpay_order_id
     and payment_status = 'pending'
     and total * 100 = p_amount_paise
     and (p_order_id is null or id = p_order_id)
   returning * into v_row;

  if found then
    return to_jsonb(v_row);
  end if;

  return null;
end $$;

grant execute on function public.confirm_payment to anon, authenticated;
