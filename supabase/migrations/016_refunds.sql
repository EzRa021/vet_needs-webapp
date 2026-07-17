-- ============================================================
-- 016_refunds.sql
-- Refunds that actually return money.
--
-- 🐛 WHAT WAS WRONG: `refunded` was a status any staff member could
-- pick from a dropdown. Nothing called Paystack. The order said
-- "Refunded", the customer saw "Refunded", and the money stayed in the
-- merchant account. The admin API even spells out the right rule and
-- then breaks it:
--
--   "'paid' is deliberately absent: only the Paystack webhook / verify
--    flow may mark an order paid ... Letting an operator set 'paid'
--    would bypass payment verification"
--
-- ...while leaving 'refunded' settable by hand. Same class of lie,
-- pointed the other way — and worse, because the customer is told they
-- have been repaid.
--
-- THE RULE THIS ESTABLISHES: an order becomes 'refunded' when PAYSTACK
-- says the money went back. Not when someone intends it to. The status
-- is a record of a fact, not a wish.
--
-- Refunds at Paystack are ASYNCHRONOUS — they return 'pending' and
-- settle later. So there are two states, not one: the request is
-- `approved` (we asked Paystack) and only becomes `processed` when the
-- refund.processed webhook lands. The order flips to 'refunded' at that
-- second moment. Collapsing the two would recreate the original lie
-- with extra steps.
--
-- Idempotent; safe to re-run.
-- ============================================================

create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,

  -- Null for guests (011). The email is the contact of record either way.
  user_id uuid references auth.users (id) on delete set null,
  email text not null,

  reason text not null,
  details text,

  status text not null default 'requested'
    check (status in ('requested', 'approved', 'rejected', 'processed', 'failed')),

  -- Null = the whole order. Partial refunds are the common case (one bag
  -- arrived split), so the amount is a decision, not an assumption.
  requested_amount numeric(12, 2) check (requested_amount is null or requested_amount > 0),
  refunded_amount numeric(12, 2),

  -- Paystack's id for the refund, so a support conversation has a handle and
  -- the webhook can find its way back to this row.
  paystack_refund_id text,

  -- Whether the goods come back into stock. NOT an assumption: feed returned
  -- because it was mouldy must not be resold, and mark_order_paid() already
  -- decremented it, so getting this wrong silently corrupts inventory.
  restock boolean not null default false,

  admin_notes text,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists refund_requests_order_idx on public.refund_requests (order_id);
create index if not exists refund_requests_status_idx on public.refund_requests (status, created_at desc);
create index if not exists refund_requests_paystack_idx
  on public.refund_requests (paystack_refund_id) where paystack_refund_id is not null;

-- One live request per order. Without this, a customer who clicks twice (or
-- gets impatient a week later) creates a second request, and approving both
-- would refund the same money twice.
create unique index if not exists refund_requests_one_open_per_order
  on public.refund_requests (order_id)
  where status in ('requested', 'approved');

drop trigger if exists refund_requests_set_updated_at on public.refund_requests;
create trigger refund_requests_set_updated_at
  before update on public.refund_requests
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.refund_requests enable row level security;

drop policy if exists "users read own refund requests" on public.refund_requests;
create policy "users read own refund requests" on public.refund_requests
  for select using (auth.uid() = user_id or public.is_staff());

-- No customer INSERT policy: requests are created through request_refund()
-- below, which checks the order is actually refundable. The same lesson as
-- orders (009/010) — "you may only ask for a refund on an order you own that
-- has been paid for and isn't already refunded" is a computation, not a row
-- predicate, so RLS can't express it.
drop policy if exists "staff manage refund requests" on public.refund_requests;
create policy "staff manage refund requests" on public.refund_requests
  for all using (public.is_staff()) with check (public.is_staff());

-- ------------------------------------------------------------
-- Customer asks for a refund.
--
-- p_token carries a guest's capability (011); a signed-in customer is
-- identified by their session. Ownership is proved here, not assumed.
-- ------------------------------------------------------------
create or replace function public.request_refund(
  p_order_id uuid,
  p_reason text,
  p_details text default null,
  p_token uuid default null
)
returns table (ok boolean, reason text)
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_is_owner boolean;
begin
  select * into v_order from public.orders where id = p_order_id;

  if not found then
    return query select false, 'Order not found.'; return;
  end if;

  v_is_owner :=
    (auth.uid() is not null and v_order.user_id = auth.uid())
    or (v_order.user_id is null and p_token is not null and v_order.guest_token = p_token);

  if not v_is_owner then
    -- Same answer as "not found": an order id must not reveal whose it is.
    return query select false, 'Order not found.'; return;
  end if;

  -- You cannot be refunded money you never paid. A pending order is cancelled,
  -- not refunded (see cancel_my_order in 009).
  if v_order.status = 'pending' then
    return query select false,
      'This order hasn''t been paid for — cancel it instead.'; return;
  end if;

  if v_order.status in ('canceled', 'refunded') then
    return query select false, 'This order can''t be refunded.'; return;
  end if;

  if coalesce(trim(p_reason), '') = '' then
    return query select false, 'Please tell us what went wrong.'; return;
  end if;

  insert into public.refund_requests (order_id, user_id, email, reason, details)
  values (
    p_order_id,
    v_order.user_id,
    coalesce(v_order.email, ''),
    trim(p_reason),
    nullif(trim(coalesce(p_details, '')), '')
  );

  return query select true, null::text;
exception
  -- 23505 = the one-open-request index. Not an error worth alarming anyone
  -- with: they already asked, which is what they wanted.
  when unique_violation then
    return query select false, 'You already have a refund request open for this order.';
end;
$$;

revoke all on function public.request_refund(uuid, text, text, uuid) from public;
grant execute on function public.request_refund(uuid, text, text, uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- Paystack confirmed the money moved. Called by the webhook (service role),
-- never by a human.
--
-- This is the ONLY thing that may set an order to 'refunded'.
-- ------------------------------------------------------------
create or replace function public.apply_refund_result(
  p_refund_id text,
  p_success boolean,
  p_amount numeric default null
)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_req public.refund_requests%rowtype;
  v_line jsonb;
begin
  select * into v_req
    from public.refund_requests
   where paystack_refund_id = p_refund_id
   for update;

  if not found then
    raise warning 'apply_refund_result: no request for refund %', p_refund_id;
    return false;
  end if;

  -- Idempotent: Paystack retries webhooks, and refund.processed can arrive
  -- twice. Restocking twice would invent inventory.
  if v_req.status in ('processed', 'failed') then
    return false;
  end if;

  if not p_success then
    update public.refund_requests
       set status = 'failed', processed_at = now()
     where id = v_req.id;
    return true;
  end if;

  update public.refund_requests
     set status = 'processed',
         refunded_amount = coalesce(p_amount, requested_amount),
         processed_at = now()
   where id = v_req.id;

  -- NOW the order is refunded — because the money has actually gone back.
  update public.orders set status = 'refunded' where id = v_req.order_id;

  -- Put the goods back only if someone decided they're resellable.
  if v_req.restock then
    for v_line in
      select * from jsonb_array_elements(
        (select order_items from public.orders where id = v_req.order_id)
      )
    loop
      update public.items
         set stock = coalesce(stock, 0) + (v_line->>'quantity')::numeric
       where id::text = v_line->>'id'
         and stock is not null;
    end loop;
  end if;

  return true;
end;
$$;

revoke all on function public.apply_refund_result(text, boolean, numeric) from public;
grant execute on function public.apply_refund_result(text, boolean, numeric) to service_role;

comment on table public.refund_requests is
  'Customer refund requests. An order only becomes ''refunded'' when Paystack confirms the money moved (apply_refund_result via the refund.processed webhook) — never because a human picked it from a dropdown. See 016 header.';
comment on column public.refund_requests.restock is
  'Whether to return the goods to stock. Defaults to FALSE: mouldy feed must not be resold, and mark_order_paid() already decremented, so a wrong default silently corrupts inventory.';
