-- ============================================================================
-- Ambika — All Sarees ₹199 · initial schema
-- ----------------------------------------------------------------------------
-- Forward-looking schema covering the single-store launch AND the future
-- multi-vendor marketplace. The demo storefront runs off the seed catalogue
-- (lib/data/catalog.ts) — this file is the migration target for Phase 2+
-- (Supabase). It is written but intentionally NOT applied during demo dev.
--
-- Conventions:
--   * uuid ids, created_at/updated_at on every table
--   * RESTRICT on deletes of referenced rows (never lose order history)
--   * Row Level Security policies are written for the launch model:
--       - products/categories/reviews: public read
--       - orders/customers/addresses: owner only (auth.uid())
--       - admin/seller tables: service-role / admin role only
--   * attribution columns (utm_*, fbclid) live on orders to answer
--     "which ad generated this order?"
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.product_status as enum ('draft', 'active', 'archived');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'cod');
create type public.order_status   as enum ('placed', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned');
create type public.seller_status  as enum ('pending', 'approved', 'suspended');

-- ---------------------------------------------------------------------------
-- Users & profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'customer'
              check (role in ('customer', 'seller', 'admin')),
  full_name   text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- seller record (future marketplace)
create table public.sellers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  business_name   text not null,
  gstin           text,
  status          public.seller_status not null default 'pending',
  commission_rate numeric(5,2) not null default 10.00,
  payout_account  jsonb, -- bank/UPI details encrypted at app level
  payout_status   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id)
);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.categories (
  id         bigint generated always as identity primary key,
  slug       text not null unique,
  name       text not null,
  short      text not null,
  blurb      text,
  created_at timestamptz not null default now()
);

create table public.products (
  id               uuid primary key default gen_random_uuid(),
  seller_id        uuid references public.sellers(id) on delete restrict, -- null = own inventory
  category_id      bigint not null references public.categories(id) on delete restrict,
  name             text not null,
  slug             text not null unique,
  description      text not null default '',
  product_type     text,                 -- 'saree', 'dupatta', ... (future)
  fabric           text,
  color            text,
  occasion         text,
  price            numeric(10,2) not null check (price >= 0),
  compare_at_price numeric(10,2) check (compare_at_price >= price),
  stock_quantity   integer not null default 0 check (stock_quantity >= 0),
  status           public.product_status not null default 'draft',
  is_featured      boolean not null default false,
  meta_title       text,
  meta_description text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.product_images (
  id         bigint generated always as identity primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  url        text not null,
  alt_text   text,
  position   integer not null default 0
);

-- Colour/fabric variants of one product
create table public.product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products(id) on delete cascade,
  sku            text not null unique,
  variant_name   text not null,          -- e.g. "Maroon", "Forest Green"
  price          numeric(10,2) not null,
  stock_quantity integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_products_category on public.products(category_id);
create index idx_products_status    on public.products(status);
create index idx_variants_product   on public.product_variants(product_id);

-- ---------------------------------------------------------------------------
-- Customers, addresses, wishlists, reviews
-- ---------------------------------------------------------------------------
create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete set null, -- guest orders keep the customer row
  email      text,
  phone      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id         uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  label      text,
  full_name  text not null,
  phone      text not null,
  line1      text not null,
  landmark   text,
  city       text not null,
  state      text not null,
  pincode    text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wishlists (
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (customer_id, product_id)
);

create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_id   uuid, -- verified-buyer flag: review linked to a real order
  rating     smallint not null check (rating between 1 and 5),
  title      text,
  body       text,
  created_at timestamptz not null default now(),
  unique (customer_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Cart
-- ---------------------------------------------------------------------------
create table public.carts (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customers(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity   integer not null check (quantity > 0),
  unique (cart_id, variant_id)
);

-- ---------------------------------------------------------------------------
-- Orders (single record captures the full ad-attribution story)
-- ---------------------------------------------------------------------------
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  number           text not null unique,     -- human friendly, e.g. AMB-260903-1234
  customer_id      uuid references public.customers(id) on delete restrict,
  status           public.order_status not null default 'placed',
  payment_status   public.payment_status not null default 'pending',
  subtotal         numeric(10,2) not null,
  shipping         numeric(10,2) not null default 0,
  discount         numeric(10,2) not null default 0,
  total_amount     numeric(10,2) not null,
  currency         text not null default 'INR',
  address_snapshot jsonb not null,           -- immutable copy of delivery address
  utm_source       text,
  utm_medium       text,
  utm_campaign     text,
  utm_content      text,
  utm_term         text,
  fbclid           text,
  gateway_order_id text,                     -- Razorpay order id
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete restrict,
  variant_id   uuid references public.product_variants(id) on delete set null,
  product_name text not null,                -- snapshot (name can change later)
  variant_name text,
  quantity     integer not null check (quantity > 0),
  price        numeric(10,2) not null        -- unit price snapshot — never trust client
);

create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete restrict,
  provider      text not null default 'razorpay',
  provider_ref  text,                        -- Razorpay payment id
  method        text,                        -- upi | card | netbanking | cod
  amount        numeric(10,2) not null,
  status        public.payment_status not null default 'pending',
  raw_response  jsonb,                       -- webhook payload for audits
  created_at    timestamptz not null default now()
);

create table public.shipments (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  provider     text not null default 'delhivery',
  tracking_no  text,
  status       text not null default 'booked',
  est_delivery timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.refunds (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete restrict,
  amount      numeric(10,2) not null,
  reason      text,
  status      text not null default 'requested',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_orders_customer   on public.orders(customer_id);
create index idx_orders_created    on public.orders(created_at desc);
create index idx_orders_utm_campaign on public.orders(utm_campaign);
create index idx_order_items_order on public.order_items(order_id);

-- ---------------------------------------------------------------------------
-- Coupons
-- ---------------------------------------------------------------------------
create table public.coupons (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  kind          text not null check (kind in ('percent', 'fixed', 'free_shipping')),
  value         numeric(10,2) not null default 0,
  min_subtotal  numeric(10,2) not null default 0,
  max_uses      integer,
  used_count    integer not null default 0,
  starts_at     timestamptz,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
do $$
declare t record;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name in
      ('profiles','sellers','products','product_variants','customers',
       'addresses','carts','orders','shipments','refunds')
  loop
    execute format('create trigger %I before update on public.%I
                    for each row execute function public.set_updated_at()',
                   'trg_' || t.table_name || '_updated', t.table_name);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security (launch model — see notes at the top of this file)
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.reviews enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.customers enable row level security;
alter table public.addresses enable row level security;
alter table public.wishlists enable row level security;

-- Public catalogue: everyone may read active products & reviews
create policy "public read categories" on public.categories for select using (true);
create policy "public read active products" on public.products
  for select using (status = 'active');
create policy "public read product images" on public.product_images
  for select using (exists (select 1 from public.products p
                            where p.id = product_images.product_id
                              and p.status = 'active'));
create policy "public read product variants" on public.product_variants
  for select using (exists (select 1 from public.products p
                            where p.id = product_variants.product_id
                              and p.status = 'active'));
create policy "public read reviews" on public.reviews for select using (true);

-- Customers may only read/write their own rows.
create policy "owner customers" on public.customers
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owner addresses" on public.addresses
  for all using (exists (select 1 from public.customers c
                         where c.id = addresses.customer_id
                           and c.user_id = auth.uid()))
  with check (exists (select 1 from public.customers c
                      where c.id = addresses.customer_id
                        and c.user_id = auth.uid()));

create policy "owner orders" on public.orders
  for all using (exists (select 1 from public.customers c
                         where c.id = orders.customer_id
                           and c.user_id = auth.uid()))
  with check (exists (select 1 from public.customers c
                      where c.id = orders.customer_id
                        and c.user_id = auth.uid()));

create policy "owner order items" on public.order_items
  for select using (exists (
    select 1 from public.orders o
    join public.customers c on c.id = o.customer_id
    where o.id = order_items.order_id and c.user_id = auth.uid()));

create policy "owner wishlists" on public.wishlists
  for all using (exists (select 1 from public.customers c
                         where c.id = wishlists.customer_id
                           and c.user_id = auth.uid()))
  with check (exists (select 1 from public.customers c
                      where c.id = wishlists.customer_id
                        and c.user_id = auth.uid()));

-- NOTE: service-role / admin access bypasses RLS. Keep SUPABASE_SERVICE_ROLE_KEY
-- server-side only; admin CRUD + seller tables are protected by app role checks.
