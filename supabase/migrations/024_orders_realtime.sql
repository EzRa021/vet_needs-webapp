-- ============================================================
-- 024_orders_realtime.sql
--
-- Live order tracking: the admin Orders page and the customer's
-- "My orders" pages subscribe to changes on public.orders over
-- Supabase Realtime (postgres_changes).
--
-- Realtime only streams tables that are in the `supabase_realtime`
-- publication. Until this runs, the pages still work — they just
-- fall back to refreshing on their own and the "Live" indicator
-- never turns green.
--
-- WHO RECEIVES WHAT: postgres_changes runs every change through the
-- subscriber's RLS policies before sending it, so nothing new is
-- exposed here:
--   · staff  → "staff read all orders" (003)  → every order
--   · buyer  → "users read own orders" (001)  → their own orders only
--   · guests → no SELECT policy at all (011)  → nothing; the guest
--              tracking page polls get_guest_order() instead
--
-- Idempotent; safe to re-run.
-- ============================================================

do $$
begin
  -- Supabase creates this publication for every project. The guard is for
  -- local/self-hosted databases where it may not exist yet.
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end
$$;
