-- ============================================================
-- 018_unsubscribe.sql
-- Makes "unsubscribe" possible.
--
-- 005 gave subscribers `is_active` and `unsubscribed_at` and RLS that
-- lets ONLY staff update them. So there was no way for a subscriber to
-- actually leave — the columns described a capability that didn't exist.
-- Sending marketing with no working unsubscribe isn't just rude, it's
-- the thing that gets a sending domain blocklisted.
--
-- WHY A TOKEN, not just the email: an unsubscribe link is followed by
-- mail clients, prefetchers and anyone who receives a forwarded email.
-- `/unsubscribe?email=x@y.com` lets anyone unsubscribe anyone by typing
-- an address. The token proves the request came from that inbox's mail.
--
-- Idempotent; safe to re-run.
-- ============================================================

alter table public.subscribers
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists subscribers_unsubscribe_token_idx
  on public.subscribers (unsubscribe_token);

-- ------------------------------------------------------------
-- Leave the list. Anonymous by necessity: the whole point is that it works
-- from an email, with no account and no session.
--
-- Returns the same answer for a bad token as for a good one — an unsubscribe
-- endpoint that says "not found" is an oracle for which addresses are on the
-- list. There is nothing useful to tell the caller anyway: either way, they
-- are not subscribed.
-- ------------------------------------------------------------
create or replace function public.unsubscribe(p_token uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_token is null then
    return;
  end if;

  update public.subscribers
     set is_active = false,
         unsubscribed_at = now()
   where unsubscribe_token = p_token
     and is_active;
end;
$$;

revoke all on function public.unsubscribe(uuid) from public;
grant execute on function public.unsubscribe(uuid) to anon, authenticated;

comment on column public.subscribers.unsubscribe_token is
  'Capability for the unsubscribe link. Exists because RLS lets only staff update subscribers — without it a subscriber could not leave the list. Never expose it in a list view.';
