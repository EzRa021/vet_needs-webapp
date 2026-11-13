-- ============================================================
-- 023_hide_cost_columns.sql
--
-- 🐛 INFO LEAK: the shop's buying cost is public.
--
-- `items` is "readable by all" (001) — a row policy, which RLS applies
-- to WHOLE ROWS, every column included. Supabase also grants anon +
-- authenticated SELECT on every column by default. So `cost_price` —
-- what the shop PAYS per product, i.e. its margin on every line — is
-- readable by anyone:
--
--   GET /rest/v1/items?select=name,price,cost_price
--
-- with nothing but the public anon key. The API leaks it too (both
-- /api/shop/items routes select('*')), but the API isn't the hole —
-- PostgREST is. A competitor reads your margins in one request.
--
-- It's null today, which is the only reason it hasn't mattered. The
-- inventory/valuation feature exists to make staff FILL IT IN — so this
-- has to be shut before that ships, not after.
--
-- pos_external_id / pos_source go too: internal integration keys with
-- no reason to ever reach a browser.
--
-- FIX: column-level REVOKE. PostgREST honours it — a revoked column
-- vanishes from `select=*` and errors on an explicit `select=cost_price`.
-- Applies to authenticated as well, because a competitor can register a
-- free account; a logged-in customer is still "the public" for this.
--
-- ⚠️ CONSEQUENCE: after this, anon/authenticated `select('*')` on items
-- FAILS (permission denied for the revoked column). Ships with:
--   · the public /api/shop/items routes switched to explicit columns
--   · the admin item reads/writes switched to the service role
-- Run them together or the catalogue + admin break.
--
-- ⚠️ CORRECTED (Nov 2026). The first version of this file did only
--
--   revoke select (cost_price) on public.items from anon, authenticated;
--
-- which Postgres treats as a no-op: a role that holds SELECT on the WHOLE
-- table can read every column, whatever its column-level privileges say, and
-- Supabase grants table-wide SELECT to anon/authenticated by default. So
-- cost_price stayed readable. It also named pos_external_id / pos_source on
-- items, which no migration creates (002 put them on categories), so on a
-- fresh database it errored and stopped the migration run.
--
-- FIX: take table-wide SELECT away, then grant it back column by column for
-- every column EXCEPT the hidden ones. That is what PostgREST then honours.
--
-- ⚠️ FOLLOW-ON: a column added to items later is NOT readable by the shop
-- until it's granted (`grant select (new_col) on public.items to anon,
-- authenticated;`). That's the safe default for a table holding margins.
--
-- Idempotent; safe to re-run. Re-run it after adding columns to items.
-- ============================================================

do $$
declare
  hidden constant text[] := array['cost_price', 'pos_external_id', 'pos_source'];
  visible text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into visible
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'items'
     and column_name <> all (hidden);

  revoke select on public.items from anon, authenticated;
  execute format('grant select (%s) on public.items to anon, authenticated', visible);
end
$$;

-- The service role bypasses column grants (it bypasses RLS entirely), so the
-- admin — gated by getStaffUser() and reading through createAdminClient() —
-- keeps full access. This is the same shape as orders (010): a staff-gated
-- route doing a service-role read.

comment on column public.items.cost_price is
  'What the shop pays per unit. NOT readable by anon/authenticated (023) — it is the margin. Reached only via the service role, behind a staff gate.';
