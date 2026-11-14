-- ============================================================
-- 027_hide_staff_notes.sql
--
-- 🐛 INFO LEAK: customers can read the staff's internal notes on their
-- own orders and refund requests.
--
-- orders.admin_notes is documented as "internal, never shown to the
-- customer" (000), and refund_requests.admin_notes (016) holds the
-- staff's review notes. But "users read own orders" (001) and "users
-- read own refund requests" (016) are ROW policies: they hand the buyer
-- every column of their own row. So with their own session a customer
-- could fetch
--
--   GET /rest/v1/orders?select=id,admin_notes
--
-- and, since live order tracking (024), the realtime update for their
-- order arrived carrying admin_notes too: confirmed on a local stack,
-- where a customer's live update contained the staff note verbatim.
--
-- FIX: the 023 pattern. Take table-wide SELECT away from the client
-- roles and grant it back column by column, minus the staff columns:
--   orders           admin_notes
--   refund_requests  admin_notes, reviewed_by (which staff member)
-- PostgREST refuses those columns to clients, and realtime leaves
-- columns the subscriber can't select out of the payload.
--
-- Staff still see the notes: the admin order and refund routes read
-- through the service role behind getStaffUser(), the same shape as
-- items (023). Customer pages already name their columns, none of them
-- staff columns, so nothing customer-facing changes.
--
-- ⚠️ A column added to either table later is NOT readable by clients
-- until granted. Re-run this file after adding one.
--
-- Idempotent; safe to re-run.
-- ============================================================

do $$
declare
  t record;
  visible text;
begin
  for t in
    select * from (values
      ('orders', array['admin_notes']),
      ('refund_requests', array['admin_notes', 'reviewed_by'])
    ) as v(tbl, hidden)
  loop
    if to_regclass('public.' || t.tbl) is null then
      raise notice 'Skipped public.% (not in this database)', t.tbl;
      continue;
    end if;

    select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
      into visible
      from information_schema.columns
     where table_schema = 'public'
       and table_name = t.tbl
       and column_name <> all (t.hidden);

    execute format('revoke select on public.%I from anon, authenticated', t.tbl);
    execute format('grant select (%s) on public.%I to anon, authenticated', visible, t.tbl);
  end loop;
end
$$;

comment on column public.orders.admin_notes is
  'Internal staff note. NOT readable by anon/authenticated (027); staff read it through the service role behind a staff gate.';
