-- ============================================================
-- 010_orders_server_authored.sql
--
-- 🚨 SECURITY — completes the fix 009 started. 009 was NOT enough.
--
-- 009 removed the customer's UPDATE policy, which stopped them
-- rewriting total_amount on an order the server had priced. But 001's
-- INSERT policy was left in place:
--
--   create policy "users create own orders" on public.orders
--     for insert with check (auth.uid() = user_id);
--
-- It checks who owns the row and nothing else. So the same attack
-- works one step earlier — don't tamper with a priced order, just
-- author a poisoned one from scratch:
--
--   POST /rest/v1/orders
--   { "user_id":"<self>", "total_amount":1, "status":"pending",
--     "order_items":[{"id":"<expensive>","price":1,"quantity":10}] }
--
-- /api/payment/paystack/initialize then charges total_amount (₦1),
-- confirmPaystackPayment() compares Paystack's ₦1 against the same
-- ₦1 and agrees, and mark_order_paid() decrements stock straight from
-- that client-supplied order_items array. Goods ship for ₦1.
--
-- The invariant both migrations are really reaching for:
--
--   ORDERS ARE SERVER-AUTHORED. A client may ask for one; only
--   /api/checkout/create-order may write one, because only it prices
--   the line items from the catalogue.
--
-- That is not expressible as an RLS policy — "total_amount must equal
-- the sum of the current prices of these items" is a computation, not
-- a row predicate. So the client loses write access entirely and the
-- route inserts with the service role.
--
-- Customers keep SELECT on their own orders. Staff keep 003's policies.
-- After this, orders have NO client write path at all: no insert, no
-- update, and cancelling goes through cancel_my_order() (009).
--
-- ⚠️ Ships with create-order/route.js switching to the admin client.
-- Run them together or checkout breaks.
--
-- Idempotent; safe to re-run.
-- ============================================================

drop policy if exists "users create own orders" on public.orders;

-- Defence in depth: even service_role writes go through this. It catches the
-- shape of the bug (a total that doesn't match the goods) rather than the
-- specific door, so a future route that forgets to price things fails loudly
-- instead of silently underselling.
create or replace function public.orders_validate_totals()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
  v_expected numeric := 0;
  v_price numeric;
  v_qty numeric;
begin
  if new.order_items is null or jsonb_array_length(new.order_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  -- Re-price every line from the catalogue, ignoring the prices the caller
  -- supplied. order_items stays a snapshot for history; it is not evidence.
  for v_item in select * from jsonb_array_elements(new.order_items)
  loop
    select price into v_price
      from public.items
     where id::text = v_item->>'id';

    if v_price is null then
      raise exception 'Order references an item that does not exist: %', v_item->>'id';
    end if;

    v_qty := coalesce((v_item->>'quantity')::numeric, 0);
    if v_qty <= 0 then
      raise exception 'Order line has a non-positive quantity';
    end if;

    -- Compare against the SNAPSHOT price too: a mismatch means the caller
    -- priced the line itself rather than reading the catalogue.
    if round((v_item->>'price')::numeric, 2) <> round(v_price, 2) then
      raise exception 'Order line price % does not match catalogue price % for item %',
        v_item->>'price', v_price, v_item->>'id';
    end if;

    v_expected := v_expected + (v_price * v_qty);
  end loop;

  -- subtotal must be the goods total. Shipping/VAT/discount are settings-driven
  -- and checked by lib/pricing.js; this catches the case that actually costs
  -- money — goods billed at less than they cost.
  --
  -- 1 kobo of tolerance, NOT exact equality: lib/pricing.js rounds in JS floats
  -- (Math.round(n*100)/100) while this rounds exact numerics, and a fractional
  -- kg line (3200.55 × 2.5) can legitimately land a kobo apart. Exact equality
  -- would reject real orders. A kobo is meaningless to an attacker — the fraud
  -- this stops is measured in thousands.
  if abs(round(coalesce(new.subtotal, 0), 2) - round(v_expected, 2)) > 0.01 then
    raise exception 'Order subtotal % does not match its line items (%)',
      new.subtotal, round(v_expected, 2);
  end if;

  -- The number Paystack is asked for. It must at least cover the goods after
  -- any discount — never less. (Shipping and added VAT only ever push it up.)
  if round(coalesce(new.total_amount, 0), 2)
     < round(v_expected - coalesce(new.discount_amount, 0), 2) - 0.01 then
    raise exception 'Order total % is less than its goods total after discount',
      new.total_amount;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_validate_totals_trigger on public.orders;
create trigger orders_validate_totals_trigger
  before insert on public.orders
  for each row execute function public.orders_validate_totals();

comment on function public.orders_validate_totals is
  'Re-prices every order line from the catalogue on insert. Backstop for the rule that orders are server-authored: no route, present or future, can create an order that undercharges. See 010 header.';
