-- ============================================================================
-- Ambika — All Sarees ₹199 · Supabase runtime schema
-- ----------------------------------------------------------------------------
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query) or via
-- `supabase db push`. It is idempotent enough to re-run safely.
--
-- Design notes:
--   * NO service-role key is needed at runtime: every request runs through the
--     publishable key with Row Level Security.
--       - anon            → browse active products + categories; guest checkout
--       - authenticated   → own profile, own addresses, own orders
--       - admin (profile) → catalogue CRUD, all orders, fulfilment, customers
--   * The FIRST profile ever created becomes the admin — register once from
--     the app after this migration to bootstrap the store (products are then
--     seeded automatically into the empty catalogue on first admin visit).
--   * Product photos live in the public storage bucket "Sharee".
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Grants (RLS is the real gate; these only remove privilege errors)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Helpers (table-free first: set_updated_at may be created anywhere)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles (mirrors auth.users, created automatically on sign-up)
-- NOTE: profiles is created BEFORE the functions below it, because PostgreSQL
-- validates SQL-function bodies at CREATE time — is_admin() references
-- profiles, so it must come after the table.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'customer' check (role in ('customer', 'admin')),
  full_name  text,
  phone      text,
  addresses  jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Admin check used by RLS policies. Security definer + fixed search_path so the
-- policy works for anon/authenticated roles without extra grants. Must be
-- defined after public.profiles exists.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Auto-create the profile row on sign-up; the very first profile (fresh
-- project) is promoted to admin so the store owner can log in and manage.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', null)
  )
  on conflict (id) do nothing;

  -- Promote the very first profile to admin. The role-change guard trigger
  -- (profiles_guard_role) would reject this because no request session exists
  -- during sign-up (auth.uid() is null -> is_admin() is false), so the guard
  -- is disabled around the promotion update only.
  if (select count(*) from public.profiles) = 1 then
    alter table public.profiles disable trigger profiles_guard_role;
    update public.profiles set role = 'admin' where id = new.id;
    alter table public.profiles enable trigger profiles_guard_role;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nobody may change their own role (only an admin row update is allowed, and
-- admins already bypass RLS; this stops privilege escalation through RLS).
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Changing the profile role is not allowed';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Categories & products (catalogue; seeded by the app on first admin visit)
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id         bigint generated always as identity primary key,
  slug       text not null unique,
  name       text not null,
  short      text not null default '',
  blurb      text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  category    text not null references public.categories(slug),
  description text not null default '',
  details     text not null default '',
  fabric      text not null default '',
  occasion    text not null default '',
  colorway    text not null default 'Maroon',
  colors      jsonb not null default '[]'::jsonb,
  price       integer not null default 199,
  compare_at  integer,
  cost        integer not null default 0,
  stock       integer not null default 0,
  rating      numeric(2,1) not null default 0,
  review_count integer not null default 0,
  tags        jsonb not null default '[]'::jsonb,
  featured    boolean not null default false,
  images      jsonb not null default '[]'::jsonb,
  db_status   text not null default 'draft'
              check (db_status in ('active', 'draft', 'deleted')),
  is_custom   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists products_category_idx on public.products (category);
create index if not exists products_status_idx on public.products (db_status);
create index if not exists products_featured_idx on public.products (featured) where db_status = 'active';

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Orders (full snapshot stored as JSON; fulfilment tracked in columns)
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  number             text not null unique,
  user_id            uuid references auth.users(id) on delete set null,
  user_email         text,
  items              jsonb not null,
  subtotal           integer not null,
  shipping           integer not null default 0,
  total              integer not null,
  payment_method     text not null,
  payment_status     text not null,
  status             text not null,
  razorpay_order_id   text,
  razorpay_payment_id text,
  address            jsonb not null,
  utm                jsonb,
  fulfilment         text not null default 'pending'
                     check (fulfilment in ('pending', 'dispatched', 'completed', 'cancelled')),
  stored_in          text not null default 'supabase',
  estimated_delivery timestamptz not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists orders_user_idx on public.orders (user_id);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_fulfilment_idx on public.orders (fulfilment);
create index if not exists orders_razorpay_idx on public.orders (razorpay_order_id);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.categories enable row level security;
alter table public.products   enable row level security;
alter table public.orders     enable row level security;

-- profiles: owner reads own; admins read all; insert only self (trigger path)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- categories: browsable by everyone; admin manages
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories
  for select using (true);

drop policy if exists categories_admin on public.categories;
create policy categories_admin on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

-- products: live rows browsable; admin sees everything (incl. drafts)
drop policy if exists products_read_live on public.products;
create policy products_read_live on public.products
  for select using (db_status = 'active');

drop policy if exists products_read_admin on public.products;
create policy products_read_admin on public.products
  for select using (public.is_admin());

drop policy if exists products_admin on public.products;
create policy products_admin on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- orders: owner + admin read; anyone may place (guest checkout allowed, but a
-- signed-in customer's order must belong to them); only admin updates them
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert with check (
    user_id is null or user_id = auth.uid() or public.is_admin()
  );

drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage — public "Sharee" bucket for product photos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('Sharee', 'Sharee', true)
on conflict (id) do update set public = true;

do $$
begin
  drop policy if exists "Sharee public read" on storage.objects;
  create policy "Sharee public read" on storage.objects
    for select
    using (bucket_id = 'Sharee');

  drop policy if exists "Sharee admin manage" on storage.objects;
  create policy "Sharee admin manage" on storage.objects
    for all
    using (bucket_id = 'Sharee' and public.is_admin())
    with check (bucket_id = 'Sharee' and public.is_admin());
end $$;

-- ---------------------------------------------------------------------------
-- Payments — Razorpay confirmation (server-side, publishable key only)
-- ---------------------------------------------------------------------------
-- The Razorpay KEY_SECRET and WEBHOOK_SECRET live ONLY inside this database,
-- never in the app or the repo. `confirm_payment` verifies either a payment
-- signature (client success handler → /api/payments/verify) or a webhook event
-- signature (Razorpay → /api/webhooks/razorpay), cross-checks the paid amount
-- against the order total, then flips the order to paid. It runs as the table
-- owner (security definer) and RLS on app_secrets blocks every direct read, so
-- no service-role key is needed anywhere in the app.
--
-- After running this migration, seed the secrets ONCE in the SQL editor:
--
--   insert into public.app_secrets (name, value) values
--     ('razorpay_key_secret',     '<YOUR_RAZORPAY_KEY_SECRET>'),
--     ('razorpay_webhook_secret', '<YOUR_RAZORPAY_WEBHOOK_SECRET>')
--   on conflict (name) do update set value = excluded.value;
--
create table if not exists public.app_secrets (
  name  text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;
revoke all on table public.app_secrets from anon, authenticated;

create or replace function public.confirm_payment(
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_payment_signature text,
  p_webhook_body text,
  p_webhook_signature text,
  p_amount_paise integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key_secret text;
  v_wh_secret  text;
  v_expected   text;
begin
  if p_webhook_body is not null and p_webhook_body <> '' then
    select value into v_wh_secret from public.app_secrets where name = 'razorpay_webhook_secret';
    if v_wh_secret is null then
      raise exception 'Razorpay webhook secret is not configured';
    end if;
    v_expected := encode(hmac(p_webhook_body, v_wh_secret, 'sha256'), 'hex');
    if v_expected <> lower(p_webhook_signature) then
      return false;
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
      return false;
    end if;
  end if;

  -- Idempotent: already-confirmed payments are a success, not an error.
  if exists (
    select 1 from public.orders
    where razorpay_order_id = p_razorpay_order_id and payment_status = 'paid'
  ) then
    return true;
  end if;

  update public.orders
     set payment_status = 'paid',
         status = 'paid',
         razorpay_order_id = p_razorpay_order_id,
         razorpay_payment_id = p_razorpay_payment_id,
         updated_at = now()
   where razorpay_order_id = p_razorpay_order_id
     and payment_status = 'pending'
     and total * 100 = p_amount_paise;

  return found;
end $$;

grant execute on function public.confirm_payment to anon, authenticated;
