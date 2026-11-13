-- ============================================================
-- 025_inventory_realtime.sql
--
-- Live Products and Inventory pages: the admin subscribes to new
-- rows in public.item_history over Supabase Realtime.
--
-- WHY item_history AND NOT items:
-- items is "readable by all" (001), and 023 hides cost_price from
-- anon/authenticated with a COLUMN-level revoke. Streaming items
-- itself would mean trusting the realtime path to honour that
-- column revoke for every anonymous subscriber, and a mistake there
-- re-opens the margin leak 023 closed. item_history is staff-only
-- ("staff read item history", 003), and log_item_changes() writes
-- a row for every stock move, sale, restock, price and VAT change,
-- so it's both the safer signal and the more useful one: each row
-- already says what happened and by how much. The pages then
-- refetch through the staff-gated API, which is the only thing
-- that reads cost_price.
--
-- Until this runs, the pages still work; they refresh every 30s
-- instead of instantly.
--
-- Idempotent; safe to re-run.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'item_history'
  ) then
    alter publication supabase_realtime add table public.item_history;
  end if;
end
$$;
