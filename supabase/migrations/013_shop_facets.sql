-- ============================================================
-- 013_shop_facets.sql
-- Facet counts for the shop filters (brand, price, attributes).
--
-- WHY AN RPC AND NOT A FEW SELECTS: the facets have to be computed
-- over the SAME result set the shopper is looking at, or the numbers
-- lie. Doing that from the API means several round-trips that each
-- re-derive the scope, and they can disagree with the grid. One
-- function, one scope, one answer.
--
-- TWO RULES THAT CAME OUT OF THE REAL DATA (18 products, 12 attribute
-- keys):
--
--  1. FACETS ARE SCOPED. `attributes` is heterogeneous — bag_size on
--     feed, life_stage on pet food, material on accessories. A global
--     facet list would offer "bag_size" while browsing Pet Accessories,
--     which matches nothing. So facets are computed from the current
--     department/category/search, not the whole catalogue.
--
--  2. A ONE-OPTION FACET IS NOT A FILTER. The live data has
--     `length: 1.5m` and `storage: Frozen` — single-valued. Showing them
--     is a control that cannot change the result. Only keys with 2+
--     distinct values in scope are returned.
--
-- Idempotent; safe to re-run.
-- ============================================================

create or replace function public.shop_facets(
  p_node uuid default null,
  p_search text default null
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_ids uuid[];
  v_result jsonb;
begin
  -- Same subtree resolution the items API uses, so the counts match the grid.
  -- (A department is just a root category — see /api/shop/items.)
  if p_node is not null then
    v_ids := public.category_descendant_ids(p_node);
  end if;

  with scope as (
    select i.brand, i.price, i.stock, i.allow_backorder, i.attributes
      from public.items i
     where i.is_active
       and (v_ids is null or i.category_id = any (v_ids))
       and (
         p_search is null or trim(p_search) = ''
         -- websearch_to_tsquery never raises on odd input, so a stray quote in
         -- the search box can't turn the filter panel into a 500.
         or i.fts @@ websearch_to_tsquery('english'::regconfig, p_search)
       )
  ),
  brand_counts as (
    select s.brand as value, count(*)::int as count
      from scope s
     where s.brand is not null and s.brand <> ''
     group by s.brand
  ),
  attr_pairs as (
    select kv.key, kv.value, count(*)::int as count
      from scope s,
           lateral jsonb_each_text(coalesce(s.attributes, '{}'::jsonb)) kv
     where kv.value is not null and kv.value <> ''
     group by kv.key, kv.value
  ),
  attr_grouped as (
    select p.key,
           count(*)::int as distinct_values,
           jsonb_agg(
             jsonb_build_object('value', p.value, 'count', p.count)
             order by p.count desc, p.value asc
           ) as values
      from attr_pairs p
     group by p.key
  )
  select jsonb_build_object(
    'total', (select count(*) from scope),

    -- Bounds for the price slider. floor/ceil so the handles sit on round
    -- numbers either side of the real range rather than on ₦2,847.
    'price', (
      select case
        when count(*) = 0 then jsonb_build_object('min', 0, 'max', 0)
        else jsonb_build_object('min', floor(min(price)), 'max', ceil(max(price)))
      end
      from scope
    ),

    'in_stock', (
      select count(*) from scope
       where allow_backorder or stock is null or stock > 0
    ),

    -- Only worth a control if there's a choice to make.
    'brands', coalesce((
      select jsonb_agg(jsonb_build_object('value', value, 'count', count)
                       order by count desc, value asc)
        from brand_counts
       where (select count(*) from brand_counts) >= 2
    ), '[]'::jsonb),

    'attributes', coalesce((
      select jsonb_agg(jsonb_build_object('key', key, 'values', values) order by key)
        from attr_grouped
       where distinct_values >= 2
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.shop_facets(uuid, text) to anon, authenticated;

comment on function public.shop_facets is
  'Facet counts (brand, price bounds, attribute values) computed over the same scope as the product grid. Only returns facets with 2+ options — a one-option facet is a control that cannot change the result. See 013 header.';
