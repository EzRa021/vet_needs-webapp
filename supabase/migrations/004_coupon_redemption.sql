-- ============================================================
-- VetNeeds — coupon redemption (checkout wiring)
--
-- Customers can't read the coupons table (admin-only RLS), so validation
-- runs through a SECURITY DEFINER function. The discount is ALWAYS computed
-- server-side from the database — a client-supplied amount is never trusted.
--
-- Redemption happens inside mark_order_paid(), so a coupon use is recorded
-- in the same locked transaction that marks the order paid:
--   • abandoned checkouts never burn a coupon use
--   • the redemption can't be double-counted (mark_order_paid only fires
--     once, while status = 'pending')
--
-- Run AFTER 000–003. Idempotent.
-- ============================================================

-- ------------------------------------------------------------
-- 1. validate_coupon — the single source of truth for "can this
--    code be used, and what is it worth?"
-- ------------------------------------------------------------
create or replace function public.validate_coupon(
  p_code text,
  p_user uuid,
  p_subtotal numeric
)
returns table (
  valid boolean,
  reason text,
  coupon_id uuid,
  code text,
  discount numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.coupons%rowtype;
  used_by_user int;
  d numeric;
begin
  select * into c
  from public.coupons
  where upper(public.coupons.code) = upper(trim(p_code));

  if not found then
    return query select false, 'That code doesn''t exist.', null::uuid, null::text, 0::numeric;
    return;
  end if;

  if not c.is_active then
    return query select false, 'That code is no longer active.', null::uuid, null::text, 0::numeric;
    return;
  end if;

  if c.starts_at is not null and c.starts_at > now() then
    return query select false, 'That code isn''t available yet.', null::uuid, null::text, 0::numeric;
    return;
  end if;

  if c.expires_at is not null and c.expires_at <= now() then
    return query select false, 'That code has expired.', null::uuid, null::text, 0::numeric;
    return;
  end if;

  if c.max_uses is not null and c.used_count >= c.max_uses then
    return query select false, 'That code has been fully used.', null::uuid, null::text, 0::numeric;
    return;
  end if;

  if p_subtotal < coalesce(c.min_order_amount, 0) then
    return query select false,
      'Spend at least ' || to_char(c.min_order_amount, 'FM999,999,990.00') || ' to use this code.',
      null::uuid, null::text, 0::numeric;
    return;
  end if;

  -- Per-customer limit
  if p_user is not null then
    select count(*) into used_by_user
    from public.coupon_redemptions r
    where r.coupon_id = c.id and r.user_id = p_user;

    if used_by_user >= coalesce(c.max_uses_per_user, 1) then
      return query select false, 'You''ve already used this code.', null::uuid, null::text, 0::numeric;
      return;
    end if;
  end if;

  -- Authoritative discount calculation
  if c.discount_type = 'percent' then
    d := p_subtotal * (c.discount_value / 100.0);
    if c.max_discount_amount is not null then
      d := least(d, c.max_discount_amount);
    end if;
  else
    d := c.discount_value;
  end if;

  d := round(least(d, p_subtotal), 2);   -- never discount more than the order

  return query select true, null::text, c.id, c.code, d;
end;
$$;

revoke all on function public.validate_coupon(text, uuid, numeric) from public;
grant execute on function public.validate_coupon(text, uuid, numeric)
  to authenticated, service_role;

-- ------------------------------------------------------------
-- 2. mark_order_paid — now also records the coupon redemption.
--    Replaces the version from 001; stock logic is unchanged.
-- ------------------------------------------------------------
create or replace function public.mark_order_paid(p_reference text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_qty numeric;
  v_coupon public.coupons%rowtype;
begin
  -- Lock the order so concurrent verify + webhook can't both process it
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
  perform set_config('app.sale_order_id', v_order.id::text, true);

  for v_item in select * from jsonb_array_elements(v_order.order_items)
  loop
    v_qty := (v_item->>'quantity')::numeric;
    update public.items
       set stock = stock - v_qty
     where id::text = v_item->>'id'
       and stock >= v_qty;
  end loop;

  perform set_config('app.sale_order_id', '', true);

  -- Record the coupon use, if this order carried one. The customer has
  -- already paid the discounted amount, so we always honour it — the limit
  -- check happened at order creation. Locking the coupon keeps used_count
  -- accurate under concurrency.
  if v_order.coupon_code is not null and coalesce(v_order.discount_amount, 0) > 0 then
    select * into v_coupon
    from public.coupons
    where upper(code) = upper(v_order.coupon_code)
    for update;

    if found then
      insert into public.coupon_redemptions (coupon_id, order_id, user_id, discount_amount)
      values (v_coupon.id, v_order.id, v_order.user_id, v_order.discount_amount)
      on conflict (coupon_id, order_id) do nothing;

      if found then
        update public.coupons
           set used_count = used_count + 1
         where id = v_coupon.id;
      end if;
    end if;
  end if;

  update public.orders
     set status = 'paid',
         paid_at = now()
   where id = v_order.id;

  return true;
end;
$$;

revoke all on function public.mark_order_paid(text) from public;
grant execute on function public.mark_order_paid(text) to service_role;

-- ------------------------------------------------------------
-- 3. Customers may read their OWN redemptions (order history).
--    Staff read policy already exists from 003.
-- ------------------------------------------------------------
drop policy if exists "users read own redemptions" on public.coupon_redemptions;
create policy "users read own redemptions" on public.coupon_redemptions
  for select using (auth.uid() = user_id);

-- ============================================================
-- Note: coupons stay unreadable to customers by design. The only way a
-- shopper learns anything about a code is through validate_coupon(), which
-- returns a single yes/no + amount — no enumeration of the coupon table.
-- ============================================================
