-- ============================================================
-- 011_guest_checkout.sql
-- Lets someone buy without creating an account.
--
-- Shape: orders.user_id becomes nullable, orders.email becomes the
-- contact of record, and a guest order carries an unguessable
-- guest_token that acts as its capability — the only way to look at it
-- without an account.
--
-- Note what this migration does NOT need: an insert policy for anon.
-- 010 made orders server-authored (the client has no write path at
-- all; /api/checkout/create-order inserts with the service role), so
-- guests get order creation for free and by the same rules —
-- server-priced, trigger-validated. Had 011 come first, it would have
-- needed an "anon can insert orders" policy, which is exactly the ₦1
-- hole again.
--
-- Idempotent; safe to re-run.
-- ============================================================

alter table public.orders
  add column if not exists email text,
  add column if not exists guest_token uuid;

-- Guest orders have no user. Existing rows all have one, so this is safe.
alter table public.orders alter column user_id drop not null;

-- Every order must be reachable by SOMEONE: a signed-in owner, or an email +
-- token. A row with neither is unreachable by its own customer.
alter table public.orders drop constraint if exists orders_owner_or_email;
alter table public.orders
  add constraint orders_owner_or_email
  check (user_id is not null or email is not null);

-- Look-ups are by (id, token) — index the token to keep that cheap.
create index if not exists orders_guest_token_idx
  on public.orders (guest_token) where guest_token is not null;

-- ------------------------------------------------------------
-- Idempotency for guests.
--
-- 006's index is `unique (user_id, idempotency_key) where idempotency_key is
-- not null`. In Postgres NULLs are DISTINCT in a unique index, so for guests
-- (user_id null) every row compares unequal and two identical submits both
-- insert. The double-click protection would silently not apply to exactly the
-- customers who can't see their order history to notice the twin.
-- ------------------------------------------------------------
create unique index if not exists orders_guest_idempotency_key_idx
  on public.orders (idempotency_key)
  where user_id is null and idempotency_key is not null;

-- ------------------------------------------------------------
-- A guest can use a coupon, and mark_order_paid() records the redemption —
-- but coupon_redemptions.user_id is NOT NULL and it inserts v_order.user_id.
-- For a guest that raises inside mark_order_paid(), which means Paystack has
-- taken the money and the order never becomes 'paid'. Make it nullable before
-- guests exist, not after.
-- ------------------------------------------------------------
alter table public.coupon_redemptions alter column user_id drop not null;

comment on column public.coupon_redemptions.user_id is
  'Null for guest orders. The per-customer coupon limit only applies to accounts — a guest has no identity to count against (validate_coupon skips that check when p_user is null). Global max_uses still applies.';

-- Claiming (below) matches on the address case-insensitively.
create index if not exists orders_email_lower_idx
  on public.orders (lower(email)) where email is not null;

-- ------------------------------------------------------------
-- Reading a guest order.
--
-- RLS already denies it: "users read own orders" is
-- `using (auth.uid() = user_id)`, and a guest order's user_id is null, so
-- `null = null` is null — never true. Nobody can select one, which is what we
-- want. This function is the single, narrow exception: it needs the exact
-- token, and it never returns guest_token itself.
-- ------------------------------------------------------------
create or replace function public.get_guest_order(p_order_id uuid, p_token uuid)
returns table (
  id uuid,
  created_at timestamptz,
  paid_at timestamptz,
  status text,
  email text,
  subtotal numeric,
  shipping_fee numeric,
  tax_amount numeric,
  discount_amount numeric,
  coupon_code text,
  total_amount numeric,
  order_items jsonb,
  shipping_address text,
  tracking_number text,
  notes text,
  payment_reference text
)
language plpgsql security definer set search_path = public as $$
begin
  if p_order_id is null or p_token is null then
    return;
  end if;

  return query
    select o.id, o.created_at, o.paid_at, o.status, o.email, o.subtotal,
           o.shipping_fee, o.tax_amount, o.discount_amount, o.coupon_code,
           o.total_amount, o.order_items, o.shipping_address, o.tracking_number,
           o.notes, o.payment_reference
      from public.orders o
     where o.id = p_order_id
       and o.guest_token = p_token
       -- Once an order is claimed by an account it stops being reachable by
       -- token: an old link in an inbox must not outlive the claim.
       and o.user_id is null;
end;
$$;

revoke all on function public.get_guest_order(uuid, uuid) from public;
grant execute on function public.get_guest_order(uuid, uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- Cancelling a guest order — the token stands in for the session.
-- ------------------------------------------------------------
create or replace function public.cancel_guest_order(p_order_id uuid, p_token uuid)
returns table (ok boolean, reason text)
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
begin
  if p_order_id is null or p_token is null then
    return query select false, 'Order not found.'; return;
  end if;

  select * into v_order
    from public.orders
   where id = p_order_id
   for update;

  if not found or v_order.user_id is not null or v_order.guest_token <> p_token then
    return query select false, 'Order not found.'; return;
  end if;

  if v_order.status <> 'pending' then
    return query select false,
      case v_order.status
        when 'canceled' then 'This order is already canceled.'
        else 'This order can no longer be canceled — please contact support.'
      end;
    return;
  end if;

  update public.orders set status = 'canceled' where id = p_order_id;
  return query select true, null::text;
end;
$$;

revoke all on function public.cancel_guest_order(uuid, uuid) from public;
grant execute on function public.cancel_guest_order(uuid, uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- Claiming guest orders onto an account.
--
-- ⚠️ The security-critical part. Claiming on SIGNUP would be a takeover:
-- anyone could register victim@example.com, never confirm it, and inherit
-- that person's order history and addresses. So the hook is email
-- CONFIRMATION, not creation — the moment Supabase sets email_confirmed_at,
-- which is proof the person controls the inbox the orders were placed from.
--
-- Fires on INSERT too, because OAuth users (Google/Facebook) arrive with
-- email_confirmed_at already set — the provider did the verifying.
-- ------------------------------------------------------------
create or replace function public.claim_guest_orders()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_confirmed boolean;
begin
  v_confirmed := new.email_confirmed_at is not null;

  -- Only act on the transition into "confirmed", so re-confirmations and
  -- unrelated profile updates don't re-run this.
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return new;
  end if;

  if not v_confirmed or new.email is null then
    return new;
  end if;

  update public.orders
     set user_id = new.id,
         -- Burn the token: the account is now the way in, and an emailed link
         -- should not keep working after the order has an owner.
         guest_token = null
   where user_id is null
     and lower(email) = lower(new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.claim_guest_orders();

comment on function public.claim_guest_orders is
  'Links guest orders to an account when the email is CONFIRMED (never at signup — that would let anyone claim a stranger''s orders by registering their address). See 011 header.';
comment on column public.orders.guest_token is
  'Capability for a guest order: the only way to read it without an account. Nulled once the order is claimed. Never exposed by get_guest_order().';
