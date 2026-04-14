-- 067: RPC pour récupérer les events médicaux liés à des inscriptions avec session_date expirée
-- PostgREST ne supporte pas .lt() sur colonnes jointes → RPC nécessaire
-- Remplace Chemin 1 du cron RGPD purge (qui ne fonctionnait pas)

CREATE OR REPLACE FUNCTION gd_get_expired_linked_medical_events(threshold TIMESTAMPTZ)
RETURNS TABLE(id UUID) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $fn$
  SELECT me.id
  FROM gd_medical_events me
  INNER JOIN gd_inscriptions i ON i.id = me.inscription_id
  WHERE i.session_date IS NOT NULL
    AND i.session_date < threshold;
$fn$;
