-- ============================================================
-- 026_lock_service_functions.sql
--
-- 🚨 SECURITY — make "service role only" functions actually service-role
-- only, on every Supabase project, whatever its default privileges.
--
-- Four functions have NO permission check inside them; the only thing that
-- stops a shopper calling them through the public API is EXECUTE privilege:
--
--   mark_order_paid(reference)      marks an order paid + takes stock (001/004)
--   apply_refund_result(...)        records a refund as done (016)
--   refresh_best_sellers()          rebuilds the best-seller table (015)
--   check_rate_limit(...)           the rate limiter's counter (019)
--
-- Their migrations did `revoke all ... from public` then granted the service
-- role. That's enough on a database where nobody else was granted EXECUTE —
-- but Supabase projects created with the older defaults also grant EXECUTE
-- on every new function DIRECTLY to anon and authenticated
-- (`alter default privileges ... grant all on functions to anon, ...`).
-- A direct grant is not removed by revoking from PUBLIC. On such a project,
-- anyone holding the public anon key could call
--
--   POST /rest/v1/rpc/mark_order_paid  {"p_reference": "<their own order's ref>"}
--
-- and get an unpaid order marked paid, skipping Paystack entirely.
--
-- FIX: revoke from anon and authenticated BY NAME. Every caller in the app
-- uses the service role (createAdminClient): the Paystack verify/webhook path,
-- the refund webhook, the best-sellers refresh and the rate limiter, so
-- nothing legitimate loses access.
--
-- Check a project with:
--   select proname, has_function_privilege('anon', oid, 'execute') as anon_can_run
--     from pg_proc where proname in ('mark_order_paid','apply_refund_result',
--                                    'refresh_best_sellers','check_rate_limit');
-- Every row should say false after this runs.
--
-- Idempotent; safe to re-run.
-- ============================================================

revoke all on function public.mark_order_paid(text) from public, anon, authenticated;
grant execute on function public.mark_order_paid(text) to service_role;

revoke all on function public.apply_refund_result(text, boolean, numeric) from public, anon, authenticated;
grant execute on function public.apply_refund_result(text, boolean, numeric) to service_role;

revoke all on function public.refresh_best_sellers() from public, anon, authenticated;
grant execute on function public.refresh_best_sellers() to service_role;

revoke all on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
