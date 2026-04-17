-- Migration 071 — gd_souhaits.kid_prenom NULLABLE
-- Contexte : commit 72ff90c a rendu kid_prenom optionnel côté formulaire kids
-- (fallback "Anonyme" côté éducateur). La DDL avait été appliquée directement
-- en Supabase sans migration committée, provoquant un schema cache PostgREST
-- stale qui rejetait les INSERT avec kid_prenom: null (500 sur /api/souhaits).
--
-- Ce fichier documente l'état réel de la prod et force le reload PostgREST.

ALTER TABLE gd_souhaits ALTER COLUMN kid_prenom DROP NOT NULL;

-- Forcer le reload du schema cache PostgREST (sinon les clients Supabase JS
-- continuent d'appliquer l'ancienne contrainte NOT NULL en cache).
NOTIFY pgrst, 'reload schema';

-- Vérification
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'gd_souhaits'
  AND column_name = 'kid_prenom';
-- Attendu : is_nullable = YES
