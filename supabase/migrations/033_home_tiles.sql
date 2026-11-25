-- ============================================================
-- 033_home_tiles.sql
-- A "home tile" promotion placement: the three small tiles under the home
-- page slider (picture + short line + "Shop now").
--
-- The home page also turns every live home_hero promotion into a slide (it
-- used to show only the first), which needs no schema change.
--
-- Until this runs, saving a promotion as a home tile fails the placement
-- check; the home page simply shows category tiles instead. Safe to re-run.
-- ============================================================

alter table public.promotions drop constraint if exists promotions_placement_check;
alter table public.promotions
  add constraint promotions_placement_check
  check (placement in ('home_hero', 'home_tile', 'home_banner', 'shop_banner', 'popup'));
