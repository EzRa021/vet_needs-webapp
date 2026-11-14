-- ============================================================
-- 028_delivery_areas.sql
-- Delivery priced by AREA and ORDER WEIGHT, plus store pickup.
--
-- 014 priced delivery per state: all of Oyo was one number, so Bodija
-- (next door) and Moniya (the far edge of Ibadan) cost the same, and two
-- bags of feed cost the same as twenty. The shop has one store, in
-- Ibadan, and delivers with its own riders locally and through a
-- logistics company further out. What it actually pays depends on
-- where the order goes and how heavy it is, so that's what this prices.
--
-- Shape, building on 014 rather than beside it:
--
--   delivery_weight_bands  shop-wide weight steps: up to 10 kg, 10–50 kg…
--   shipping_zones         (014) gains `city`. A zone with a city is an
--                          AREA zone ("Ibadan Central"); a zone without one
--                          is a STATE zone, exactly as before.
--   shipping_zone_rates    one price per zone per weight band.
--   delivery_areas         named places ("Bodija") the customer picks at
--                          checkout, each assigned to an area zone.
--   pickup_points          where an order can be collected, and the fee.
--   orders                 + fulfilment_method, delivery (a snapshot of
--                          how the fee was worked out), pickup_code.
--
-- PRICE RULE (resolve_delivery below):
--   * a zone with band rates charges the rate for the order's band; a band
--     with no rate means "can't price online" (call us / pick up), never ₦0.
--   * a zone with NO rates charges its flat `fee`, which is how every 014
--     zone keeps working unchanged until someone adds band prices.
--   * a zone with neither is unpriced, and its areas aren't offered.
--
-- Nothing here invents a price. Zones and areas are seeded as names only;
-- the shop fills in what it really pays riders and couriers. Area pricing
-- also starts switched OFF (settings.area_pricing_enabled), so checkout
-- behaves exactly as it did until staff turn it on.
--
-- Idempotent; safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- Weight bands
-- ------------------------------------------------------------
create table if not exists public.delivery_weight_bands (
  id uuid primary key default gen_random_uuid(),
  -- Upper limit of the band, inclusive. NULL = "and above" (the last band).
  -- The lower limit is the previous band's upper limit, so bands can never
  -- overlap or leave a gap.
  up_to_kg numeric(10, 3) check (up_to_kg is null or up_to_kg > 0),
  created_at timestamptz not null default now()
);

-- One band per limit, and at most one open-ended band (coalesce folds every
-- NULL onto 0, which a real limit can't be).
create unique index if not exists delivery_weight_bands_limit_idx
  on public.delivery_weight_bands ((coalesce(up_to_kg, 0)));

insert into public.delivery_weight_bands (up_to_kg)
select v.kg
  from (values (10::numeric), (50), (150), (null)) as v(kg)
 where not exists (select 1 from public.delivery_weight_bands);

-- ------------------------------------------------------------
-- Zones: area zones alongside 014's state zones
-- ------------------------------------------------------------
alter table public.shipping_zones add column if not exists city text;
alter table public.shipping_zones add column if not exists is_city_fallback boolean not null default false;

-- A zone priced only by band has no single flat fee.
alter table public.shipping_zones alter column fee drop not null;

do $$
begin
  -- An area zone is chosen through its areas, never by state. With states it
  -- would be two zones in one row; with empty states 014 would read it as the
  -- nationwide catch-all.
  if not exists (select 1 from pg_constraint where conname = 'shipping_zones_city_has_no_states') then
    alter table public.shipping_zones
      add constraint shipping_zones_city_has_no_states
      check (city is null or cardinality(states) = 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shipping_zones_fallback_needs_city') then
    alter table public.shipping_zones
      add constraint shipping_zones_fallback_needs_city
      check (not is_city_fallback or city is not null);
  end if;
end
$$;

-- "My area isn't listed" needs exactly one answer per city.
create unique index if not exists shipping_zones_one_fallback_per_city_idx
  on public.shipping_zones (lower(city))
  where is_city_fallback;

comment on column public.shipping_zones.city is
  'Set = an AREA zone for this city, matched through delivery_areas. NULL = a STATE zone matched by states[] (014).';
comment on column public.shipping_zones.is_city_fallback is
  'Prices "my area isn''t listed" for this city. At most one per city.';
comment on column public.shipping_zones.fee is
  'Flat fee for any weight, used ONLY when the zone has no shipping_zone_rates. NULL with no rates = unpriced.';

-- ------------------------------------------------------------
-- Price per zone per weight band
-- ------------------------------------------------------------
create table if not exists public.shipping_zone_rates (
  zone_id uuid not null references public.shipping_zones (id) on delete cascade,
  band_id uuid not null references public.delivery_weight_bands (id) on delete cascade,
  -- No row (rather than a NULL fee) is how "no online price for this weight"
  -- is written, so there is exactly one way to say it.
  fee numeric(12, 2) not null check (fee >= 0),
  updated_at timestamptz not null default now(),
  primary key (zone_id, band_id)
);

drop trigger if exists shipping_zone_rates_set_updated_at on public.shipping_zone_rates;
create trigger shipping_zone_rates_set_updated_at
  before update on public.shipping_zone_rates
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Areas
-- ------------------------------------------------------------
create table if not exists public.delivery_areas (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  state text not null,
  name text not null,
  -- Other names customers use ("UI" for University of Ibadan). Searched by
  -- the checkout picker; never shown as separate choices.
  aliases text[] not null default '{}',
  -- NULL = not assigned to a zone yet, so not offered at checkout.
  zone_id uuid references public.shipping_zones (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists delivery_areas_city_name_idx
  on public.delivery_areas (lower(city), lower(name));
create index if not exists delivery_areas_zone_idx on public.delivery_areas (zone_id);

drop trigger if exists delivery_areas_set_updated_at on public.delivery_areas;
create trigger delivery_areas_set_updated_at
  before update on public.delivery_areas
  for each row execute function public.set_updated_at();

-- An Ibadan area in a Lagos zone would charge Lagos prices for Ibadan
-- deliveries, and nothing on screen would look wrong. Refuse it.
create or replace function public.delivery_area_zone_matches_city()
returns trigger
language plpgsql set search_path = public as $$
declare
  v_city text;
begin
  if new.zone_id is null then
    return new;
  end if;
  select city into v_city from public.shipping_zones where id = new.zone_id;
  if v_city is null or lower(trim(v_city)) <> lower(trim(new.city)) then
    raise exception 'Area "%" is in %, so it can only go in a % zone.', new.name, new.city, new.city
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists delivery_areas_zone_city on public.delivery_areas;
create trigger delivery_areas_zone_city
  before insert or update of zone_id, city on public.delivery_areas
  for each row execute function public.delivery_area_zone_matches_city();

-- ------------------------------------------------------------
-- Pickup points
-- ------------------------------------------------------------
create table if not exists public.pickup_points (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  city text not null,
  state text not null,
  phone text,
  hours text,                -- "Mon–Sat, 8am–6pm"
  map_url text,              -- a Google Maps link to the store, if they have one
  instructions text,         -- "Ask at the feed counter"
  -- Charged for pickup orders. 0 = free; the shop can charge for handling.
  fee numeric(12, 2) not null default 0 check (fee >= 0),
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A pickup point nobody can find is worse than none.
  constraint pickup_points_active_needs_address
    check (not is_active or length(trim(address)) > 0)
);

drop trigger if exists pickup_points_set_updated_at on public.pickup_points;
create trigger pickup_points_set_updated_at
  before update on public.pickup_points
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Orders
-- ------------------------------------------------------------
alter table public.orders
  add column if not exists fulfilment_method text not null default 'delivery';
alter table public.orders add column if not exists delivery jsonb;
alter table public.orders add column if not exists pickup_code text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_fulfilment_method_check') then
    alter table public.orders
      add constraint orders_fulfilment_method_check
      check (fulfilment_method in ('delivery', 'pickup'));
  end if;
end
$$;

comment on column public.orders.fulfilment_method is
  'delivery | pickup. Pickup orders reuse shipped/delivered, shown as "Ready for pickup"/"Collected" (lib/order-status.js).';
comment on column public.orders.delivery is
  'Snapshot of how shipping_fee was worked out (method, area, zone, weight, band, landmark, GPS, pickup point). Later price edits never change it.';
comment on column public.orders.pickup_code is
  'Six digits the customer shows when collecting a pickup order.';

-- 027 grants orders to the client roles column by column, so a new column
-- is invisible to customers until granted. These three are the customer's
-- own data (RLS still limits them to their own rows).
grant select (fulfilment_method, delivery, pickup_code) on public.orders to anon, authenticated;

-- The guest order page reads through this function, not the table (011).
-- Its return type grows, which CREATE OR REPLACE can't do.
drop function if exists public.get_guest_order(uuid, uuid);
create function public.get_guest_order(p_order_id uuid, p_token uuid)
returns table (
  id uuid,
  created_at timestamptz,
  paid_at timestamptz,
  status text,
  email text,
  subtotal numeric,
  shipping_fee numeric,
  tax_amount numeric,
  discount_amount numeric,
  coupon_code text,
  total_amount numeric,
  order_items jsonb,
  shipping_address text,
  tracking_number text,
  notes text,
  payment_reference text,
  fulfilment_method text,
  delivery jsonb,
  pickup_code text
)
language plpgsql security definer set search_path = public as $$
begin
  if p_order_id is null or p_token is null then
    return;
  end if;

  return query
    select o.id, o.created_at, o.paid_at, o.status, o.email, o.subtotal,
           o.shipping_fee, o.tax_amount, o.discount_amount, o.coupon_code,
           o.total_amount, o.order_items, o.shipping_address, o.tracking_number,
           o.notes, o.payment_reference, o.fulfilment_method, o.delivery,
           o.pickup_code
      from public.orders o
     where o.id = p_order_id
       and o.guest_token = p_token
       and o.user_id is null;
end;
$$;

revoke all on function public.get_guest_order(uuid, uuid) from public;
grant execute on function public.get_guest_order(uuid, uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- Product weights
--
-- Weight pricing needs weight_grams on every piece item, and the column has
-- existed since 000 without anything filling it. Feed already says its size
-- in an attribute ("25kg"), so take it from there where it's unambiguous.
-- Never overwrites a weight someone entered.
-- ------------------------------------------------------------
update public.items i
   set weight_grams = round(
         (substring(src.v from '^([0-9]+(?:\.[0-9]+)?)')::numeric)
         * case when src.v ~* 'kg$' then 1000 else 1 end
       )
  from (
    select id, lower(regexp_replace(coalesce(attributes ->> 'bag_size', attributes ->> 'size', attributes ->> 'weight'), '\s+', '', 'g')) as v
      from public.items
  ) src
 where src.id = i.id
   and i.weight_grams is null
   and i.unit_type = 'piece'
   and src.v ~ '^[0-9]+(\.[0-9]+)?(kg|g)$';

-- ------------------------------------------------------------
-- 014's state resolver must not pick up area zones: they have no states,
-- which is exactly what 014 reads as "the catch-all".
-- ------------------------------------------------------------
create or replace function public.resolve_shipping(p_state text)
returns table (
  zone_id uuid,
  zone_name text,
  fee numeric,
  free_over numeric,
  delivery_estimate text
)
language sql stable security definer set search_path = public as $$
  select z.id, z.name,
         -- Band-priced zones have no flat fee; quote their lightest band.
         coalesce(
           case when exists (select 1 from public.shipping_zone_rates r where r.zone_id = z.id)
                then (select r.fee
                        from public.shipping_zone_rates r
                        join public.delivery_weight_bands b on b.id = r.band_id
                       where r.zone_id = z.id
                       order by b.up_to_kg asc nulls last
                       limit 1)
                else z.fee
           end,
           0
         ),
         z.free_over, z.delivery_estimate
    from public.shipping_zones z
   where z.is_active
     and z.city is null
     and (
       (p_state is not null and exists (
          select 1 from unnest(z.states) s
           where lower(trim(s)) = lower(trim(p_state))
        ))
       or cardinality(z.states) = 0
     )
   order by
     case when cardinality(z.states) = 0 then 1 else 0 end,
     z.sort_order,
     z.name
   limit 1;
$$;

-- ------------------------------------------------------------
-- resolve_delivery: which zone, which band, what fee.
--
--   p_area_id      the area the customer picked          → that area's zone
--   p_city         "my area in <city> isn't listed"      → the city's fallback zone
--   neither        a state-level delivery                → 014 state zones
--   p_weight_kg    the order's weight, computed by the server from the catalogue
--
-- Returns no row when nothing matches. Returns fee NULL when the zone can't
-- price this weight online. The caller decides what to tell the customer;
-- this function never turns "unknown" into ₦0.
--
-- SECURITY DEFINER + anon: checkout quotes before the shopper has an account.
-- It reads only public pricing.
-- ------------------------------------------------------------
create or replace function public.resolve_delivery(
  p_state text,
  p_city text,
  p_area_id uuid,
  p_weight_kg numeric
)
returns table (
  zone_id uuid,
  zone_name text,
  zone_city text,
  delivery_estimate text,
  free_over numeric,
  area_id uuid,
  area_name text,
  area_city text,
  area_state text,
  band_id uuid,
  band_from_kg numeric,
  band_up_to_kg numeric,
  fee numeric,
  matched_by text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_zone public.shipping_zones%rowtype;
  v_area public.delivery_areas%rowtype;
  v_match text;
  v_weight numeric := greatest(coalesce(p_weight_kg, 0), 0);
  v_band_id uuid;
  v_band_up numeric;
  v_band_from numeric;
  v_fee numeric;
begin
  if p_area_id is not null then
    select * into v_area
      from public.delivery_areas a
     where a.id = p_area_id and a.is_active;
    if not found then return; end if;

    select * into v_zone
      from public.shipping_zones z
     where z.id = v_area.zone_id and z.is_active;
    if not found then return; end if;
    v_match := 'area';

  elsif nullif(trim(p_city), '') is not null then
    select * into v_zone
      from public.shipping_zones z
     where z.is_active
       and z.is_city_fallback
       and lower(trim(z.city)) = lower(trim(p_city))
     limit 1;
    if not found then return; end if;
    v_match := 'city';

  else
    select * into v_zone
      from public.shipping_zones z
     where z.is_active
       and z.city is null
       and (
         (p_state is not null and exists (
            select 1 from unnest(z.states) s
             where lower(trim(s)) = lower(trim(p_state))
          ))
         or cardinality(z.states) = 0
       )
     order by
       case when cardinality(z.states) = 0 then 1 else 0 end,
       z.sort_order,
       z.name
     limit 1;
    if not found then return; end if;
    v_match := case when cardinality(v_zone.states) = 0 then 'catch_all' else 'state' end;
  end if;

  -- The lightest band that holds this weight.
  select b.id, b.up_to_kg
    into v_band_id, v_band_up
    from public.delivery_weight_bands b
   where b.up_to_kg is null or b.up_to_kg >= v_weight
   order by b.up_to_kg asc nulls last
   limit 1;

  if v_band_id is not null then
    select max(b.up_to_kg) into v_band_from
      from public.delivery_weight_bands b
     where b.up_to_kg is not null
       and (v_band_up is null or b.up_to_kg < v_band_up);
  end if;

  if exists (select 1 from public.shipping_zone_rates r where r.zone_id = v_zone.id) then
    -- Band-priced. A weight past the last band, or a band left empty, has
    -- no online price: v_fee stays NULL.
    if v_band_id is not null then
      select r.fee into v_fee
        from public.shipping_zone_rates r
       where r.zone_id = v_zone.id and r.band_id = v_band_id;
    end if;
  else
    v_fee := v_zone.fee; -- flat (014 behaviour); NULL if unpriced
  end if;

  return query select
    v_zone.id, v_zone.name, v_zone.city, v_zone.delivery_estimate, v_zone.free_over,
    v_area.id, v_area.name, v_area.city, v_area.state,
    v_band_id, coalesce(v_band_from, 0), v_band_up,
    v_fee, v_match;
end;
$$;

revoke all on function public.resolve_delivery(text, text, uuid, numeric) from public;
grant execute on function public.resolve_delivery(text, text, uuid, numeric) to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- RLS: prices, areas and pickup points are public (checkout shows them);
-- staff maintain them. Same rule as shipping_zones (014).
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['delivery_weight_bands', 'shipping_zone_rates', 'delivery_areas', 'pickup_points']
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%s readable by all" on public.%I', t, t);
    execute format('create policy "%s readable by all" on public.%I for select using (true)', t, t);

    execute format('drop policy if exists "staff manage %s" on public.%I', t, t);
    execute format(
      'create policy "staff manage %s" on public.%I for all using (public.is_staff()) with check (public.is_staff())',
      t, t
    );

    -- Explicit, rather than relying on the project's default privileges.
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end
$$;

-- ------------------------------------------------------------
-- Setting: area pricing starts OFF.
-- ------------------------------------------------------------
insert into public.settings (key, value, description, is_public)
values (
  'area_pricing_enabled',
  'false',
  'Price delivery by area and order weight at checkout (028). Off = state prices only.',
  true
)
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- Unrelated fix found while testing the Delivery page.
--
-- Saving Settings with "Free shipping over" blank failed with "null value in
-- column value violates not-null constraint". The page sends blank as null,
-- which the API writes as SQL NULL (PostgREST can't send a JSON null to a
-- jsonb column), and the Settings page saves every field at once — so with
-- the threshold blank, which is the default, no setting could be saved.
-- NULL here means "not set"; lib/settings.js and 014 already read it so.
-- ------------------------------------------------------------
alter table public.settings alter column value drop not null;

-- ------------------------------------------------------------
-- Seed: names only, NO prices. Skipped entirely once any area zone exists,
-- so re-running never re-adds something staff deleted.
-- ------------------------------------------------------------
do $$
declare
  z_ib_central uuid;
  z_ib_middle uuid;
  z_ib_outer uuid;
  z_lg_mainland uuid;
  z_lg_island uuid;
  z_lg_outskirts uuid;
begin
  if exists (select 1 from public.shipping_zones where city is not null) then
    return;
  end if;

  -- Ibadan: three rings around the store. Areas start UNASSIGNED because
  -- which ring a place is in depends on where the store is; staff sort them.
  insert into public.shipping_zones (name, city, states, fee, sort_order, delivery_estimate)
  values ('Ibadan Central', 'Ibadan', '{}', null, 10, 'Same or next day')
  returning id into z_ib_central;
  insert into public.shipping_zones (name, city, states, fee, sort_order, delivery_estimate)
  values ('Ibadan Middle', 'Ibadan', '{}', null, 20, 'Same or next day')
  returning id into z_ib_middle;
  insert into public.shipping_zones (name, city, states, fee, sort_order, delivery_estimate, is_city_fallback)
  values ('Ibadan Outer', 'Ibadan', '{}', null, 30, 'Next day', true)
  returning id into z_ib_outer;

  -- Lagos: delivered through a logistics company. Pre-sorted by geography,
  -- which doesn't depend on the store.
  insert into public.shipping_zones (name, city, states, fee, sort_order, delivery_estimate)
  values ('Lagos Mainland', 'Lagos', '{}', null, 40, '1–3 working days')
  returning id into z_lg_mainland;
  insert into public.shipping_zones (name, city, states, fee, sort_order, delivery_estimate)
  values ('Lagos Island & Lekki', 'Lagos', '{}', null, 50, '1–3 working days')
  returning id into z_lg_island;
  insert into public.shipping_zones (name, city, states, fee, sort_order, delivery_estimate, is_city_fallback)
  values ('Lagos Outskirts', 'Lagos', '{}', null, 60, '2–4 working days', true)
  returning id into z_lg_outskirts;

  insert into public.delivery_areas (city, state, name, aliases, zone_id)
  select 'Ibadan', 'Oyo', v.name, v.aliases, null
    from (values
      ('Agbowo', '{}'::text[]),
      ('Agodi', '{"Agodi GRA"}'),
      ('Ajibode', '{}'),
      ('Akala Express', '{"Akala"}'),
      ('Akobo', '{"Akobo Estate"}'),
      ('Alakia', '{}'),
      ('Apata', '{}'),
      ('Apete', '{}'),
      ('Ashi', '{}'),
      ('Basorun', '{}'),
      ('Beere', '{}'),
      ('Bodija', '{"Old Bodija","New Bodija"}'),
      ('Challenge', '{}'),
      ('Dugbe', '{}'),
      ('Egbeda', '{}'),
      ('Elebu', '{}'),
      ('Eleyele', '{}'),
      ('Felele', '{}'),
      ('Gate', '{}'),
      ('Idi-Ape', '{"Idi Ape"}'),
      ('Idi-Ishin', '{"Idi Ishin"}'),
      ('Ikolaba', '{}'),
      ('Iwo Road', '{"Iwo-Road"}'),
      ('Iyaganku', '{"Iyaganku GRA"}'),
      ('Jericho', '{}'),
      ('Kongi', '{}'),
      ('Liberty', '{"Liberty Road"}'),
      ('Mapo', '{}'),
      ('Mokola', '{}'),
      ('Molete', '{}'),
      ('Moniya', '{}'),
      ('Odo-Ona', '{"Odo Ona"}'),
      ('Oje', '{}'),
      ('Ojoo', '{}'),
      ('Oke-Ado', '{"Oke Ado"}'),
      ('Oke-Bola', '{"Oke Bola"}'),
      ('Olodo', '{}'),
      ('Ologuneru', '{}'),
      ('Olorunsogo', '{}'),
      ('Oluyole Estate', '{"Oluyole"}'),
      ('Omi-Adio', '{"Omi Adio"}'),
      ('Orogun', '{}'),
      ('Ring Road', '{}'),
      ('Samonda', '{}'),
      ('Sango', '{"Poly","Polytechnic Ibadan"}'),
      ('Secretariat', '{}'),
      ('Shasha', '{}'),
      ('University of Ibadan', '{"UI","U.I."}')
    ) as v(name, aliases)
  on conflict do nothing;

  insert into public.delivery_areas (city, state, name, aliases, zone_id)
  select 'Lagos', 'Lagos', v.name, v.aliases,
         case v.zone
           when 'island' then z_lg_island
           when 'outskirts' then z_lg_outskirts
           else z_lg_mainland
         end
    from (values
      ('Abule Egba', '{}'::text[], 'mainland'),
      ('Agege', '{}', 'mainland'),
      ('Ajao Estate', '{}', 'mainland'),
      ('Akoka', '{}', 'mainland'),
      ('Alausa', '{}', 'mainland'),
      ('Allen', '{"Allen Avenue"}', 'mainland'),
      ('Anthony', '{}', 'mainland'),
      ('Apapa', '{}', 'mainland'),
      ('Bariga', '{}', 'mainland'),
      ('Berger', '{"Ojodu Berger"}', 'mainland'),
      ('Ebute Metta', '{"Ebute-Metta"}', 'mainland'),
      ('Egbe', '{}', 'mainland'),
      ('Egbeda', '{}', 'mainland'),
      ('Ejigbo', '{}', 'mainland'),
      ('Festac Town', '{"Festac"}', 'mainland'),
      ('Gbagada', '{}', 'mainland'),
      ('Idimu', '{}', 'mainland'),
      ('Ikeja', '{}', 'mainland'),
      ('Ikeja GRA', '{}', 'mainland'),
      ('Ikotun', '{}', 'mainland'),
      ('Ilupeju', '{}', 'mainland'),
      ('Ipaja', '{}', 'mainland'),
      ('Isheri', '{}', 'mainland'),
      ('Isolo', '{}', 'mainland'),
      ('Iyana Ipaja', '{}', 'mainland'),
      ('Ketu', '{}', 'mainland'),
      ('Magodo', '{}', 'mainland'),
      ('Maryland', '{}', 'mainland'),
      ('Mile 2', '{}', 'mainland'),
      ('Mushin', '{}', 'mainland'),
      ('Ogba', '{}', 'mainland'),
      ('Ogudu', '{}', 'mainland'),
      ('Ojo', '{}', 'mainland'),
      ('Ojodu', '{}', 'mainland'),
      ('Ojota', '{}', 'mainland'),
      ('Okota', '{}', 'mainland'),
      ('Opebi', '{}', 'mainland'),
      ('Oregun', '{}', 'mainland'),
      ('Oshodi', '{}', 'mainland'),
      ('Palmgrove', '{}', 'mainland'),
      ('Satellite Town', '{}', 'mainland'),
      ('Somolu', '{"Shomolu"}', 'mainland'),
      ('Surulere', '{}', 'mainland'),
      ('Yaba', '{}', 'mainland'),
      ('Abraham Adesanya', '{}', 'island'),
      ('Ajah', '{}', 'island'),
      ('Badore', '{}', 'island'),
      ('Ikota', '{}', 'island'),
      ('Ikoyi', '{}', 'island'),
      ('Lagos Island', '{"Lagos Island (Isale Eko)","CMS","Marina"}', 'island'),
      ('Lekki', '{"Lekki Phase 2","Chevron"}', 'island'),
      ('Lekki Phase 1', '{}', 'island'),
      ('Sangotedo', '{}', 'island'),
      ('VGC', '{"Victoria Garden City"}', 'island'),
      ('Victoria Island', '{"VI","V.I."}', 'island'),
      ('Badagry', '{}', 'outskirts'),
      ('Epe', '{}', 'outskirts'),
      ('Ibeju-Lekki', '{"Ibeju Lekki"}', 'outskirts'),
      ('Ikorodu', '{}', 'outskirts')
    ) as v(name, aliases, zone)
  on conflict do nothing;

  -- One pickup point, switched off until the address is filled in.
  if not exists (select 1 from public.pickup_points) then
    insert into public.pickup_points (name, city, state, fee, is_active)
    values ('VetNeeds Ibadan store', 'Ibadan', 'Oyo', 0, false);
  end if;
end
$$;

comment on table public.delivery_areas is
  'Named places customers pick at checkout. Each belongs to an area zone of the same city (trigger), which prices it per weight band.';
comment on table public.pickup_points is
  'Where orders can be collected. Inactive until it has an address.';
