-- ============================================================
-- 020_coupon_scope.sql
-- Coupons that can apply to part of an order, plus first-order-only
-- codes and bulk one-time code generation.
--
-- 🐛 FIXES A LIVE BUG FIRST: validate_coupon() was granted to
-- `authenticated, service_role` — not `anon`. Guest checkout (011) let
-- guests use coupons, and create-order calls this with the CALLER's
-- session, which for a guest is the anon role. So a guest entering a
-- valid code at checkout got "Could not apply that code" — permission
-- denied, dressed up as an invalid coupon. Nothing tested it because
-- coupons+guests only became possible in 011.
--
-- WHY THE SIGNATURE CHANGES: scoping is impossible with the old
-- arguments. `validate_coupon(code, user, SUBTOTAL)` gets one number —
-- it cannot know that ₦8,000 of a ₦20,000 order is Poultry Feed, so it
-- cannot compute "10% off feed". The items have to come in.
--
-- And they come in as ids + quantities ONLY. The function looks the
-- prices up itself, so the eligible subtotal is derived in SQL from the
-- catalogue rather than from whatever the caller totted up — the same
-- rule as orders (010).
--
-- Idempotent; safe to re-run.
-- ============================================================

alter table public.coupons
  -- Empty/null = the whole order, which is what every existing coupon means.
  -- Scope is ADDITIVE: a coupon naming both a category and a product covers both.
  add column if not exists applies_to_category_ids uuid[] not null default '{}',
  add column if not exists applies_to_item_ids uuid[] not null default '{}',
  -- "New customers only". Requires an account: see the guest note below.
  add column if not exists first_order_only boolean not null default false,
  -- Set when generate_coupon_codes() made this one, so the admin list can group
  -- a batch of 500 rather than drown in it.
  add column if not exists batch_label text;

create index if not exists coupons_batch_idx
  on public.coupons (batch_label) where batch_label is not null;

-- ------------------------------------------------------------
-- The old 3-arg version must go, or PostgREST sees two overloads and
-- rpc('validate_coupon') becomes ambiguous (PGRST203).
-- ------------------------------------------------------------
drop function if exists public.validate_coupon(text, uuid, numeric);

create or replace function public.validate_coupon(
  p_code text,
  p_user uuid,
  p_items jsonb          -- [{ id, quantity }] — prices are NOT taken from here
)
returns table (
  valid boolean,
  reason text,
  coupon_id uuid,
  code text,
  discount numeric,
  eligible_subtotal numeric   -- what the discount was computed against
)
language plpgsql stable security definer set search_path = public as $$
declare
  c public.coupons%rowtype;
  used_by_user int;
  v_subtotal numeric := 0;
  v_eligible numeric := 0;
  v_scope_categories uuid[];
  v_has_scope boolean;
  d numeric;
begin
  select * into c
  from public.coupons
  where upper(public.coupons.code) = upper(trim(p_code));

  if not found then
    return query select false, 'That code doesn''t exist.', null::uuid, null::text, 0::numeric, 0::numeric;
    return;
  end if;

  if not c.is_active then
    return query select false, 'That code is no longer active.', null::uuid, null::text, 0::numeric, 0::numeric;
    return;
  end if;

  if c.starts_at is not null and c.starts_at > now() then
    return query select false, 'That code isn''t available yet.', null::uuid, null::text, 0::numeric, 0::numeric;
    return;
  end if;

  if c.expires_at is not null and c.expires_at <= now() then
    return query select false, 'That code has expired.', null::uuid, null::text, 0::numeric, 0::numeric;
    return;
  end if;

  if c.max_uses is not null and c.used_count >= c.max_uses then
    return query select false, 'That code has been fully used.', null::uuid, null::text, 0::numeric, 0::numeric;
    return;
  end if;

  -- ---- Price the cart from the CATALOGUE, not from the request ----
  v_has_scope := cardinality(c.applies_to_category_ids) > 0
              or cardinality(c.applies_to_item_ids) > 0;

  -- A category scope means that category AND everything under it — otherwise
  -- "10% off Feed" would miss every product filed in Poultry Feeds beneath it,
  -- which is where the products actually live.
  if cardinality(c.applies_to_category_ids) > 0 then
    select coalesce(array_agg(distinct d2), '{}')
      into v_scope_categories
      from unnest(c.applies_to_category_ids) as root,
           lateral unnest(public.category_descendant_ids(root)) as d2;
  else
    v_scope_categories := '{}';
  end if;

  select
    coalesce(sum(i.price * (line->>'quantity')::numeric), 0),
    coalesce(sum(
      case
        when not v_has_scope then i.price * (line->>'quantity')::numeric
        when i.category_id = any (v_scope_categories) then i.price * (line->>'quantity')::numeric
        when i.id = any (c.applies_to_item_ids) then i.price * (line->>'quantity')::numeric
        else 0
      end
    ), 0)
  into v_subtotal, v_eligible
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as line
  join public.items i on i.id::text = line->>'id';

  v_subtotal := round(v_subtotal, 2);
  v_eligible := round(v_eligible, 2);

  -- Minimum spend is judged on the WHOLE order (that's what "spend ₦20,000"
  -- means to a shopper), while the discount applies only to the eligible part.
  if v_subtotal < coalesce(c.min_order_amount, 0) then
    return query select false,
      'Spend at least ' || to_char(c.min_order_amount, 'FM999,999,990.00') || ' to use this code.',
      null::uuid, null::text, 0::numeric, 0::numeric;
    return;
  end if;

  if v_has_scope and v_eligible <= 0 then
    return query select false,
      'This code only applies to certain products, and none are in your cart.',
      null::uuid, null::text, 0::numeric, 0::numeric;
    return;
  end if;

  -- ---- Per-customer rules ----
  if p_user is not null then
    select count(*) into used_by_user
    from public.coupon_redemptions r
    where r.coupon_id = c.id and r.user_id = p_user;

    if used_by_user >= coalesce(c.max_uses_per_user, 1) then
      return query select false, 'You''ve already used this code.', null::uuid, null::text, 0::numeric, 0::numeric;
      return;
    end if;
  end if;

  if c.first_order_only then
    -- A guest has no history to check. Rather than let one code be reused
    -- forever from a fresh browser, say what's needed — this is the one place
    -- guest checkout genuinely can't work.
    if p_user is null then
      return query select false,
        'This code is for new customers — please sign in or create an account to use it.',
        null::uuid, null::text, 0::numeric, 0::numeric;
      return;
    end if;

    if exists (
      select 1 from public.orders o
       where o.user_id = p_user
         and o.status in ('paid', 'processing', 'shipped', 'delivered')
    ) then
      return query select false, 'This code is for first orders only.', null::uuid, null::text, 0::numeric, 0::numeric;
      return;
    end if;
  end if;

  -- ---- The money ----
  if c.discount_type = 'percent' then
    d := v_eligible * (c.discount_value / 100.0);
    if c.max_discount_amount is not null then
      d := least(d, c.max_discount_amount);
    end if;
  else
    -- A fixed ₦ discount can't exceed the part of the order it applies to, or
    -- "₦2,000 off feed" would quietly discount the dog toys too.
    d := least(c.discount_value, v_eligible);
  end if;

  d := round(least(d, v_eligible), 2);

  return query select true, null::text, c.id, c.code, d, v_eligible;
end;
$$;

revoke all on function public.validate_coupon(text, uuid, jsonb) from public;
-- anon INCLUDED — see the header. Guests check out, guests use coupons, and
-- create-order calls this with the guest's own (anon) session.
grant execute on function public.validate_coupon(text, uuid, jsonb)
  to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- Bulk one-time codes (e.g. 500 single-use ₦1,000 vouchers for a campaign).
--
-- Codes are generated in SQL so they're unguessable and unique: doing it in the
-- app means a round-trip per code and a collision race on `coupons.code`.
-- ------------------------------------------------------------
create or replace function public.generate_coupon_codes(
  p_count int,
  p_prefix text,
  p_discount_type text,
  p_discount_value numeric,
  p_batch_label text,
  p_expires_at timestamptz default null,
  p_min_order_amount numeric default 0
)
returns setof text
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  i int;
begin
  if not public.is_staff() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  if p_count is null or p_count < 1 or p_count > 1000 then
    raise exception 'Generate between 1 and 1000 codes at a time';
  end if;
  if p_discount_type not in ('percent', 'fixed') then
    raise exception 'discount_type must be percent or fixed';
  end if;

  for i in 1..p_count loop
    -- 8 chars from a 32-char alphabet ≈ 10^12 combinations. Ambiguous glyphs
    -- (0/O, 1/I) are excluded: these get read off paper and typed by hand.
    loop
      v_code := upper(coalesce(nullif(trim(p_prefix), ''), 'PETDO')) || '-' ||
        string_agg(
          substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                 floor(random() * 32 + 1)::int, 1), ''
        )
      from generate_series(1, 8);

      exit when not exists (select 1 from public.coupons where code = v_code);
    end loop;

    insert into public.coupons (
      code, description, discount_type, discount_value,
      min_order_amount, max_uses, max_uses_per_user,
      expires_at, batch_label
    ) values (
      v_code, p_batch_label, p_discount_type, p_discount_value,
      coalesce(p_min_order_amount, 0),
      1,  -- one-time by definition
      1,
      p_expires_at, p_batch_label
    );

    return next v_code;
  end loop;
end;
$$;

revoke all on function public.generate_coupon_codes(int, text, text, numeric, text, timestamptz, numeric) from public;
grant execute on function public.generate_coupon_codes(int, text, text, numeric, text, timestamptz, numeric) to authenticated;

comment on function public.validate_coupon(text, uuid, jsonb) is
  'Validates a code against a cart and returns the discount. Takes ids+quantities and prices them from the catalogue — a caller-supplied subtotal is never trusted, and scoping needs the lines anyway. Granted to anon because guests check out (011).';
comment on column public.coupons.applies_to_category_ids is
  'Category scope, expanded to descendants at validation time — "off Feed" must include Poultry Feeds beneath it, which is where products actually live. Empty = whole order.';
