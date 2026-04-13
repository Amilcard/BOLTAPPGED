-- Migration 060 : RPC transactionnelle merge_structures
-- Remplace le fallback séquentiel non-atomique dans api/admin/structures/merge

CREATE OR REPLACE FUNCTION merge_structures(p_source_id UUID, p_target_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Rebase inscriptions
  UPDATE gd_inscriptions
  SET structure_id = p_target_id
  WHERE structure_id = p_source_id;

  -- 2. Rebase souhaits
  UPDATE gd_souhaits
  SET structure_id = p_target_id
  WHERE structure_id = p_source_id;

  -- 3. Rebase access codes
  UPDATE gd_structure_access_codes
  SET structure_id = p_target_id
  WHERE structure_id = p_source_id;

  -- 4. Supprimer la structure source
  DELETE FROM gd_structures
  WHERE id = p_source_id;
END;
$$;

-- Sécurité : uniquement appelable via service_role
REVOKE ALL ON FUNCTION merge_structures(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION merge_structures(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION merge_structures(UUID, UUID) FROM authenticated;
