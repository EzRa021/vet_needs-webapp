-- ============================================================
-- 031_delivery_states.sql
-- Door delivery to every state, priced one of two ways per state.
--
-- 029 made delivery Ibadan-only: one fixed price per area. The shop now
-- delivers anywhere in Nigeria, but only Ibadan has prices worked out:
--
--   fixed  The customer picks their area and pays that area's price at
--          checkout (029, unchanged). On for Oyo.
--   quote  The customer places and pays for the order without a delivery
--          fee; the shop calls or WhatsApps them to agree it before
--          dispatch. On for every other state, for now.
--
-- Switching a state to `fixed` later needs no schema change: give it areas
-- with prices (delivery_areas already carries state and city) and flip the
-- mode on the admin Delivery page. Until a fixed state has at least one
-- priced area, checkout treats it as `quote`, so nobody is ever blocked.
--
-- What this does:
--   delivery_states  one row per state (the 36 + FCT, spelled as the app's
--                    NIGERIAN_STATES list in lib/nigeria.js), with its mode
--   delivery_areas   state must be one of those rows (foreign key), so an
--                    area can't be filed under a misspelt state
--
-- Orders need no change: a quote order is a delivery order whose snapshot
-- (orders.delivery) says pricing: 'quote' and whose shipping_fee is 0 until
-- staff agree the fee with the customer.
--
-- Idempotent; safe to re-run.
-- ============================================================

create table if not exists public.delivery_states (
  state text primary key,
  pricing_mode text not null default 'quote'
    check (pricing_mode in ('fixed', 'quote')),
  updated_at timestamptz not null default now()
);

drop trigger if exists delivery_states_set_updated_at on public.delivery_states;
create trigger delivery_states_set_updated_at
  before update on public.delivery_states
  for each row execute function public.set_updated_at();

insert into public.delivery_states (state, pricing_mode)
select s, case when s = 'Oyo' then 'fixed' else 'quote' end
  from unnest(array[
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
    'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
    'FCT Abuja', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina',
    'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo',
    'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
  ]) as s
on conflict (state) do nothing;

-- Same rule as the other delivery tables (028): public read — checkout shows
-- it — and staff manage it.
alter table public.delivery_states enable row level security;
drop policy if exists "delivery_states readable by all" on public.delivery_states;
create policy "delivery_states readable by all" on public.delivery_states
  for select using (true);
drop policy if exists "staff manage delivery_states" on public.delivery_states;
create policy "staff manage delivery_states" on public.delivery_states
  for all using (public.is_staff()) with check (public.is_staff());
grant select on public.delivery_states to anon, authenticated;
grant update on public.delivery_states to authenticated;
grant all on public.delivery_states to service_role;

-- Every area belongs to a real state. 029 left only Ibadan areas, all
-- 'Oyo', which is seeded above.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'delivery_areas_state_fkey'
  ) then
    alter table public.delivery_areas
      add constraint delivery_areas_state_fkey
      foreign key (state) references public.delivery_states (state)
      on update cascade;
  end if;
end
$$;

create index if not exists delivery_areas_state_idx on public.delivery_areas (state);
