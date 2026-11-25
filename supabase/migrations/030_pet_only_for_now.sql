-- ============================================================
-- 030_pet_only_for_now.sql
-- The shop sells for pets only, for now.
--
-- Poultry and fish feed are paused: the Feed department, every category
-- under it, and the products in them come off the storefront. Nothing is
-- deleted — prices, stock, photos and order history all stay — and the
-- products this switches off are written down, so bringing feed back later
-- restores exactly those and not ones staff had switched off on purpose.
--
-- "Under Feed" means the category tree from 002: path 'feed' and
-- 'feed/…' (Poultry Feeds, Fish Feed, anything added since). A product
-- counts as feed when its main category is in that tree; a pet product that
-- also appears under Feed (item_categories) stays on sale.
--
-- To bring feed back (run in the Supabase SQL editor):
--   update public.categories set is_active = true
--    where path = 'feed' or path like 'feed/%';
--   update public.items set is_active = true
--    where id in (select item_id from public.paused_feed_items);
--   delete from public.paused_feed_items;
--
-- Idempotent; safe to re-run.
-- ============================================================

create table if not exists public.paused_feed_items (
  item_id uuid primary key references public.items (id) on delete cascade,
  paused_at timestamptz not null default now()
);

alter table public.paused_feed_items enable row level security;
drop policy if exists "staff manage paused_feed_items" on public.paused_feed_items;
create policy "staff manage paused_feed_items" on public.paused_feed_items
  for all using (public.is_staff()) with check (public.is_staff());
grant select, insert, delete on public.paused_feed_items to authenticated;
grant all on public.paused_feed_items to service_role;

-- Write down what's about to be switched off: only products that are on now.
insert into public.paused_feed_items (item_id)
select i.id
  from public.items i
  join public.categories c on c.id = i.category_id
 where i.is_active
   and (c.path = 'feed' or c.path like 'feed/%')
on conflict (item_id) do nothing;

update public.items
   set is_active = false
 where is_active
   and id in (select item_id from public.paused_feed_items);

update public.categories
   set is_active = false
 where is_active
   and (path = 'feed' or path like 'feed/%');

-- The home-page hero banner 000 seeded ("Quality Feed & Pet Care — Poultry
-- feed, pet food & accessories — delivered nationwide"). A live home_hero
-- promotion replaces the hero's own copy, so while it stays on the shop's
-- front page keeps selling poultry feed. Switched off only if it still has
-- the seeded words: a banner staff have written themselves is theirs.
update public.promotions
   set is_active = false
 where placement = 'home_hero'
   and is_active
   and title = 'Quality Feed & Pet Care'
   and subtitle = 'Poultry feed, pet food & accessories — delivered nationwide';
