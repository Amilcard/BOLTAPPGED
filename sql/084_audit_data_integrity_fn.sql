-- ----------------------------------------------------------------------------
-- 084_audit_data_integrity_fn.sql — Fonction audit data intégrité GED
--
-- Retourne une table avec les checks critiques + counts.
-- Appelée par scripts/audit-data-integrity.ts (via supabase.rpc)
-- et utilisable dans Supabase dashboard SQL editor directement.
--
-- SECURITY DEFINER : tourne avec les droits du rôle owner.
-- Accès restreint à service_role (pas d'expo anon/authenticated).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION gd_audit_data_integrity()
RETURNS TABLE (
  check_name    TEXT,
  description   TEXT,
  severity      TEXT,
  count_value   INTEGER,
  passed        BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH results AS (
    SELECT 'stays_published_no_session'::TEXT AS n,
           'Séjours publiés sans aucune session'::TEXT AS d,
           'blocking'::TEXT AS s,
           (SELECT COUNT(*)::INTEGER FROM gd_stays st
              WHERE st.published=true
                AND NOT EXISTS (SELECT 1 FROM gd_stay_sessions WHERE stay_slug=st.slug)) AS c
    UNION ALL
    SELECT 'stays_published_no_image', 'Séjours publiés sans image (UX dégradée)', 'warning',
           (SELECT COUNT(*)::INTEGER FROM gd_stays
              WHERE published=true AND (images IS NULL OR jsonb_array_length(images)=0))
    UNION ALL
    SELECT 'sessions_invalid_range', 'Sessions avec end_date < start_date', 'blocking',
           (SELECT COUNT(*)::INTEGER FROM gd_stay_sessions WHERE end_date < start_date)
    UNION ALL
    SELECT 'sessions_orphan', 'Sessions référençant un stay_slug inexistant', 'blocking',
           (SELECT COUNT(*)::INTEGER FROM gd_stay_sessions
              WHERE stay_slug NOT IN (SELECT slug FROM gd_stays))
    UNION ALL
    SELECT 'sessions_published_no_price_anywhere',
           'Sessions publiées sans prix (ni gd_stay_sessions.price ni gd_session_prices)',
           'blocking',
           (SELECT COUNT(*)::INTEGER FROM (
              SELECT ss.stay_slug, ss.start_date
                FROM gd_stay_sessions ss
                JOIN gd_stays st ON st.slug = ss.stay_slug
                WHERE st.published=true AND (ss.price IS NULL OR ss.price <= 0)
                  AND NOT EXISTS (
                    SELECT 1 FROM gd_session_prices p
                    WHERE p.stay_slug = ss.stay_slug AND p.start_date = ss.start_date
                  )
           ) X)
    UNION ALL
    SELECT 'stays_age_invalid', 'Séjours avec age_min > age_max', 'blocking',
           (SELECT COUNT(*)::INTEGER FROM gd_stays
              WHERE age_min IS NOT NULL AND age_max IS NOT NULL AND age_min > age_max)
    UNION ALL
    SELECT 'structures_active_no_email', 'Structures actives sans email de contact', 'warning',
           (SELECT COUNT(*)::INTEGER FROM gd_structures
              WHERE status='active' AND (email IS NULL OR email=''))
    UNION ALL
    SELECT 'souhaits_orphan_stay', 'Souhaits pointant vers un séjour inexistant', 'warning',
           (SELECT COUNT(*)::INTEGER FROM gd_souhaits
              WHERE sejour_slug IS NOT NULL
                AND sejour_slug NOT IN (SELECT slug FROM gd_stays))
    UNION ALL
    SELECT 'inscriptions_stale_pending', 'Inscriptions en statut intermédiaire > 30 jours', 'info',
           (SELECT COUNT(*)::INTEGER FROM gd_inscriptions
              WHERE status IN ('draft','pending','awaiting_payment')
                AND created_at < NOW() - INTERVAL '30 days')
    UNION ALL
    SELECT 'audit_log_old_rows', 'gd_audit_log rows > 3 ans (purge RGPD à planifier)', 'info',
           (SELECT COUNT(*)::INTEGER FROM gd_audit_log WHERE created_at < NOW() - INTERVAL '3 years')
  )
  SELECT r.n, r.d, r.s, r.c,
    CASE
      WHEN r.s = 'blocking' THEN r.c = 0
      WHEN r.s = 'warning'  THEN r.c = 0
      WHEN r.s = 'info'     THEN TRUE  -- info = jamais fail
      ELSE r.c = 0
    END AS passed
  FROM results r;
END;
$$;

COMMENT ON FUNCTION gd_audit_data_integrity() IS
  'Audit intégrité data GED. Appelée par scripts/audit-data-integrity.ts. Voir docs/adr/2026-04-21-data-integrity-audit.md';

-- Restreindre l'accès à service_role (pas d'expo publique)
REVOKE ALL ON FUNCTION gd_audit_data_integrity() FROM PUBLIC;
REVOKE ALL ON FUNCTION gd_audit_data_integrity() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION gd_audit_data_integrity() TO service_role;

NOTIFY pgrst, 'reload schema';
