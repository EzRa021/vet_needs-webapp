-- ============================================================
-- 029_area_prices_and_stores.sql
-- Delivery redone around Ibadan areas and stores.
--
-- 028 priced delivery by zone × order weight, with Lagos and state prices
-- alongside. The shop asked for something simpler and closer to how it works:
--
--   * Ibadan only. Customers choose their area; every area is in Ibadan.
--   * Each area has ONE door-delivery price, set by staff. No zones, no
--     weight bands. NULL = no door delivery to that area (pickup only).
--   * Each area is assigned to the store its customers collect from — the
--     nearest one (Orogun, UI and Ajibode → the Bodija store).
--   * Door delivery and store pickup can each be switched on or off for the
--     whole shop, and checkout follows.
--
-- What this does:
--   delivery_areas  + delivery_fee, + pickup_point_id
--   settings        + doorstep_delivery_enabled, + store_pickup_enabled
--                   − area_pricing_enabled (always "on" now)
--   Lagos areas     deleted (028 seed names only; Ibadan-only shop)
--
-- Prices already set under 028 are carried over as each area's starting
-- price: its zone's flat fee, or failing that the zone's lightest weight
-- price. Nothing is invented — an area whose zone had no price stays unpriced.
--
-- 028's zones, weight bands and zone rates are no longer read by the app.
-- They're left in place rather than dropped, so nothing typed into them is
-- lost; a later migration can remove them.
--
-- Idempotent; safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- Areas: a price and a store each
-- ------------------------------------------------------------
alter table public.delivery_areas
  add column if not exists delivery_fee numeric(12, 2),
  add column if not exists pickup_point_id uuid references public.pickup_points (id) on delete set null;

alter table public.delivery_areas drop constraint if exists delivery_areas_fee_check;
alter table public.delivery_areas add constraint delivery_areas_fee_check
  check (delivery_fee is null or delivery_fee >= 0);

create index if not exists delivery_areas_pickup_point_idx on public.delivery_areas (pickup_point_id);

-- Starting prices from 028, only where the area has none yet (a re-run never
-- overwrites a price staff have since changed).
update public.delivery_areas a
   set delivery_fee = coalesce(
         z.fee,
         (select r.fee
            from public.shipping_zone_rates r
            join public.delivery_weight_bands b on b.id = r.band_id
           where r.zone_id = z.id
           order by b.up_to_kg asc nulls last
           limit 1)
       )
  from public.shipping_zones z
 where a.zone_id = z.id
   and a.delivery_fee is null;

-- Ibadan only.
delete from public.delivery_areas where lower(trim(city)) <> 'ibadan';

-- ------------------------------------------------------------
-- Settings: which ways of getting an order are offered
-- ------------------------------------------------------------
insert into public.settings (key, value, description, is_public)
values
  ('doorstep_delivery_enabled', 'true',
   'Offer delivery to the customer''s door at checkout (029).', true),
  ('store_pickup_enabled', 'true',
   'Offer collection from a store at checkout (029).', true)
on conflict (key) do nothing;

delete from public.settings where key = 'area_pricing_enabled';
