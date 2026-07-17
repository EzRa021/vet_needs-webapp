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
-- Idempotent; safe to re-run.
-- ============================================================

revoke select (cost_price)      on public.items from anon, authenticated;
revoke select (pos_external_id) on public.items from anon, authenticated;
revoke select (pos_source)      on public.items from anon, authenticated;

-- The service role bypasses column grants (it bypasses RLS entirely), so the
-- admin — gated by getStaffUser() and reading through createAdminClient() —
-- keeps full access. This is the same shape as orders (010): a staff-gated
-- route doing a service-role read.

comment on column public.items.cost_price is
  'What the shop pays per unit. NOT readable by anon/authenticated (023) — it is the margin. Reached only via the service role, behind a staff gate.';
