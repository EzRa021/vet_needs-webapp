-- ============================================================
-- 012_full_text_search.sql
-- Real search for the shop, replacing the ilike scan.
--
-- What was there: `name.ilike.*term*,description.ilike.*term*`. That
-- means a sequential scan with two leading-wildcard patterns — no index
-- can serve it, it can't rank ("Layer Mash" and a product that merely
-- mentions mash in paragraph four score identically), it can't match
-- across fields ("bovans layer" finds nothing if brand and name are
-- separate columns), and it has no stemming ("feeds" misses "feed").
--
-- What this adds: a stored, generated tsvector over the fields worth
-- searching, weighted so a name match outranks a description mention,
-- plus a GIN index so it stays fast as the catalogue grows.
--
-- Weights: A name · B brand+sku · C tags · D description.
-- 'english' gives stemming (feed/feeds/feeding). Nigerian brand names
-- aren't English words, but they survive unstemmed — the cost is nil
-- and the win on ordinary words is large.
--
-- ⚠️ IMMUTABILITY. A generated column requires every expression in it to
-- be IMMUTABLE, and two things here look immutable but aren't:
--   · array_to_string(anyarray, text) is STABLE  → wrapped below
--   · to_tsvector(text) (1-arg) is STABLE        → ::regconfig cast below
-- Either one produces: ERROR 42P17 generation expression is not immutable.
--
-- Idempotent; safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- Why this wrapper exists (it is not decoration):
--
-- A generated column requires EVERY expression in it to be IMMUTABLE, and
-- `array_to_string(anyarray, text)` is only STABLE. Postgres marks it stable
-- because rendering an arbitrary array calls that element type's output
-- function, and some of those depend on session settings (a timestamp[] renders
-- differently under a different TimeZone). Using it directly fails with:
--
--   ERROR: 42P17: generation expression is not immutable
--
-- For `text[]` that reasoning doesn't apply — text's output function is the
-- identity, and no session setting changes it. So this narrow wrapper, typed to
-- text[] specifically rather than anyarray, is genuinely immutable, and is the
-- standard workaround.
-- ------------------------------------------------------------
create or replace function public.immutable_array_to_string(arr text[], sep text)
returns text language sql immutable parallel safe as $$
  select array_to_string(arr, sep);
$$;

comment on function public.immutable_array_to_string(text[], text) is
  'array_to_string() restricted to text[], which makes it genuinely immutable so it can be used in the items.fts generated column. See 012 header.';

-- A generated column, not a trigger: Postgres keeps it in step with every
-- insert/update itself, so no write path can forget to reindex a product.
--
-- `'english'::regconfig` is cast explicitly: to_tsvector(regconfig, text) is
-- immutable, but to_tsvector(text) — the single-argument form that resolves the
-- config from the default_text_search_config session setting — is only STABLE.
-- Leaving it to overload resolution is the other way to trip 42P17.
alter table public.items
  add column if not exists fts tsvector
  generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(brand, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(sku, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig,
      coalesce(public.immutable_array_to_string(tags, ' '), '')), 'C') ||
    setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'D') ||
    setweight(to_tsvector('english'::regconfig, coalesce(long_description, '')), 'D')
  ) stored;

create index if not exists items_fts_idx on public.items using gin (fts);

-- ------------------------------------------------------------
-- Autocomplete needs prefix matching ("lay" → "Layer Mash"), which a
-- tsvector can do (`lay:*`) but only for the LAST word being typed.
-- Building that query string in the API means hand-escaping user input into
-- tsquery syntax — one stray `&`, `|`, `!` or `'` and it either errors or,
-- worse, becomes injectable. So the query is built here, in SQL, where the
-- input is a parameter and never concatenated into anything.
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
declare
  v_query tsquery;
  v_clean text;
begin
  -- Strip everything that means something to tsquery, then rebuild it safely.
  v_clean := trim(regexp_replace(coalesce(p_query, ''), '[^\w\s]', ' ', 'g'));
  if v_clean = '' then
    return;
  end if;

  -- Every word gets a prefix match, ANDed: "layer ma" → 'layer:* & ma:*'.
  -- to_tsquery is fed a value built from a parameter, not from raw input.
  -- ::regconfig for the same reason as the generated column above — it picks the
  -- immutable two-argument overload rather than the session-dependent one.
  select to_tsquery(
           'english'::regconfig,
           string_agg(word || ':*', ' & ')
         )
    into v_query
    from unnest(string_to_array(v_clean, ' ')) as word
   where word <> '';

  if v_query is null then
    return;
  end if;

  return query
    select i.id, i.name, i.slug, i.image_url, i.price, i.unit_type,
           c.name as category_name,
           ts_rank(i.fts, v_query) as rank
      from public.items i
      left join public.categories c on c.id = i.category_id
     where i.is_active
       and i.fts @@ v_query
     order by rank desc, i.name asc
     limit greatest(1, least(p_limit, 20));
exception
  -- A query that still can't be parsed is a no-result, not a 500. The
  -- storefront must never break because someone typed something odd.
  when others then
    return;
end;
$$;

grant execute on function public.search_items(text, int) to anon, authenticated;

comment on function public.search_items is
  'Prefix-matching product search for autocomplete. Builds the tsquery in SQL from a parameter — never string-concatenate user input into to_tsquery(). See 012 header.';

comment on column public.items.fts is
  'Generated search vector: A=name, B=brand/sku, C=tags, D=descriptions. Maintained by Postgres, so no write path can forget it. Backed by items_fts_idx (GIN).';
