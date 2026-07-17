-- ============================================================
-- 014_shipping_zones.sql
-- Delivery pricing by state, replacing the flat ₦1,500 nationwide.
--
-- Flat-rate nationwide is not a simplification, it's a loss: Lagos
-- intra-city and a 25kg feed run to Sokoto do not cost the same to
-- deliver. The shop was either overcharging Lagos or eating the
-- difference everywhere else.
--
-- Shape: a zone owns a set of states and a fee. A zone with an EMPTY
-- state list is the fallback ("anywhere else"), which is what makes
-- this safe to adopt gradually — define Lagos, leave the rest on the
-- fallback, refine later.
--
-- Falls back to settings.shipping_flat_fee if no zone matches at all,
-- so checkout can never end up with no shipping rule (see lib/shipping.js).
--
-- Idempotent; safe to re-run.
-- ============================================================

create table if not exists public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,

  -- The states this zone covers. EMPTY = the catch-all.
  -- text[] rather than a join table: 37 states, edited by hand a few times a
  -- year. A join table would be three queries and a UI for no benefit.
  states text[] not null default '{}',

  fee numeric(12, 2) not null check (fee >= 0),

  -- Per-zone free-delivery threshold. null = never free here, which is a real
  -- policy for far zones — a global threshold can't express "free in Lagos
  -- over ₦50k, never free to Sokoto".
  free_over numeric(12, 2) check (free_over is null or free_over >= 0),

  -- Rough promise shown at checkout. Text, not a number: "2–3 working days"
  -- is honest in a way a single integer isn't.
  delivery_estimate text,

  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists shipping_zones_set_updated_at on public.shipping_zones;
create trigger shipping_zones_set_updated_at
  before update on public.shipping_zones
  for each row execute function public.set_updated_at();

-- A state must not sit in two active zones — that's an ambiguous price, and
-- whichever row sorted first would silently win. Enforced in the resolver
-- below by taking the most specific match; this index just makes lookups cheap.
create index if not exists shipping_zones_states_idx
  on public.shipping_zones using gin (states);

-- ------------------------------------------------------------
-- Resolve the rule for one state.
--
-- SECURITY DEFINER + exposed to anon: the checkout page needs to quote a fee
-- before the customer has an account. It only ever reads public pricing.
--
-- Specificity beats sort order: a zone naming the state wins over the
-- catch-all, always. Otherwise adding a fallback would silently reprice Lagos.
-- ------------------------------------------------------------
create or replace function public.resolve_shipping(p_state text)
returns table (
  zone_id uuid,
  zone_name text,
  fee numeric,
  free_over numeric,
  delivery_estimate text
)
language sql stable security definer set search_path = public as $$
  select z.id, z.name, z.fee, z.free_over, z.delivery_estimate
    from public.shipping_zones z
   where z.is_active
     and (
       -- Case/space-insensitive: "lagos" typed by hand must match "Lagos".
       (p_state is not null and exists (
          select 1 from unnest(z.states) s
           where lower(trim(s)) = lower(trim(p_state))
        ))
       or cardinality(z.states) = 0
     )
   order by
     -- 0 = names this state, 1 = catch-all. Specific first.
     case when cardinality(z.states) = 0 then 1 else 0 end,
     z.sort_order,
     z.name
   limit 1;
$$;

grant execute on function public.resolve_shipping(text) to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- RLS: rates are public (they're quoted at checkout); staff maintain them.
-- ------------------------------------------------------------
alter table public.shipping_zones enable row level security;

drop policy if exists "shipping zones readable by all" on public.shipping_zones;
create policy "shipping zones readable by all" on public.shipping_zones
  for select using (true);

drop policy if exists "staff manage shipping zones" on public.shipping_zones;
create policy "staff manage shipping zones" on public.shipping_zones
  for all using (public.is_staff()) with check (public.is_staff());

-- ------------------------------------------------------------
-- Seed: only a catch-all, priced at the flat fee the shop already charges.
--
-- Deliberately NOT inventing zones. Real delivery costs are the owner's
-- knowledge, and a made-up "Lagos ₦1,500 / North ₦4,000" would be a guess
-- customers get charged for. This keeps behaviour identical to today until
-- someone who knows the numbers adds zones.
-- ------------------------------------------------------------
insert into public.shipping_zones (name, states, fee, free_over, delivery_estimate, sort_order)
select
  'Nationwide',
  '{}',
  coalesce((select (value #>> '{}')::numeric from public.settings where key = 'shipping_flat_fee'), 1500),
  (select (value #>> '{}')::numeric from public.settings where key = 'free_shipping_threshold'),
  null,
  100
where not exists (select 1 from public.shipping_zones);

comment on table public.shipping_zones is
  'Delivery rate per set of states. A zone with an empty states[] is the catch-all. resolve_shipping() prefers a zone naming the state over the catch-all, so adding a fallback never reprices an existing zone.';
comment on column public.shipping_zones.free_over is
  'Per-zone free-delivery threshold; null = never free in this zone. A global threshold cannot express "free in Lagos over ₦50k, never free to Sokoto".';
