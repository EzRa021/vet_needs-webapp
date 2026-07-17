-- ============================================================
-- 022_stock_notifications.sql
-- "Tell me when this is back."
--
-- CHANNEL-AGNOSTIC ON PURPOSE. `notify_by` exists from day one even
-- though only email can send today. When WhatsApp arrives — Cloud API,
-- or anything else — it's a new sender reading the same queue, not a
-- migration and a rewrite. What it is NOT is a promise: the UI only
-- offers channels that can actually deliver (see components/notify-me),
-- because a "we'll WhatsApp you" that nothing sends is the same class of
-- lie as the fake testimonials and the refunds that refunded nothing.
--
-- THE QUEUE IS A TRIGGER, NOT A POLL. Stock can rise from a dozen places
-- (adjust_stock, a refund restock, an admin edit, a future POS sync).
-- Marking requests ready in the one place that sees every stock write —
-- the row trigger — means no code path can forget. Sending still happens
-- outside the transaction: an email provider must never be able to fail
-- a stock update.
--
-- Idempotent; safe to re-run.
-- ============================================================

create table if not exists public.stock_notifications (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,

  -- Signed-in customers get linked; guests are just a contact.
  user_id uuid references auth.users (id) on delete set null,
  email text,
  phone text,

  notify_by text not null default 'email' check (notify_by in ('email', 'whatsapp')),

  status text not null default 'pending'
    check (status in ('pending', 'ready', 'sent', 'failed')),

  created_at timestamptz not null default now(),
  ready_at timestamptz,
  notified_at timestamptz,

  -- Whatever channel is chosen, there has to be somewhere to send it.
  constraint stock_notifications_has_contact
    check (email is not null or phone is not null)
);

create index if not exists stock_notifications_item_idx
  on public.stock_notifications (item_id);
create index if not exists stock_notifications_status_idx
  on public.stock_notifications (status, ready_at);

-- One live request per person per product. Someone who clicks "notify me" three
-- times wants one message, not three — and without this, a restock would send
-- all three at once.
create unique index if not exists stock_notifications_one_open_email
  on public.stock_notifications (item_id, lower(email))
  where email is not null and status in ('pending', 'ready');

create unique index if not exists stock_notifications_one_open_phone
  on public.stock_notifications (item_id, phone)
  where phone is not null and status in ('pending', 'ready');

-- ------------------------------------------------------------
-- RLS: write-only to the public, like the newsletter (005).
-- A read policy would turn this into "list everyone waiting on this product,
-- with their email addresses".
-- ------------------------------------------------------------
alter table public.stock_notifications enable row level security;

drop policy if exists "staff read stock notifications" on public.stock_notifications;
create policy "staff read stock notifications" on public.stock_notifications
  for select using (public.is_staff());

drop policy if exists "staff manage stock notifications" on public.stock_notifications;
create policy "staff manage stock notifications" on public.stock_notifications
  for all using (public.is_staff()) with check (public.is_staff());

-- No public insert policy: requests go through the function below, which checks
-- the product is real, active, and actually out of stock. "You may only ask to
-- be told about a product that exists and isn't already available" is a
-- computation, not a row predicate — the same reason orders (010) and refunds
-- (016) have none.

-- ------------------------------------------------------------
-- Ask to be told.
-- ------------------------------------------------------------
create or replace function public.request_stock_notification(
  p_item_id uuid,
  p_email text default null,
  p_phone text default null,
  p_notify_by text default 'email'
)
returns table (ok boolean, reason text)
language plpgsql security definer set search_path = public as $$
declare
  v_item public.items%rowtype;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
begin
  select * into v_item from public.items where id = p_item_id;

  if not found or not v_item.is_active then
    return query select false, 'Product not found.'; return;
  end if;

  -- Nothing to wait for. Telling them so beats silently queueing a message that
  -- will never arrive because the trigger below only fires on a TRANSITION.
  if v_item.allow_backorder or v_item.stock is null or v_item.stock > 0 then
    return query select false, 'This product is already available.'; return;
  end if;

  if v_email is null and v_phone is null then
    return query select false, 'We need an email address to reach you.'; return;
  end if;

  if v_email is not null and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    return query select false, 'Enter a valid email address.'; return;
  end if;

  insert into public.stock_notifications (item_id, user_id, email, phone, notify_by)
  values (p_item_id, auth.uid(), v_email, v_phone,
          case when p_notify_by = 'whatsapp' then 'whatsapp' else 'email' end);

  return query select true, null::text;
exception
  -- Already on the list. That's what they wanted; saying "error" would just make
  -- them click again.
  when unique_violation then
    return query select true, null::text;
end;
$$;

revoke all on function public.request_stock_notification(uuid, text, text, text) from public;
grant execute on function public.request_stock_notification(uuid, text, text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- The trigger: flip pending → ready the moment stock actually arrives.
--
-- Only on the TRANSITION into "buyable". Firing on every stock write would
-- re-ready rows that have already been sent, and re-notify everyone each time a
-- bag moves.
-- ------------------------------------------------------------
create or replace function public.mark_stock_notifications_ready()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_was_out boolean;
  v_now_in boolean;
begin
  v_was_out := not coalesce(old.allow_backorder, false)
               and old.stock is not null and old.stock <= 0;

  v_now_in := coalesce(new.allow_backorder, false)
              or new.stock is null or new.stock > 0;

  if v_was_out and v_now_in then
    update public.stock_notifications
       set status = 'ready', ready_at = now()
     where item_id = new.id
       and status = 'pending';
  end if;

  return null;
end;
$$;

drop trigger if exists items_stock_notifications on public.items;
create trigger items_stock_notifications
  after update of stock, allow_backorder on public.items
  for each row execute function public.mark_stock_notifications_ready();

comment on table public.stock_notifications is
  'Back-in-stock waiting list. `notify_by` is channel-agnostic so a WhatsApp sender can be added without a migration — but the UI only offers channels that can actually deliver. Rows are marked ready by a trigger on items (every stock write is seen), and sent out-of-band (a mail provider must never fail a stock update).';
