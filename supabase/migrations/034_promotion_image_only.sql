-- ============================================================
-- 034_promotion_image_only.sql
-- 1. Picture-only promotions: a finished banner whose words are part of the
--    picture. The storefront shows just the picture, whole, linking to the
--    promotion's link — no title or button drawn over or beside it. The
--    title stays required: it names the promotion in the admin list and is
--    what screen readers read out for the picture.
-- 2. Top selling, rebuilt now. best_sellers (015) is a summary that was meant
--    to be refreshed on a schedule, and nothing ever refreshed it — so the
--    home page's Top selling stayed empty however many orders were paid.
--    From this release the app rebuilds it after every payment, refund and
--    order status change; this fills it for the orders already paid.
-- Safe to re-run.
-- ============================================================

alter table public.promotions
  add column if not exists image_only boolean not null default false;

comment on column public.promotions.image_only is
  'Show only the picture (its own words included), no title/subtitle/button. Title is still the alt text.';

refresh materialized view public.best_sellers;
