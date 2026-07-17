-- ============================================================
-- 017_reports.sql
-- Sales + VAT reporting.
--
-- 🐛 THE ONE THAT MATTERS: VAT COLLECTED CANNOT BE READ FROM
--    orders.tax_amount.
--
-- lib/pricing.js splits VAT in two:
--   · vat_inclusive = false → VAT is ADDED  → lands in orders.tax_amount
--   · vat_inclusive = true  → VAT is INSIDE the price → computed as
--     `includedTax` for display and then THROWN AWAY. Nothing stores it.
--
-- items.vat_inclusive defaults to TRUE, so for a typical order
-- tax_amount is 0.00 and every naira of VAT is buried inside the line
-- prices. A report that summed tax_amount would tell the owner they
-- collected ~₦0 VAT — and that is the number that would get filed.
--
-- So included VAT is RECOMPUTED here from the order_items snapshot,
-- which carries vat_enabled / vat_rate / vat_inclusive per line (the
-- GNX POS model). The same arithmetic as lib/pricing.js:
--   included = line_total × rate / (1 + rate)
--
-- ⚠️ SECURITY: these are SECURITY DEFINER, which bypasses RLS — and they
-- return revenue. Every one checks is_staff() ITSELF. A definer function
-- granted to `authenticated` without that check is a public revenue feed.
--
-- Idempotent; safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- Unit mismatch, fixed while we're in VAT.
--
-- items.vat_rate is a PERCENT (numeric(5,2) default 7.5).
-- settings.vat_rate was seeded '0.075' — a DECIMAL — and described as
-- "only a default for new products". Nothing ever read it, so the
-- disagreement was invisible: the admin's "Default VAT rate" field did
-- nothing at all. The moment anyone wired it up naively, 0.075 would have
-- been read as 0.075% VAT.
--
-- Normalise to percent, matching items. Only rewrites the value if it
-- still looks like a decimal, so re-running can't turn 7.5 into 750.
-- ------------------------------------------------------------
update public.settings
   set value = to_jsonb('7.5'::text)
 where key = 'vat_rate'
   and (value #>> '{}')::numeric <= 1;

-- ------------------------------------------------------------
-- Shared scope: orders whose money is real and stayed real.
-- 'refunded' is excluded — refunded VAT is not VAT you owe.
-- ------------------------------------------------------------
create or replace function public.report_sales_summary(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  if not public.is_staff() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  with scope as (
    select o.*
      from public.orders o
     where o.paid_at is not null
       and o.status in ('paid', 'processing', 'shipped', 'delivered')
       and o.paid_at >= p_from
       and o.paid_at < p_to
  ),
  lines as (
    select
      s.id as order_id,
      (line->>'price')::numeric * (line->>'quantity')::numeric as line_total,
      coalesce((line->>'vat_enabled')::boolean, true)   as vat_enabled,
      coalesce((line->>'vat_inclusive')::boolean, true) as vat_inclusive,
      -- 7.5 fallback mirrors DEFAULT_VAT_RATE in lib/pricing.js, for old
      -- order_items written before the field existed.
      coalesce((line->>'vat_rate')::numeric, 7.5) / 100 as rate,
      (line->>'quantity')::numeric as qty
    from scope s
    cross join lateral jsonb_array_elements(s.order_items) as line
  )
  select jsonb_build_object(
    'orders',     (select count(*) from scope),
    'revenue',    (select coalesce(sum(total_amount), 0) from scope),
    'goods',      (select coalesce(sum(subtotal), 0) from scope),
    'shipping',   (select coalesce(sum(shipping_fee), 0) from scope),
    'discounts',  (select coalesce(sum(discount_amount), 0) from scope),
    'units',      (select coalesce(sum(qty), 0) from lines),

    -- VAT, split the way it's actually charged.
    'vat_added',    (select coalesce(sum(tax_amount), 0) from scope),
    'vat_included', (
      select coalesce(round(sum(line_total * (rate / (1 + rate))), 2), 0)
        from lines
       where vat_enabled and vat_inclusive and rate > 0
    ),
    'vat_total', (
      (select coalesce(sum(tax_amount), 0) from scope) +
      (select coalesce(round(sum(line_total * (rate / (1 + rate))), 2), 0)
         from lines where vat_enabled and vat_inclusive and rate > 0)
    ),

    'avg_order_value', (
      select case when count(*) = 0 then 0
             else round(sum(total_amount) / count(*), 2) end
      from scope
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.report_sales_summary(timestamptz, timestamptz) to authenticated;

-- ------------------------------------------------------------
-- Daily series for the dashboard chart. Gap-filled: a day with no sales
-- must plot as zero, not be missing — a chart that silently skips empty
-- days makes a bad week look like a continuous line.
-- ------------------------------------------------------------
create or replace function public.report_sales_by_day(
  p_from timestamptz,
  p_to timestamptz
)
returns table (day date, revenue numeric, orders bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  return query
  with days as (
    select generate_series(p_from::date, (p_to - interval '1 day')::date, '1 day')::date as day
  ),
  sales as (
    select o.paid_at::date as day,
           sum(o.total_amount) as revenue,
           count(*) as orders
      from public.orders o
     where o.paid_at is not null
       and o.status in ('paid', 'processing', 'shipped', 'delivered')
       and o.paid_at >= p_from
       and o.paid_at < p_to
     group by o.paid_at::date
  )
  select d.day,
         coalesce(s.revenue, 0)::numeric,
         coalesce(s.orders, 0)::bigint
    from days d
    left join sales s on s.day = d.day
   order by d.day;
end;
$$;

grant execute on function public.report_sales_by_day(timestamptz, timestamptz) to authenticated;

-- ------------------------------------------------------------
-- Top products by revenue in the window. Distinct from best_sellers (015),
-- which is all-time units for merchandising — this is money, in a period,
-- for the owner.
-- ------------------------------------------------------------
create or replace function public.report_top_products(
  p_from timestamptz,
  p_to timestamptz,
  p_limit int default 10
)
returns table (item_id uuid, name text, units numeric, revenue numeric, orders bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  return query
  select
    (line->>'id')::uuid,
    -- The NAME AS SOLD, from the snapshot — not items.name. A product renamed
    -- last week must not retro-relabel last month's sales.
    (array_agg(line->>'name'))[1],
    sum((line->>'quantity')::numeric),
    round(sum((line->>'price')::numeric * (line->>'quantity')::numeric), 2),
    count(distinct o.id)
  from public.orders o
  cross join lateral jsonb_array_elements(o.order_items) as line
  where o.paid_at is not null
    and o.status in ('paid', 'processing', 'shipped', 'delivered')
    and o.paid_at >= p_from
    and o.paid_at < p_to
  group by (line->>'id')::uuid
  order by 4 desc
  limit greatest(1, least(p_limit, 50));
end;
$$;

grant execute on function public.report_top_products(timestamptz, timestamptz, int) to authenticated;

-- ------------------------------------------------------------
-- Top categories. Joins through items, so a product with no category (or
-- since deleted) lands in "Uncategorised" rather than vanishing — the
-- numbers have to add up to the summary.
-- ------------------------------------------------------------
create or replace function public.report_top_categories(
  p_from timestamptz,
  p_to timestamptz,
  p_limit int default 10
)
returns table (category_id uuid, name text, units numeric, revenue numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    coalesce(c.name, 'Uncategorised'),
    sum((line->>'quantity')::numeric),
    round(sum((line->>'price')::numeric * (line->>'quantity')::numeric), 2)
  from public.orders o
  cross join lateral jsonb_array_elements(o.order_items) as line
  left join public.items i on i.id::text = line->>'id'
  left join public.categories c on c.id = i.category_id
  where o.paid_at is not null
    and o.status in ('paid', 'processing', 'shipped', 'delivered')
    and o.paid_at >= p_from
    and o.paid_at < p_to
  group by c.id, c.name
  order by 4 desc
  limit greatest(1, least(p_limit, 50));
end;
$$;

grant execute on function public.report_top_categories(timestamptz, timestamptz, int) to authenticated;

comment on function public.report_sales_summary is
  'Sales + VAT for a period. VAT is recomputed from order_items because orders.tax_amount only holds ADDED vat — inclusive-priced items (the default) store nothing, so summing tax_amount would under-report tax owed. See 017 header.';
