-- 051_fix_audit_log_policies.sql
-- Fix CR3+H11 : corriger les policies gd_audit_log
-- Probleme : migration 035 creait USING(true) pour tous, migration 041 corrigeait
-- mais la policy insert_only WITH CHECK(true) permet insertion anon
--
-- Ce script est idempotent : il supprime et recree les policies correctes

-- Supprimer toutes les policies existantes
DROP POLICY IF EXISTS "insert_only" ON gd_audit_log;
DROP POLICY IF EXISTS "no_update" ON gd_audit_log;
DROP POLICY IF EXISTS "no_delete" ON gd_audit_log;
DROP POLICY IF EXISTS "admin_read_only" ON gd_audit_log;
DROP POLICY IF EXISTS "audit_log_policy" ON gd_audit_log;

-- S'assurer que RLS est active
ALTER TABLE gd_audit_log ENABLE ROW LEVEL SECURITY;

-- Nouvelles policies :
-- 1. Lecture : authentified uniquement (admin via API, pas anon)
CREATE POLICY "authenticated_read" ON gd_audit_log
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. Insertion : authentified uniquement (pas anon)
CREATE POLICY "authenticated_insert" ON gd_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. Pas de UPDATE ni DELETE (tamper-proof)
-- Aucune policy = bloque par defaut (RLS active)
