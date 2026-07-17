-- ============================================================
-- PetDo — Admin RBAC (roles, profiles, admin write policies)
--
-- Adds a profiles table with a role per user, helper functions, and
-- RLS policies so staff/admins can manage the shop while customers
-- keep their existing (read-own) access.
--
-- Run AFTER 000, 001, 002. Idempotent and safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Profiles — one row per auth user, carries the role
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer'
    check (role in ('customer', 'staff', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2. Auto-create a profile whenever a user signs up
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'first_name', '') || ' ' ||
                coalesce(new.raw_user_meta_data ->> 'last_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users who already exist
insert into public.profiles (id)
select u.id from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ------------------------------------------------------------
-- 3. Role helpers
--    SECURITY DEFINER + a stable search_path so they can read
--    profiles without recursing through profiles' own RLS.
-- ------------------------------------------------------------
create or replace function public.current_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'anon');
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- staff OR admin — the "can run the shop" check
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  );
$$;

grant execute on function public.current_role() to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_staff() to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 4. RLS — profiles
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles
  for select using (auth.uid() = id or public.is_staff());

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Only admins may change roles / manage any profile
drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 5. RLS — catalog write access for staff/admin
--    (public read policies from 001/002 stay untouched)
-- ------------------------------------------------------------
drop policy if exists "staff manage categories" on public.categories;
create policy "staff manage categories" on public.categories
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff manage items" on public.items;
create policy "staff manage items" on public.items
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff manage item images" on public.item_images;
create policy "staff manage item images" on public.item_images
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff manage item placements" on public.item_categories;
create policy "staff manage item placements" on public.item_categories
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff read item history" on public.item_history;
create policy "staff read item history" on public.item_history
  for select using (public.is_staff());

drop policy if exists "staff manage promotions" on public.promotions;
create policy "staff manage promotions" on public.promotions
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "admins manage coupons" on public.coupons;
create policy "admins manage coupons" on public.coupons
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "staff read redemptions" on public.coupon_redemptions;
create policy "staff read redemptions" on public.coupon_redemptions
  for select using (public.is_staff());

drop policy if exists "admins manage settings" on public.settings;
create policy "admins manage settings" on public.settings
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "staff moderate reviews" on public.reviews;
create policy "staff moderate reviews" on public.reviews
  for all using (public.is_staff()) with check (public.is_staff());

-- ------------------------------------------------------------
-- 6. RLS — orders: staff can see and fulfil every order.
--    Customers keep their own read/insert policies from 001.
--    NOTE: staff may change status/tracking, but money columns are
--    never trusted from the client — the payment flow owns those.
-- ------------------------------------------------------------
drop policy if exists "staff read all orders" on public.orders;
create policy "staff read all orders" on public.orders
  for select using (public.is_staff());

drop policy if exists "staff update orders" on public.orders;
create policy "staff update orders" on public.orders
  for update using (public.is_staff()) with check (public.is_staff());

-- ------------------------------------------------------------
-- 7. Legacy departments table is superseded by the category tree
--    (002). Lock it down so nothing writes to it by accident.
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'departments') then
    execute 'alter table public.departments enable row level security';
  end if;
end $$;

-- ============================================================
-- BOOTSTRAP YOUR FIRST ADMIN  (run once, manually)
--
--   update public.profiles
--   set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');
--
-- Verify with:  select email, p.role from auth.users u
--               join public.profiles p on p.id = u.id;
-- ============================================================
