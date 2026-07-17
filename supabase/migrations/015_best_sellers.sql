-- ============================================================
-- 015_best_sellers.sql
-- "Best sellers" computed from what people actually bought.
--
-- WHY MATERIALIZED: the source is jsonb — order_items has to be
-- unnested across every paid order to count units. There is no index
-- that makes that cheap, and it would run on every home page load. A
-- materialized view pays that cost once per refresh instead.
--
-- WHAT THAT COSTS: it goes stale. That's the right trade here —
-- "best sellers" is a merchandising signal, not a balance. Nobody is
-- harmed if it's a few hours behind, and the refresh is scheduled
-- rather than on the payment path (see refresh_best_sellers()).
--
-- ⚠️ MVs do NOT support RLS. So the view is NOT granted to anon —
-- units_sold per product is commercial information a competitor would
-- enjoy. The storefront reads it through get_best_sellers(), which
-- returns products in rank order and no numbers.
--
-- Idempotent; safe to re-run.
-- ============================================================

drop materialized view if exists public.best_sellers cascade;

create materialized view public.best_sellers as
select
  (line->>'id')::uuid                        as item_id,
  sum((line->>'quantity')::numeric)          as units_sold,
  count(distinct o.id)                       as order_count,
  max(o.paid_at)                             as last_sold_at
from public.orders o
cross join lateral jsonb_array_elements(o.order_items) as line
where
  -- Money actually changed hands and stayed changed. 'pending' is a hope;
  -- 'canceled'/'refunded' are the opposite of a sale, and counting them would
  -- promote products people sent back.
  o.status in ('paid', 'processing', 'shipped', 'delivered')
  and o.paid_at is not null
  and line ? 'id'
  and line ? 'quantity'
group by (line->>'id')::uuid;

-- Required for REFRESH ... CONCURRENTLY, which is what keeps the storefront
-- readable during a refresh instead of blocking on an exclusive lock.
create unique index if not exists best_sellers_item_id_idx
  on public.best_sellers (item_id);

create index if not exists best_sellers_units_idx
  on public.best_sellers (units_sold desc);

-- Deliberately no `grant select ... to anon` — see the header.
grant select on public.best_sellers to service_role;

-- ------------------------------------------------------------
-- The storefront's door in: ranked products, no sales figures.
--
-- Joins back to items so a delisted or deleted product can't linger on the
-- home page just because it sold well last month.
-- ------------------------------------------------------------
create or replace function public.get_best_sellers(p_limit int default 8)
returns table (
  id uuid,
  name text,
  slug text,
  image_url text,
  price numeric,
  compare_at_price numeric,
  unit_type text,
  stock numeric,
  allow_backorder boolean,
  low_stock_threshold numeric,
  rating_avg numeric,
  rating_count integer,
  vat_enabled boolean,
  vat_rate numeric,
  vat_inclusive boolean,
  category_name text
)
language sql stable security definer set search_path = public as $$
  select i.id, i.name, i.slug, i.image_url, i.price, i.compare_at_price,
         i.unit_type, i.stock, i.allow_backorder, i.low_stock_threshold,
         i.rating_avg, i.rating_count,
         i.vat_enabled, i.vat_rate, i.vat_inclusive,
         c.name as category_name
    from public.best_sellers b
    join public.items i on i.id = b.item_id
    left join public.categories c on c.id = i.category_id
   where i.is_active
   order by b.units_sold desc, b.order_count desc, i.name asc
   limit greatest(1, least(p_limit, 24));
$$;

grant execute on function public.get_best_sellers(int) to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- Refresh. NOT called from mark_order_paid(): that runs inside the payment
-- transaction, and rebuilding an aggregate over every order to confirm one
-- payment would put avoidable latency (and a failure mode) on the one path
-- that must never wobble.
--
-- Call it on a schedule — pg_cron, or POST /api/admin/best-sellers/refresh
-- from an external cron. Stale best sellers are fine; a slow checkout is not.
-- ------------------------------------------------------------
create or replace function public.refresh_best_sellers()
returns void
language plpgsql security definer set search_path = public as $$
begin
  -- CONCURRENTLY keeps the rail readable while it rebuilds. It requires the
  -- unique index above, and cannot run inside a transaction block that already
  -- holds the view — callers should invoke it standalone.
  refresh materialized view concurrently public.best_sellers;
exception
  when others then
    -- A concurrent refresh can fail if one is already running. That's not
    -- worth failing a cron over — the next tick picks it up.
    raise warning 'refresh_best_sellers skipped: %', sqlerrm;
end;
$$;

revoke all on function public.refresh_best_sellers() from public;
grant execute on function public.refresh_best_sellers() to service_role;

comment on materialized view public.best_sellers is
  'Units sold per product from paid+ orders. Refreshed on a schedule, never on the payment path. NOT exposed to anon — read it through get_best_sellers(), which returns rank without the numbers.';
