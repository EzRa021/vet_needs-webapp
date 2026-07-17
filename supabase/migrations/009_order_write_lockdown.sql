-- ============================================================
-- 009_order_write_lockdown.sql
--
-- ⚠️ SECURITY FIX — pay ₦1 for any order.
--
-- 001 created:
--
--   create policy "users update own pending orders" on public.orders
--     for update
--     using      (auth.uid() = user_id and status = 'pending')
--     with check (auth.uid() = user_id and status = 'pending');
--
-- The intent (per its comment) was to let the browser write
-- `payment_reference` during checkout. But **Postgres RLS cannot
-- restrict which columns are written** — a policy gates rows, not
-- fields. `with check` only pins `status`, so every other column of
-- the customer's own pending order was writable with their ordinary
-- anon JWT, straight through PostgREST:
--
--   PATCH /rest/v1/orders?id=eq.<own-order>   {"total_amount": 1}
--
-- Both halves of the payment check then read that same column:
--   - /api/payment/paystack/initialize charges order.total_amount
--   - confirmPaystackPayment() compares Paystack's paid amount to
--     order.total_amount
-- so after the rewrite they agree at ₦1, mark_order_paid() fires, and
-- ₦50,000 of feed ships for ₦1. The code's "the amount comes from the
-- database, never the request body" comment was true and yet no
-- defence at all: the database value was attacker-controlled.
--
-- Fix: customers get NO update path on orders. The only legitimate
-- client write was payment_reference, which now happens server-side
-- with the service role (see initialize/route.js). Cancelling goes
-- through a narrow SECURITY DEFINER function that touches exactly one
-- column.
--
-- Idempotent; safe to re-run.
-- ============================================================

drop policy if exists "users update own pending orders" on public.orders;

-- Customers keep: insert own (create-order), select own. Staff keep their
-- own update policy from 003. Nothing else may write an order.

-- ------------------------------------------------------------
-- Cancelling an unpaid order — the one write a customer may make.
--
-- A function rather than a policy, because "may set status to exactly
-- 'canceled', on exactly their own order, only while it is pending, and
-- change nothing else" is not expressible as an RLS policy.
-- ------------------------------------------------------------
create or replace function public.cancel_my_order(p_order_id uuid)
returns table (ok boolean, reason text)
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
begin
  if auth.uid() is null then
    return query select false, 'You must be signed in.'; return;
  end if;

  -- Lock the row: a cancel racing the payment webhook must not both win.
  select * into v_order
    from public.orders
   where id = p_order_id
   for update;

  if not found or v_order.user_id <> auth.uid() then
    -- Same answer either way: a stranger's order id must not be
    -- distinguishable from a nonexistent one.
    return query select false, 'Order not found.'; return;
  end if;

  if v_order.status <> 'pending' then
    -- Paid orders are a refund conversation, not a cancel. Stock has been
    -- decremented and money has moved.
    return query select false,
      case v_order.status
        when 'canceled' then 'This order is already canceled.'
        else 'This order can no longer be canceled — please contact support.'
      end;
    return;
  end if;

  update public.orders
     set status = 'canceled'
   where id = p_order_id;

  return query select true, null::text;
end;
$$;

revoke all on function public.cancel_my_order(uuid) from public;
grant execute on function public.cancel_my_order(uuid) to authenticated;

comment on function public.cancel_my_order(uuid) is
  'Lets a customer cancel their own still-pending order. Exists because RLS cannot limit which columns an update touches — see 009 header.';
