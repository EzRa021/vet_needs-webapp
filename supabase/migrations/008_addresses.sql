-- ============================================================
-- 008_addresses.sql
-- Saved delivery addresses (the account address book), so a repeat
-- customer doesn't retype their address at every checkout.
--
-- Column names mirror the `shippingInfo` shape the checkout form and
-- /api/checkout/create-order already use (first_name, last_name,
-- address, address2, city, state, zip, country) so the picker can
-- fill the form without a translation layer.
--
-- Deliberately NO email column: email is account-level, not
-- per-address, and create-order takes it from the signed-in user.
--
-- Idempotent; safe to re-run.
-- ============================================================

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- "Home", "Shop", "Farm" — helps a customer tell two addresses apart.
  label text,

  first_name text not null,
  last_name text not null,
  phone text not null,
  address text not null,
  address2 text,
  city text not null,
  state text not null,
  zip text,                       -- optional: postal codes are rarely used in NG
  country text not null default 'NG',

  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists addresses_user_id_idx on public.addresses (user_id);

-- At most ONE default per user, enforced by the database rather than by
-- hopeful application code. Partial, so the many non-default rows don't
-- collide with each other.
create unique index if not exists addresses_one_default_per_user_idx
  on public.addresses (user_id)
  where is_default;

drop trigger if exists addresses_set_updated_at on public.addresses;
create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Keeping "exactly one default" true without making the client do it.
-- ------------------------------------------------------------
create or replace function public.addresses_apply_default()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- The first address a customer saves is their default — otherwise they'd
  -- have a single address that isn't selected anywhere, which reads as broken.
  if tg_op = 'INSERT' and not exists (
    select 1 from public.addresses where user_id = new.user_id
  ) then
    new.is_default := true;
  end if;

  -- Promoting one address demotes the rest. Without this, the partial unique
  -- index above would simply reject the second default with a 23505 and the
  -- customer could never change their default at all.
  if new.is_default then
    update public.addresses
       set is_default = false
     where user_id = new.user_id
       and id <> new.id
       and is_default;
  end if;

  return new;
end;
$$;

drop trigger if exists addresses_apply_default_trigger on public.addresses;
create trigger addresses_apply_default_trigger
  before insert or update on public.addresses
  for each row execute function public.addresses_apply_default();

-- Deleting the default would otherwise leave a customer with addresses but no
-- default, and checkout with nothing preselected.
create or replace function public.addresses_promote_after_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.is_default then
    update public.addresses
       set is_default = true
     where id = (
       select id from public.addresses
        where user_id = old.user_id
        order by created_at desc
        limit 1
     );
  end if;
  return null;
end;
$$;

drop trigger if exists addresses_promote_after_delete_trigger on public.addresses;
create trigger addresses_promote_after_delete_trigger
  after delete on public.addresses
  for each row execute function public.addresses_promote_after_delete();

-- ------------------------------------------------------------
-- RLS — an address book is private. Not even staff need to read it:
-- the delivery address is snapshotted onto the order at checkout,
-- which is what fulfilment actually uses.
-- ------------------------------------------------------------
alter table public.addresses enable row level security;

drop policy if exists "users manage own addresses" on public.addresses;
create policy "users manage own addresses" on public.addresses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.addresses is
  'Customer address book. Orders snapshot the address text at checkout, so editing or deleting an address never rewrites the delivery details of an order already placed.';
