-- ============================================================
-- 007_reviews_integrity.sql
-- Makes the reviews table safe to build a UI on top of.
--
-- Three problems in 000 that only matter once reviews are real:
--
-- 1. SELF-APPROVAL HOLE. "users edit own reviews" is
--       for update using (auth.uid() = user_id)
--                  with check (auth.uid() = user_id)
--    with no column restriction — so an author can PATCH their own
--    row and set is_approved = true. Staff hide an abusive review;
--    the author un-hides it. That defeats the moderation queue
--    entirely, so it has to be closed BEFORE the queue exists.
--
-- 2. NO AUTHOR NAME. profiles is readable only by its owner or
--    staff (`auth.uid() = id or is_staff()`), so one customer cannot
--    read another's name. Reviews therefore cannot show who wrote
--    them by joining profiles. We snapshot the name onto the review
--    instead — which also keeps the review attributed to the name
--    used at the time of writing.
--
-- 3. VERIFIED PURCHASE MUST BE SERVER-COMPUTED. If it were a plain
--    column, the insert policy (which only checks user_id) would let
--    anyone mark their own review "Verified purchase".
--
-- All three are handled by one BEFORE trigger running SECURITY
-- DEFINER, so it can read profiles/orders without the caller having
-- rights to them. Idempotent; safe to re-run.
-- ============================================================

alter table public.reviews
  add column if not exists author_name text,
  add column if not exists is_verified_purchase boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

-- Moderation queue reads "newest pending first"; the storefront reads
-- approved-by-item. Both want an index.
create index if not exists reviews_approved_created_idx
  on public.reviews (is_approved, created_at desc);

-- ------------------------------------------------------------
-- The guard. Everything a client must not be trusted to set is
-- overwritten here on every insert/update.
-- ------------------------------------------------------------
create or replace function public.reviews_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Attribution: snapshot the display name. Falls back to null, which the
  -- UI renders as "PetDo customer" rather than an empty byline.
  new.author_name := nullif(trim(coalesce(
    (select full_name from public.profiles where id = new.user_id), '')), '');

  -- Verified purchase: did this user actually buy this item, in an order that
  -- got past payment? order_items is a jsonb array of objects carrying the
  -- item's uuid as "id" (see /api/checkout/create-order), so containment
  -- answers it directly. 'pending' is excluded — an unpaid order is not a
  -- purchase.
  new.is_verified_purchase := exists (
    select 1
      from public.orders o
     where o.user_id = new.user_id
       and o.status in ('paid', 'processing', 'shipped', 'delivered')
       and o.order_items @> jsonb_build_array(
             jsonb_build_object('id', new.item_id::text))
  );

  -- Moderation is staff-only. A customer's write can never change the
  -- approval state: new reviews land approved (post-moderation, matching the
  -- column default), and an edit keeps whatever staff last decided.
  if not public.is_staff() then
    if tg_op = 'INSERT' then
      new.is_approved := true;
    else
      new.is_approved := old.is_approved;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
    -- Reviews are not transferable, and the item cannot be swapped after the
    -- fact (that would move a 5-star review onto a different product).
    new.user_id := old.user_id;
    new.item_id := old.item_id;
    new.created_at := old.created_at;
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_guard_trigger on public.reviews;
create trigger reviews_guard_trigger
  before insert or update on public.reviews
  for each row execute function public.reviews_guard();

-- ------------------------------------------------------------
-- Backfill the new columns for any reviews that already exist.
-- The trigger only fires on write, so existing rows would otherwise
-- show no author and no verified badge forever.
-- ------------------------------------------------------------
update public.reviews r
   set author_name = nullif(trim(coalesce(p.full_name, '')), '')
  from public.profiles p
 where p.id = r.user_id
   and r.author_name is null;

update public.reviews r
   set is_verified_purchase = exists (
     select 1
       from public.orders o
      where o.user_id = r.user_id
        and o.status in ('paid', 'processing', 'shipped', 'delivered')
        and o.order_items @> jsonb_build_array(
              jsonb_build_object('id', r.item_id::text))
   )
 where r.is_verified_purchase = false;

comment on column public.reviews.is_verified_purchase is
  'Server-computed by reviews_guard(): true when the author has a paid+ order containing this item. Never trust a client-supplied value.';
comment on column public.reviews.author_name is
  'Display-name snapshot taken at write time. Exists because profiles is not readable across users, so the storefront cannot join it.';
