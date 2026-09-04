-- ============================================================================
-- Fix: first-user-becomes-admin failed with "Database error saving new user"
-- ----------------------------------------------------------------------------
-- Root cause: handle_new_user promotes the very first profile to admin with an
-- UPDATE, but that update fires profiles_guard_role, which rejects role changes
-- when auth.uid() is null (true during sign-up, before any session exists).
--
-- Fix: disable the guard trigger around the promotion update only.
-- Idempotent — safe to run as many times as you like.
-- ============================================================================

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
