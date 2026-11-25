-- ============================================================
-- 035_popup_repeat.sql
-- How often a popup promotion comes back after someone closes it:
--   visit  every time the site is opened (each visit / refresh)
--   day    once a day (default)
--   week   once a week
-- It used to be fixed at 14 days, which read as "the popup doesn't work":
-- close it once while checking it, and it never came back in that browser.
-- Only the popup placement uses it. Safe to re-run.
-- ============================================================

alter table public.promotions
  add column if not exists popup_repeat text not null default 'day';

alter table public.promotions drop constraint if exists promotions_popup_repeat_check;
alter table public.promotions
  add constraint promotions_popup_repeat_check check (popup_repeat in ('visit', 'day', 'week'));

comment on column public.promotions.popup_repeat is
  'Popup only: after a shopper closes it, show it again every visit, once a day, or once a week.';
