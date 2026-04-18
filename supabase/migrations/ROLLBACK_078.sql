-- ROLLBACK 078 : restaure la policy authenticated_read sur gd_audit_log
-- Usage : uniquement si régression détectée nécessitant un SELECT authenticated

CREATE POLICY "authenticated_read"
  ON public.gd_audit_log
  FOR SELECT
  TO authenticated
  USING (true);
