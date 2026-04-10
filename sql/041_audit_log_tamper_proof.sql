-- 041_audit_log_tamper_proof.sql
-- RGPD/CNIL — Journal d'audit inaltérable (tamper-proof)
--
-- La CNIL exige un journal d'audit dont les entrées ne peuvent être
-- ni modifiées ni supprimées. Le service_role peut insérer via RLS bypass,
-- mais aucun client (ni même admin) ne peut altérer les traces.

-- 1. Colonne hash d'intégrité
ALTER TABLE gd_audit_log ADD COLUMN IF NOT EXISTS integrity_hash TEXT;

-- 2. RLS append-only
-- (RLS déjà activé — vérifier et recréer les policies)

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "no_select" ON gd_audit_log;
DROP POLICY IF EXISTS "no_update" ON gd_audit_log;
DROP POLICY IF EXISTS "no_delete" ON gd_audit_log;
DROP POLICY IF EXISTS "insert_only" ON gd_audit_log;

-- Personne ne peut lire directement (service_role bypass RLS)
CREATE POLICY "no_select" ON gd_audit_log FOR SELECT USING (false);

-- Personne ne peut modifier
CREATE POLICY "no_update" ON gd_audit_log FOR UPDATE USING (false);

-- Personne ne peut supprimer
CREATE POLICY "no_delete" ON gd_audit_log FOR DELETE USING (false);

-- Insertion autorisée (service_role bypass RLS de toute façon)
CREATE POLICY "insert_only" ON gd_audit_log FOR INSERT WITH CHECK (true);

-- 3. Purge via fonction SECURITY DEFINER (la seule façon de supprimer)
-- Seule la fonction purge peut supprimer — pas d'accès direct
-- (déjà créée dans migration 040 : purge_old_audit_logs)
