-- ============================================================
-- VetNeeds — newsletter subscribers + contact messages
--
-- Both forms previously showed a success message and threw the data away.
-- These tables are WRITE-ONLY to the public: anyone may insert (that's the
-- point of a signup form), nobody may read. Staff read them in the admin.
--
-- Run AFTER 000-004. Idempotent.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Newsletter subscribers
-- ------------------------------------------------------------
create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'footer',   -- where they signed up
  is_active boolean not null default true, -- false = unsubscribed
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

-- One row per address, case-insensitively. Re-subscribing reactivates the
-- existing row rather than creating a duplicate.
create unique index if not exists subscribers_email_key
  on public.subscribers (lower(email));
create index if not exists subscribers_active_idx
  on public.subscribers (is_active) where is_active;

-- ------------------------------------------------------------
-- 2. Contact messages
-- ------------------------------------------------------------
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  email text not null,
  phone text,
  subject text not null default 'general',
  message text not null,
  status text not null default 'new'
    check (status in ('new', 'read', 'replied', 'closed')),
  admin_notes text,
  user_id uuid references auth.users (id) on delete set null, -- if signed in
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_messages_status_idx
  on public.contact_messages (status, created_at desc);

drop trigger if exists contact_messages_set_updated_at on public.contact_messages;
create trigger contact_messages_set_updated_at
  before update on public.contact_messages
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 3. RLS — public may WRITE, only staff may READ
--    (a public read policy would leak every customer's email address)
-- ------------------------------------------------------------
alter table public.subscribers enable row level security;
alter table public.contact_messages enable row level security;

drop policy if exists "anyone can subscribe" on public.subscribers;
create policy "anyone can subscribe" on public.subscribers
  for insert with check (true);

drop policy if exists "staff read subscribers" on public.subscribers;
create policy "staff read subscribers" on public.subscribers
  for select using (public.is_staff());

drop policy if exists "staff manage subscribers" on public.subscribers;
create policy "staff manage subscribers" on public.subscribers
  for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists "anyone can contact" on public.contact_messages;
create policy "anyone can contact" on public.contact_messages
  for insert with check (true);

drop policy if exists "staff read messages" on public.contact_messages;
create policy "staff read messages" on public.contact_messages
  for select using (public.is_staff());

drop policy if exists "staff manage messages" on public.contact_messages;
create policy "staff manage messages" on public.contact_messages
  for update using (public.is_staff()) with check (public.is_staff());

-- ------------------------------------------------------------
-- 4. Subscribe helper — insert-or-reactivate without leaking whether an
--    address already exists. SECURITY DEFINER because the caller has no
--    read access to check for a duplicate first.
-- ------------------------------------------------------------
create or replace function public.subscribe_email(
  p_email text,
  p_source text default 'footer',
  p_user uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscribers (email, source, user_id)
  values (lower(trim(p_email)), coalesce(p_source, 'footer'), p_user)
  on conflict (lower(email)) do update
    set is_active = true,
        unsubscribed_at = null,
        user_id = coalesce(public.subscribers.user_id, excluded.user_id);
end;
$$;

revoke all on function public.subscribe_email(text, text, uuid) from public;
grant execute on function public.subscribe_email(text, text, uuid)
  to anon, authenticated, service_role;
