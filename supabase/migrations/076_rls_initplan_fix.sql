-- 2026-04-18 : fix advisor auth_rls_initplan (9 policies / 8 tables)
-- Wrapping auth.role() dans (select ...) pour evaluation InitPlan PostgreSQL.
-- Semantique IDENTIQUE, gain perf sur volume table.
-- Rollback : supabase/migrations/ROLLBACK_076.sql
-- Diagnostic architecte vague 3 W7.

BEGIN;

-- gd_processed_events
DROP POLICY IF EXISTS "Service role only" ON public.gd_processed_events;
CREATE POLICY "Service role only" ON public.gd_processed_events
  FOR ALL TO public
  USING ((select auth.role()) = 'service_role'::text);

-- gd_inscription_status_logs : SUPPRIMER policy redondante TO public
-- (Service role full access on status_logs TO service_role USING(true) reste en place)
DROP POLICY IF EXISTS "Service role only" ON public.gd_inscription_status_logs;

-- gd_waitlist
DROP POLICY IF EXISTS "service_role_only" ON public.gd_waitlist;
CREATE POLICY "service_role_only" ON public.gd_waitlist
  FOR ALL TO public
  USING ((select auth.role()) = 'service_role'::text);

-- gd_souhaits
DROP POLICY IF EXISTS "service_role_all" ON public.gd_souhaits;
CREATE POLICY "service_role_all" ON public.gd_souhaits
  FOR ALL TO public
  USING ((select auth.role()) = 'service_role'::text)
  WITH CHECK ((select auth.role()) = 'service_role'::text);

-- gd_structures
DROP POLICY IF EXISTS "service_role_all" ON public.gd_structures;
CREATE POLICY "service_role_all" ON public.gd_structures
  FOR ALL TO public
  USING ((select auth.role()) = 'service_role'::text)
  WITH CHECK ((select auth.role()) = 'service_role'::text);

-- gd_login_attempts
DROP POLICY IF EXISTS "service_role_only" ON public.gd_login_attempts;
CREATE POLICY "service_role_only" ON public.gd_login_attempts
  FOR ALL TO public
  USING ((select auth.role()) = 'service_role'::text);

-- gd_wishes
DROP POLICY IF EXISTS "service_role_only" ON public.gd_wishes;
CREATE POLICY "service_role_only" ON public.gd_wishes
  FOR ALL TO public
  USING ((select auth.role()) = 'service_role'::text)
  WITH CHECK ((select auth.role()) = 'service_role'::text);

-- import_logs
DROP POLICY IF EXISTS "service_role_only" ON public.import_logs;
CREATE POLICY "service_role_only" ON public.import_logs
  FOR ALL TO public
  USING ((select auth.role()) = 'service_role'::text)
  WITH CHECK ((select auth.role()) = 'service_role'::text);

COMMIT;
