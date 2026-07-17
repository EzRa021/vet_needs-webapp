-- ============================================================
-- 019_rate_limits.sql
-- Rate limiting for the public write endpoints.
--
-- WHY IN THE DATABASE, not in memory: an in-memory counter is
-- per-instance and dies on every deploy. On serverless that means it
-- barely exists — each cold start gets a fresh, empty limiter, so the
-- limit is whatever the platform's scaling decides. A shared counter is
-- the only one that means anything.
--
-- Fixed window, not a sliding log: one row per (key, window) and a
-- single upsert per request. A sliding window needs a row per request
-- and a range scan to count — real cost for a shop this size, to defend
-- against burst-at-the-boundary, which for a contact form is not a
-- threat worth paying for.
--
-- ⚠️ NOT granted to anon/authenticated. The key is derived server-side
-- from the caller's IP; if a client could call this directly it could
-- burn through *someone else's* budget by passing their key — a
-- rate limiter you can use to lock other people out is worse than none.
-- Only the service role (i.e. our API routes) may call it.
--
-- Idempotent; safe to re-run.
-- ============================================================

create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

-- Cleanup scans by age.
create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;
-- No policies at all: nothing but the service role should ever see this table,
-- and the service role bypasses RLS. An empty policy set means everyone else
-- gets nothing, which is exactly right.

-- ------------------------------------------------------------
-- Returns TRUE when the call is allowed.
--
-- Counts first, then compares — so the increment happens even on a rejected
-- request. That's deliberate: hammering a limited endpoint should keep the
-- window pinned rather than let an attacker probe the boundary for free.
-- ------------------------------------------------------------
create or replace function public.check_rate_limit(
  p_key text,
  p_max int,
  p_window_seconds int
)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_start timestamptz;
  v_count integer;
begin
  if p_key is null or trim(p_key) = '' then
    -- No key means we can't attribute the request. Allow it rather than
    -- block everyone behind a proxy that strips headers — failing OPEN is the
    -- right call for a contact form; failing closed would break the shop.
    return true;
  end if;

  -- Truncate now() to the window: all callers in the same window share a row.
  v_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits (key, window_start, count)
  values (p_key, v_start, 1)
  on conflict (key, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into v_count;

  -- Opportunistic cleanup: ~1 request in 100 sweeps yesterday's rows. Cheaper
  -- than a cron for a table that's pure exhaust, and it can't grow unbounded
  -- while traffic exists.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_max;
end;
$$;

revoke all on function public.check_rate_limit(text, int, int) from public;
grant execute on function public.check_rate_limit(text, int, int) to service_role;

comment on table public.rate_limits is
  'Fixed-window counters for public endpoints. Service-role only — the key is the caller''s IP, derived server-side, so a client that could call check_rate_limit() directly could exhaust another visitor''s budget.';
