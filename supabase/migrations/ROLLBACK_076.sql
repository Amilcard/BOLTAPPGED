-- ROLLBACK migration 076_rls_initplan_fix
-- Restaure auth.role() non-wrapped (pre-InitPlan pattern).
-- Inclut re-creation de gd_inscription_status_logs "Service role only" TO public.

BEGIN;

-- gd_processed_events
DROP POLICY IF EXISTS "Service role only" ON public.gd_processed_events;
CREATE POLICY "Service role only" ON public.gd_processed_events
  FOR ALL TO public
  USING (auth.role() = 'service_role'::text);

-- gd_inscription_status_logs : re-creer la policy redondante TO public
DROP POLICY IF EXISTS "Service role only" ON public.gd_inscription_status_logs;
CREATE POLICY "Service role only" ON public.gd_inscription_status_logs
  FOR ALL TO public
  USING (auth.role() = 'service_role'::text);

-- gd_waitlist
DROP POLICY IF EXISTS "service_role_only" ON public.gd_waitlist;
CREATE POLICY "service_role_only" ON public.gd_waitlist
  FOR ALL TO public
  USING (auth.role() = 'service_role'::text);

-- gd_souhaits
DROP POLICY IF EXISTS "service_role_all" ON public.gd_souhaits;
CREATE POLICY "service_role_all" ON public.gd_souhaits
  FOR ALL TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

-- gd_structures
DROP POLICY IF EXISTS "service_role_all" ON public.gd_structures;
CREATE POLICY "service_role_all" ON public.gd_structures
  FOR ALL TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

-- gd_login_attempts
DROP POLICY IF EXISTS "service_role_only" ON public.gd_login_attempts;
CREATE POLICY "service_role_only" ON public.gd_login_attempts
  FOR ALL TO public
  USING (auth.role() = 'service_role'::text);

-- gd_wishes
DROP POLICY IF EXISTS "service_role_only" ON public.gd_wishes;
CREATE POLICY "service_role_only" ON public.gd_wishes
  FOR ALL TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

-- import_logs
DROP POLICY IF EXISTS "service_role_only" ON public.import_logs;
CREATE POLICY "service_role_only" ON public.import_logs
  FOR ALL TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

COMMIT;
