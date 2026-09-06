-- ============================================================================
-- 0004 — AI Marketing Pipeline ("Saree → Reel" automation)
-- ----------------------------------------------------------------------------
-- Gives every product an automated marketing pipeline:
--
--   pending → tryon_processing → tryon_completed → rendering_video
--           → publishing → published        (any step → failed)
--
-- Trigger: the admin app enqueues products DIRECTLY in state 'pending'
-- (POST /api/admin/marketing with { slug }). A BEFORE INSERT trigger also
-- auto-converts any row inserted with db_status='pending' (defence in depth
-- for bulk/SQL imports — the original Supabase-webhook design).
--
-- New columns on public.products:
--   marketing            jsonb  — pipeline state + generated assets:
--       { pipeline: { status, attempts, error?, queuedAt?, ...timestamps },
--         tryOn: { imageUrl, modelId }, copy: { headline, bullets, cta,
--         hashtags, language }, video: { url, storagePath },
--         publish: { fbPostId?, igMediaId?, publishedAt? } }
--   marketing_updated_at timestamptz
--
-- Storage buckets (public): base-models, model-renders, reels.
-- ============================================================================
-- The db_status check constraint is inline+unnamed in 0001, so drop the
-- default-named constraint and re-add it with the pipeline states included.
alter table public.products drop constraint if exists products_db_status_check;
alter table public.products
  add constraint products_db_status_check
  check (db_status in (
    'active', 'draft', 'deleted',
    'pending', 'tryon_processing', 'tryon_completed',
    'rendering_video', 'publishing', 'published', 'failed'
  ));

alter table public.products
  add column if not exists marketing jsonb not null default '{}'::jsonb;
alter table public.products
  add column if not exists marketing_updated_at timestamptz;

create index if not exists products_marketing_status_idx
  on public.products ((coalesce(marketing -> 'pipeline' ->> 'status', db_status)));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- SEO-friendly slug (shared by ensure_category + the app's fallback logic).
create or replace function public.slugify_name(p_name text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(
      regexp_replace(lower(trim(coalesce(p_name, ''))), '[^a-z0-9]+', '-', 'g'),
      '^-+|-+$', '', 'g'
    ),
    ''
  );
$$;

-- Case-insensitive category resolution: returns the existing slug for a
-- category name (any case), or creates it (with a unique SEO slug) and
-- returns the new slug. Security definer so trigger/queue callers never hit
-- RLS friction. Never errors on unique-slug collisions (suffixes -2, -3...).
create or replace function public.ensure_category(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text;
  v_base text;
  v_n integer := 1;
begin
  if v_name = '' then
    return null;
  end if;

  -- Case-insensitive match on name or slug → reuse it.
  select slug into v_slug
    from public.categories
   where lower(name) = lower(v_name) or slug = lower(v_name)
   limit 1;
  if v_slug is not null then
    return v_slug;
  end if;

  v_base := coalesce(public.slugify_name(v_name), 'category');
  v_slug := v_base;
  while exists (select 1 from public.categories where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.categories (slug, name, short, blurb)
  values (v_slug, v_name, v_name, 'Added by the marketing pipeline')
  on conflict (slug) do nothing;

  return v_slug;
end $$;

-- ---------------------------------------------------------------------------
-- Auto-enqueue: inserting a product with db_status='pending' starts the
-- marketing pipeline. The app writes this state directly on enqueue; the
-- trigger keeps raw/SQL imports working and guarantees the category link.
-- ---------------------------------------------------------------------------
create or replace function public.marketing_enqueue_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.db_status = 'pending' then
    -- Link/insert the category by NAME if the caller passed one; a valid
    -- slug passes through untouched (FK still validates it below).
    if new.category is null or not exists (
      select 1 from public.categories c where c.slug = new.category
    ) then
      new.category := coalesce(public.ensure_category(new.category), new.category);
    end if;
    new.marketing := jsonb_build_object(
      'pipeline', jsonb_build_object(
        'status', 'pending',
        'attempts', 0,
        'queuedAt', now()
      )
    );
    new.marketing_updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists products_marketing_enqueue on public.products;
create trigger products_marketing_enqueue
  before insert on public.products
  for each row execute function public.marketing_enqueue_on_insert();

-- ---------------------------------------------------------------------------
-- Pipeline state machine (admin-gated RPC the orchestrator calls between
-- stages). Validates transitions, merges the patch, bumps updated_at.
--   status:  pending | tryon_processing | tryon_completed | rendering_video
--            | publishing | published | failed
--   patch:   partial marketing jsonb, e.g. {"tryOn": {...}, "pipeline": {"error": "..."}}
--            ("pipeline.status" inside the patch is ignored — pass p_status.)
-- ---------------------------------------------------------------------------
create or replace function public.advance_marketing(
  p_product uuid,
  p_from text,
  p_status text,
  p_patch jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed text[] := array[
    'pending', 'tryon_processing', 'tryon_completed',
    'rendering_video', 'publishing', 'published', 'failed'
  ];
  v_row public.products;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only admins can advance the marketing pipeline';
  end if;
  if p_status is null or not (p_status = any(v_allowed)) then
    raise exception 'Unknown pipeline status: %', coalesce(p_status, 'NULL');
  end if;

  select * into v_row from public.products where id = p_product;
  if not found then
    raise exception 'Product not found';
  end if;
  if coalesce(v_row.marketing -> 'pipeline' ->> 'status', v_row.db_status) <> p_from then
    raise exception 'Pipeline moved on (expected %, found %)',
      p_from, coalesce(v_row.marketing -> 'pipeline' ->> 'status', v_row.db_status);
  end if;

  update public.products
     set marketing = jsonb_strip_nulls(
           jsonb_set(
             jsonb_set(v_row.marketing, '{pipeline,status}', to_jsonb(p_status)),
             '{pipeline,attempts}',
             to_jsonb(coalesce((v_row.marketing -> 'pipeline' ->> 'attempts')::int, 0) + 1)
           ) || coalesce(p_patch, '{}'::jsonb)
         ),
         marketing_updated_at = now(),
         updated_at = now()
   where id = p_product
   returning marketing into v_row.marketing;

  return v_row.marketing;
end $$;

-- Admin queue view: products currently inside the pipeline.
create or replace function public.marketing_queue()
returns table (
  id uuid, slug text, name text, category text,
  status text, attempts integer, error text, updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.slug, p.name, p.category,
         coalesce(p.marketing -> 'pipeline' ->> 'status', p.db_status),
         coalesce((p.marketing -> 'pipeline' ->> 'attempts')::int, 0),
         p.marketing -> 'pipeline' ->> 'error',
         coalesce(p.marketing_updated_at, p.updated_at)
    from public.products p
   where p.db_status in (
     'pending', 'tryon_processing', 'tryon_completed',
     'rendering_video', 'publishing', 'failed'
   )
   order by coalesce(p.marketing_updated_at, p.updated_at) desc;
$$;

grant execute on function public.advance_marketing to authenticated;
grant execute on function public.marketing_queue to authenticated;

-- ---------------------------------------------------------------------------
-- Storage buckets (public): base model avatars, AI try-on renders, reels.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('base-models', 'base-models', true),
       ('model-renders', 'model-renders', true),
       ('reels', 'reels', true)
on conflict (id) do update set public = true;

do $$
begin
  drop policy if exists "Pipeline public read" on storage.objects;
  create policy "Pipeline public read" on storage.objects
    for select
    using (bucket_id in ('base-models', 'model-renders', 'reels'));

  drop policy if exists "Pipeline admin manage" on storage.objects;
  create policy "Pipeline admin manage" on storage.objects
    for all
    using (bucket_id in ('base-models', 'model-renders', 'reels') and public.is_admin())
    with check (bucket_id in ('base-models', 'model-renders', 'reels') and public.is_admin());
end $$;

-- ============================================================================
-- CONVERT EXISTING DRAFTS (optional, run once):
--
--   update public.products
--      set db_status = 'tryon_processing',
--          marketing = jsonb_build_object('pipeline', jsonb_build_object(
--            'status', 'tryon_processing', 'attempts', 0, 'queuedAt', now())),
--          marketing_updated_at = now()
--    where db_status = 'draft';
-- ============================================================================
