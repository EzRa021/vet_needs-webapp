-- ============================================================
-- seed.sql — LOCAL DEVELOPMENT ONLY.
--
-- `supabase start` / `supabase db reset` run this after the migrations, on
-- the local Docker database only. It never touches production.
--
-- WHY: the production project predates Supabase's newer defaults and gives
-- the API roles (anon, authenticated, service_role) full table privileges,
-- with row-level security deciding what each can actually see. Newer local
-- images grant them almost nothing on tables a migration creates, so locally
-- every API call fails with "permission denied" until they're granted. This
-- recreates production's table grants so the app behaves the same here.
--
-- Functions need nothing: every RPC the app calls has explicit grants in its
-- migration, and 026 pins the service-role-only ones.
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select, update on all sequences in schema public to anon, authenticated, service_role;

-- The blanket grant above re-adds table-wide SELECT on items, which would
-- undo 023. Same block as 023: every column except the hidden ones.
do $$
declare
  hidden constant text[] := array['cost_price', 'pos_external_id', 'pos_source'];
  visible text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into visible
    from information_schema.columns
   where table_schema = 'public' and table_name = 'items' and column_name <> all (hidden);
  revoke select on public.items from anon, authenticated;
  execute format('grant select (%s) on public.items to anon, authenticated', visible);
end
$$;

-- Sample cost prices (70% of the selling price) so Inventory and the
-- Products margin column have something to show locally.
update public.items set cost_price = round(price * 0.7, 2) where cost_price is null;
