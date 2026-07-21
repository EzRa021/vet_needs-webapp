-- ============================================================
-- VetNeeds — payments, stock safety, and RLS hardening
-- Run this in Supabase Dashboard → SQL Editor (one time).
-- ============================================================

-- 1. Payment tracking columns on orders
alter table public.orders
  add column if not exists payment_reference text,
  add column if not exists paid_at timestamptz;

create unique index if not exists orders_payment_reference_key
  on public.orders (payment_reference)
  where payment_reference is not null;

-- 2. Atomic "mark paid + decrement stock" — idempotent and race-safe.
--    Returns true when the order was transitioned pending → paid by THIS call,
--    false when it had already been processed (safe to call twice:
--    browser verify + webhook).
create or replace function public.mark_order_paid(p_reference text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_qty numeric; -- numeric: kg items can have fractional quantities
begin
  -- Lock the order row so concurrent verify + webhook can't both process it
  select * into v_order
  from public.orders
  where payment_reference = p_reference
  for update;

  if not found then
    raise exception 'Order not found for reference %', p_reference;
  end if;

  if v_order.status <> 'pending' then
    return false; -- already processed
  end if;

  -- Flag so the item_history trigger logs these stock changes as 'sale'
  -- with this order's id (see log_item_changes in 000_initial_schema.sql)
  perform set_config('app.sale_order_id', v_order.id::text, true);

  -- Decrement stock for each line item (id compared as text to work with
  -- both uuid and bigint primary keys)
  for v_item in select * from jsonb_array_elements(v_order.order_items)
  loop
    v_qty := (v_item->>'quantity')::numeric;
    update public.items
       set stock = stock - v_qty
     where id::text = v_item->>'id'
       and stock >= v_qty;
    -- If stock ran out between order and payment we still honor the paid
    -- order (customer already paid); stock floor is handled by the check
    -- constraint below staying >= 0 via the WHERE guard.
  end loop;

  -- clear the sale flag so later stock updates in this transaction
  -- are not mislabeled as sales
  perform set_config('app.sale_order_id', '', true);

  update public.orders
     set status = 'paid',
         paid_at = now()
   where id = v_order.id;

  return true;
end;
$$;

-- Allow the function to be called with the service-role / authenticated keys
revoke all on function public.mark_order_paid(text) from public;
grant execute on function public.mark_order_paid(text) to service_role;

-- 3. Keep stock from ever going negative
alter table public.items
  drop constraint if exists items_stock_non_negative;
alter table public.items
  add constraint items_stock_non_negative check (stock is null or stock >= 0);

-- 4. Row Level Security
alter table public.items enable row level security;
alter table public.categories enable row level security;
alter table public.departments enable row level security;
alter table public.orders enable row level security;

-- Catalog: anyone can read, nobody can write via the anon/auth keys
drop policy if exists "items readable by all" on public.items;
create policy "items readable by all" on public.items
  for select using (true);

drop policy if exists "categories readable by all" on public.categories;
create policy "categories readable by all" on public.categories
  for select using (true);

drop policy if exists "departments readable by all" on public.departments;
create policy "departments readable by all" on public.departments
  for select using (true);

-- Orders: owners can create and read their own; only 'pending' orders can be
-- touched by users (payment_reference update during initialize). Status
-- changes to 'paid' happen only through mark_order_paid / service role.
drop policy if exists "users create own orders" on public.orders;
create policy "users create own orders" on public.orders
  for insert with check (auth.uid() = user_id);

drop policy if exists "users read own orders" on public.orders;
create policy "users read own orders" on public.orders
  for select using (auth.uid() = user_id);

drop policy if exists "users update own pending orders" on public.orders;
create policy "users update own pending orders" on public.orders
  for update
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status = 'pending');

-- 5. (Optional cleanup) The old client-callable stock function is no longer
--    used by the app; remove public access if it exists.
-- revoke all on function public.decrease_item_stock from anon, authenticated;
