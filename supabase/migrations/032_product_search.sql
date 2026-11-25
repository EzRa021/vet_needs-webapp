-- ============================================================
-- 032_product_search.sql
-- One product search for the whole shop: as-you-type, typo-tolerant,
-- index-backed.
--
-- Before this, the shop page searched with websearch_to_tsquery on the fts
-- column (012), which matches WHOLE words only: typing "sta" found nothing
-- until "stainless" was complete, and "stianless" never found it. The header
-- suggestions (search_items, 012) did prefix-match, so the two disagreed.
--
-- search_products(q) is now the single matcher. A product matches when ANY of:
--   1. every typed word starts a word in its name, brand, SKU, tags or
--      description ("sta" → Stainless Steel Pet Bowl, "dog bow" → …), or is a
--      near-spelling of a word in its name — fts prefixes on the existing GIN
--      index (012)
--   2. the typed text appears anywhere in the name ("less", "500ml", SKU
--      fragments) — ILIKE on a new trigram index (4+ characters; at 3,
--      "sta" also caught "AdjuSTAble")
--   3. it's a close spelling of a word in the name ("stianless", "kibbel",
--      "chiken neck") — pg_trgm word similarity ≥ 0.5 on the same trigram
--      index (4+ characters). 0.5 was measured on the real catalogue:
--      genuine typos score 0.57–0.89, unrelated names 0.33–0.40.
-- All three are index scans, so this stays fast as the catalogue grows.
--
-- Results come back best first: name starts with the text, then a word in
-- the name starts with it, then other word matches (by ts_rank), then
-- substring, then near-spellings (by similarity), then A–Z. The shop's
-- "Best match" sort is this order; the other sorts re-order the same rows.
--
-- Rows are returned as storefront_items — every product column a shopper may
-- read (all but cost_price, 023) — so the function runs with the caller's
-- rights and can never hand cost prices to the storefront. PostgREST filters,
-- sorts, pages and embeds categories on it exactly as on the items table.
--
-- shop_facets (013) and search_items (012, header suggestions) now use the
-- same matcher, so the filter counts, the suggestions and the grid agree.
--
-- Idempotent; safe to re-run.
-- ============================================================

create extension if not exists pg_trgm with schema extensions;

-- Load pg_trgm's library into this session before search_products is
-- created below with `set pg_trgm.word_similarity_threshold`. Until the
-- library is loaded that setting is only a placeholder, which a non-superuser
-- (the SQL editor's postgres role) may not set — "permission denied to set
-- parameter" on a re-run, once the index below already exists and so no
-- longer loads it. Calling any pg_trgm function loads it.
select extensions.similarity('a', 'a');

create index if not exists items_name_trgm_idx
  on public.items using gin (name extensions.gin_trgm_ops);

-- ------------------------------------------------------------
-- What a shopper may see of a product. Explicit columns, so a column added
-- to items later stays private until it's added here on purpose.
-- security_invoker: the caller's own rights and row rules apply.
-- ------------------------------------------------------------
create or replace view public.storefront_items
with (security_invoker = true) as
select id, name, slug, sku, brand, description, long_description, price,
       compare_at_price, vat_enabled, vat_rate, vat_inclusive, unit_type, stock,
       low_stock_threshold, allow_backorder, is_active, is_available,
       is_featured, image_url, rating_avg, rating_count, weight_grams,
       attributes, tags, meta_title, meta_description, category_id,
       created_at, updated_at
  from public.items;

grant select on public.storefront_items to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- The matcher.
--
-- Two passes, so it stays index-driven on a big catalogue:
--   candidates  separate index lookups, merged: every word starts a word in
--               the product (fts, GIN); the text is in the name; the text, or
--               any one word of it, is a near-spelling of the name (trigram,
--               GIN). Kept apart on purpose — OR'd into one WHERE, Postgres
--               gave up on the indexes and read every product (0.4 s at 60k
--               products; apart, a few ms). 1–2 letter searches ("s", "do")
--               match names with a word starting with them (a scan, but only
--               for those — "s" and "do" are stop words to the fts index).
--   refine      keep a candidate when the whole text is in its name, or EVERY
--               word either starts a word in it or is a near-spelling of a
--               word in its name ("chiken neck"). Whole-phrase similarity
--               alone was too generous across words: "cat bowl" scored 0.56
--               against "Stainless Steel Pet Bowl" on "bowl" alone.
--   Stop words ("for", "the") never sink a search: they're skipped.
-- ------------------------------------------------------------
create or replace function public.search_products(p_query text)
returns setof public.storefront_items
language plpgsql
stable
set search_path = public, extensions
set pg_trgm.word_similarity_threshold = 0.5
-- Plan each call with its own text, so the branches below that can't apply
-- ("4+ characters", "no prefix query") are dropped before planning instead of
-- leaving a generic plan that has to scan for them.
set plan_cache_mode = force_custom_plan
as $$
declare
  v_clean text;
  v_words text[];
  v_word_q tsquery[] := '{}';
  v_all tsquery;   -- every word a prefix
  v_q tsquery;
  w text;
begin
  -- Letters and digits only, single-spaced, lower case. Everything that
  -- means something to tsquery, LIKE or a regex is gone, so the text below
  -- is safe in all three.
  v_clean := lower(trim(regexp_replace(coalesce(p_query, ''), '[^[:alnum:]]+', ' ', 'g')));
  if v_clean = '' then
    return;
  end if;
  v_words := string_to_array(v_clean, ' ');

  -- One prefix query per word; a stop word gives an empty query → null.
  foreach w in array v_words loop
    begin
      v_q := to_tsquery('english'::regconfig, w || ':*');
    exception when others then
      v_q := null;
    end;
    if v_q is not null and numnode(v_q) = 0 then
      v_q := null;
    end if;
    v_word_q := v_word_q || v_q;
    if v_q is not null then
      v_all := case when v_all is null then v_q else v_all && v_q end;
    end if;
  end loop;

  return query
    with candidates as (
      select i.id from public.items i
       where v_all is not null and i.fts @@ v_all
      union
      select i.id from public.items i
       where length(v_clean) >= 4 and i.name ilike '%' || v_clean || '%'
      union
      select i.id from public.items i
       where length(v_clean) >= 4 and v_clean <% i.name
      union
      select i.id from unnest(v_words) as t(word)
        join public.items i on length(t.word) >= 4 and t.word <% i.name
       where array_length(v_words, 1) > 1
      union
      select i.id from public.items i
       where length(v_clean) <= 2 and lower(i.name) ~ ('\m' || v_clean)
    )
    select s.*
      from candidates c
      join public.items i on i.id = c.id
      join public.storefront_items s on s.id = i.id
     where (length(v_clean) >= 4 and i.name ilike '%' || v_clean || '%')
        or (length(v_clean) <= 2 and lower(i.name) ~ ('\m' || v_clean))
        or not exists (
             select 1
               from unnest(v_words, v_word_q) as t(word, q)
              where not (
                t.q is null                                   -- stop word
                or i.fts @@ t.q                               -- starts a word
                or (length(t.word) >= 4 and t.word <% i.name) -- near-spelling
              )
           )
     order by
       case
         when lower(i.name) like v_clean || '%' then 0
         when lower(i.name) ~ ('\m' || v_clean) then 1
         when v_all is not null and i.fts @@ v_all then 2
         when i.name ilike '%' || v_clean || '%' then 3
         else 4
       end,
       case when v_all is not null then ts_rank(i.fts, v_all) else 0 end desc,
       word_similarity(v_clean, i.name) desc,
       i.name asc;
end;
$$;

grant execute on function public.search_products(text) to anon, authenticated, service_role;

comment on function public.search_products(text) is
  'The shop''s product search (032): word-prefix (fts), substring (trigram ILIKE) and near-spelling (trigram word similarity) matches, best first. Returns storefront_items, so never cost_price. Used by /api/shop/items, shop_facets and search_items.';

-- ------------------------------------------------------------
-- Header suggestions (012) — same matcher, same order, active products only.
-- ------------------------------------------------------------
create or replace function public.search_items(p_query text, p_limit int default 8)
returns table (
  id uuid,
  name text,
  slug text,
  image_url text,
  price numeric,
  unit_type text,
  category_name text,
  rank real
)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
    select s.id, s.name, s.slug, s.image_url, s.price, s.unit_type,
           c.name as category_name,
           (1.0 / s.ordinality)::real as rank
      from public.search_products(p_query) with ordinality as s
      left join public.categories c on c.id = s.category_id
     where s.is_active
     order by s.ordinality
     limit greatest(1, least(p_limit, 20));
exception
  -- A query that still can't be handled is a no-result, not a 500.
  when others then
    return;
end;
$$;

grant execute on function public.search_items(text, int) to anon, authenticated;

-- ------------------------------------------------------------
-- Filter-panel counts (013) — the same products the grid shows.
-- Only the search condition changes; the rest is 013 verbatim.
-- ------------------------------------------------------------
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
         or i.id in (select s.id from public.search_products(p_search) s)
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
