-- 077_souhaits_nom_groupe.sql
-- Ajout colonne optionnelle `nom_groupe` sur gd_souhaits
-- Contexte : retour testeuse Thanh P4.2 — l'éducateur identifie le jeune via
-- prénom + structure d'origine. Le prénom (kid_prenom) existe déjà ; on ajoute
-- le nom du groupe (MECS, foyer, classe…) en optionnel côté kid.
-- RGPD : donnée identifiante indirecte, saisie volontaire, non indexée.

ALTER TABLE gd_souhaits
  ADD COLUMN IF NOT EXISTS nom_groupe TEXT NULL;

COMMENT ON COLUMN gd_souhaits.nom_groupe IS
  'Nom du foyer/structure/groupe du jeune (optionnel, saisi par kid dans /sejour/[id]/souhait)';

NOTIFY pgrst, 'reload schema';
