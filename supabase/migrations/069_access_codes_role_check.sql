-- 2026-04-17 — CHECK constraint whitelist sur gd_structure_access_codes.role
-- Defense in depth : prévient toute insertion future de rôle non reconnu.

DO $$
DECLARE bad INT;
BEGIN
  SELECT COUNT(*) INTO bad FROM gd_structure_access_codes
    WHERE role NOT IN ('direction', 'cds', 'cds_delegated', 'secretariat', 'educateur');
  IF bad > 0 THEN RAISE EXCEPTION 'Rows with invalid role: %', bad; END IF;
END$$;

ALTER TABLE gd_structure_access_codes
  DROP CONSTRAINT IF EXISTS gd_structure_access_codes_role_check;

ALTER TABLE gd_structure_access_codes
  ADD CONSTRAINT gd_structure_access_codes_role_check
  CHECK (role IN ('direction', 'cds', 'cds_delegated', 'secretariat', 'educateur'));
