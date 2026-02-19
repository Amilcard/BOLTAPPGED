-- ============================================
-- MIGRATION 010: Foreign Key Constraints (NOT VALID)
-- Date: 2026-02-16
-- Mode: ECONOMY_SECURE_NO_REGRESSION
-- ============================================
--
-- CONTEXTE:
--   Tables Supabase gd_* n'ont AUCUNE FK.
--   Intégrité référentielle repose entièrement sur le code applicatif.
--   Cette migration ajoute des FK en mode NOT VALID pour:
--   1. Empêcher les futures insertions orphelines
--   2. Ne PAS scanner les données existantes (pas de lock)
--   3. Permettre un VALIDATE ultérieur après nettoyage
--
-- MODÈLE DE SESSION RÉEL:
--   gd_stay_sessions: clé naturelle = (stay_slug, start_date, end_date)
--   n8n upsert conflit sur: stay_slug, start_date, end_date
--   Prisma unique: @@unique([stayId, startDate, endDate])
--   → Une composite FK inscription→session est IMPOSSIBLE
--     car gd_inscriptions ne stocke que session_date (=start_date), pas end_date.
--
-- ============================================

-- ============================================
-- RISK ASSESSMENT
-- ============================================
--
-- FK 1-3 (slug→slug): RISQUE FAIBLE
--   - Relation 1:N classique
--   - n8n upsert insère toujours le stay avant les sessions/prix
--   - Le booking flow passe toujours par un séjour existant
--   - NOT VALID = pas de scan des données existantes
--
-- FK 4 (composite inscription→session): RISQUE ÉLEVÉ → ABANDONNÉE
--   Raison: Le modèle réel de session utilise 3 colonnes (stay_slug, start_date, end_date).
--   gd_inscriptions ne stocke que sejour_slug + session_date (=start_date).
--   Sans end_date dans gd_inscriptions, la FK composite ne peut PAS référencer
--   la clé naturelle complète de gd_stay_sessions.
--   Forcer UNIQUE(stay_slug, start_date) serait FAUX car un même séjour peut avoir
--   des sessions commençant le même jour avec des durées différentes.
--
--   ALTERNATIVES ÉVALUÉES:
--   a) Ajouter end_date à gd_inscriptions → modif DB, hors scope
--   b) Ajouter session_id (UUID) à gd_inscriptions → meilleur design, mais refactor
--   c) CHECK constraint applicatif via trigger → complexité, maintenance
--   d) Vue monitoring v_orphaned_records → RETENU (monitoring sans contrainte dure)
--
--   RECOMMANDATION: Option (b) en V2 — ajouter gd_inscriptions.session_id
--   qui référence gd_stay_sessions.id directement. FK simple, propre, sans ambiguïté.
--
-- ============================================

-- ============================================
-- PRE-REQUIS: gd_stays.slug UNIQUE
-- ============================================
-- Vérification: SELECT slug, count(*) FROM gd_stays GROUP BY slug HAVING count(*) > 1;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'gd_stays'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) LIKE '%slug%'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'gd_stays' AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%slug%'
  ) THEN
    RAISE NOTICE 'Ajout contrainte UNIQUE sur gd_stays.slug...';
    ALTER TABLE gd_stays ADD CONSTRAINT uq_gd_stays_slug UNIQUE (slug);
  END IF;
END $$;

-- ============================================
-- FK 1: gd_stay_sessions.stay_slug → gd_stays.slug
-- Risque: FAIBLE
-- n8n insère toujours le stay (HTTP__UPSERT_GD_STAYS) avant les sessions
-- ============================================
ALTER TABLE gd_stay_sessions
  ADD CONSTRAINT fk_stay_sessions_stay
  FOREIGN KEY (stay_slug) REFERENCES gd_stays(slug)
  NOT VALID;

-- ============================================
-- FK 2: gd_session_prices.stay_slug → gd_stays.slug
-- Risque: FAIBLE
-- Même logique que FK 1, prix toujours liés à un stay existant
-- ============================================
ALTER TABLE gd_session_prices
  ADD CONSTRAINT fk_session_prices_stay
  FOREIGN KEY (stay_slug) REFERENCES gd_stays(slug)
  NOT VALID;

-- ============================================
-- FK 3: gd_inscriptions.sejour_slug → gd_stays.slug
-- Risque: FAIBLE
-- Le booking flow passe toujours par /sejour/[slug]/reserver
-- ============================================
ALTER TABLE gd_inscriptions
  ADD CONSTRAINT fk_inscriptions_stay
  FOREIGN KEY (sejour_slug) REFERENCES gd_stays(slug)
  NOT VALID;

-- ============================================
-- FK 4: COMPOSITE inscription→session
-- STATUT: NON IMPLÉMENTÉE (voir RISK ASSESSMENT)
-- La clé naturelle session = (stay_slug, start_date, end_date)
-- gd_inscriptions n'a que (sejour_slug, session_date) → manque end_date
-- → FK composite impossible sans modification du schéma
-- → Monitoring via v_orphaned_records en attendant V2 (session_id)
-- ============================================

-- ============================================
-- VUE: Détection des orphelins (monitoring continu)
-- ============================================
CREATE OR REPLACE VIEW v_orphaned_records AS

-- Inscriptions sans séjour correspondant
SELECT 'inscription_sans_sejour' AS type,
       i.id::text AS record_id,
       i.sejour_slug AS ref_value,
       i.created_at
FROM gd_inscriptions i
LEFT JOIN gd_stays s ON i.sejour_slug = s.slug
WHERE s.slug IS NULL

UNION ALL

-- Sessions sans séjour correspondant
SELECT 'session_sans_sejour' AS type,
       ss.id::text AS record_id,
       ss.stay_slug AS ref_value,
       ss.created_at
FROM gd_stay_sessions ss
LEFT JOIN gd_stays s ON ss.stay_slug = s.slug
WHERE s.slug IS NULL

UNION ALL

-- Prix sans séjour correspondant
SELECT 'prix_sans_sejour' AS type,
       sp.id::text AS record_id,
       sp.stay_slug AS ref_value,
       sp.created_at
FROM gd_session_prices sp
LEFT JOIN gd_stays s ON sp.stay_slug = s.slug
WHERE s.slug IS NULL

UNION ALL

-- Inscriptions dont la session_date ne matche aucune session du séjour
SELECT 'inscription_session_orpheline' AS type,
       i.id::text AS record_id,
       i.sejour_slug || ' @ ' || i.session_date AS ref_value,
       i.created_at
FROM gd_inscriptions i
LEFT JOIN gd_stay_sessions ss
  ON i.sejour_slug = ss.stay_slug
  AND i.session_date::date = ss.start_date::date
WHERE ss.id IS NULL
  AND i.session_date IS NOT NULL;

COMMENT ON VIEW v_orphaned_records IS
  'Monitoring des enregistrements orphelins. Exécuter SELECT * FROM v_orphaned_records régulièrement.';

-- ============================================
-- INDEX pour performances FK + monitoring
-- ============================================
CREATE INDEX IF NOT EXISTS idx_gd_stay_sessions_stay_slug ON gd_stay_sessions(stay_slug);
CREATE INDEX IF NOT EXISTS idx_gd_session_prices_stay_slug ON gd_session_prices(stay_slug);
CREATE INDEX IF NOT EXISTS idx_gd_inscriptions_sejour_slug ON gd_inscriptions(sejour_slug);
CREATE INDEX IF NOT EXISTS idx_gd_inscriptions_session_date ON gd_inscriptions(session_date);

-- ============================================
-- VALIDATION ULTÉRIEURE
-- Exécuter UNIQUEMENT après vérification: SELECT * FROM v_orphaned_records;
-- Si 0 résultats → safe to validate
-- ============================================
-- ALTER TABLE gd_stay_sessions VALIDATE CONSTRAINT fk_stay_sessions_stay;
-- ALTER TABLE gd_session_prices VALIDATE CONSTRAINT fk_session_prices_stay;
-- ALTER TABLE gd_inscriptions VALIDATE CONSTRAINT fk_inscriptions_stay;

-- ============================================
-- ÉVOLUTION V2 RECOMMANDÉE
-- ============================================
-- Ajouter gd_inscriptions.session_id (UUID) référençant gd_stay_sessions.id:
--
-- ALTER TABLE gd_inscriptions ADD COLUMN session_id UUID;
--
-- -- Backfill session_id depuis (sejour_slug, session_date)
-- UPDATE gd_inscriptions i
-- SET session_id = ss.id
-- FROM gd_stay_sessions ss
-- WHERE i.sejour_slug = ss.stay_slug
--   AND i.session_date::date = ss.start_date::date;
--
-- -- Puis ajouter la FK propre
-- ALTER TABLE gd_inscriptions
--   ADD CONSTRAINT fk_inscriptions_session
--   FOREIGN KEY (session_id) REFERENCES gd_stay_sessions(id);
--
-- -- Et mettre à jour le code: /api/inscriptions envoie session_id au lieu de session_date

-- ============================================
-- ROLLBACK
-- ============================================
-- ALTER TABLE gd_stay_sessions DROP CONSTRAINT IF EXISTS fk_stay_sessions_stay;
-- ALTER TABLE gd_session_prices DROP CONSTRAINT IF EXISTS fk_session_prices_stay;
-- ALTER TABLE gd_inscriptions DROP CONSTRAINT IF EXISTS fk_inscriptions_stay;
-- DROP VIEW IF EXISTS v_orphaned_records;
-- DROP INDEX IF EXISTS idx_gd_stay_sessions_stay_slug;
-- DROP INDEX IF EXISTS idx_gd_session_prices_stay_slug;
-- DROP INDEX IF EXISTS idx_gd_inscriptions_sejour_slug;
-- DROP INDEX IF EXISTS idx_gd_inscriptions_session_date;
