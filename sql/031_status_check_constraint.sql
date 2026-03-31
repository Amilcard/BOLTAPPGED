-- Migration 031 : Contrainte CHECK sur gd_inscriptions.status
-- Empêche toute valeur de statut invalide d'être écrite en base.
-- Les valeurs actuelles validées : en_attente, validee, refusee, annulee

ALTER TABLE gd_inscriptions
  ADD CONSTRAINT gd_inscriptions_status_check
  CHECK (status IN ('en_attente', 'validee', 'refusee', 'annulee'));

-- Vérification
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'gd_inscriptions'::regclass
  AND contype = 'c'
  AND conname = 'gd_inscriptions_status_check';
