-- 064: RPC pour récupérer les events médicaux liés à des inscriptions sans session_date
-- PostgREST ne supporte pas .is() sur les colonnes jointes → RPC nécessaire
-- Utilisé par le cron RGPD purge (Chemin 3)

CREATE OR REPLACE FUNCTION gd_get_medical_events_null_session_date(threshold TIMESTAMPTZ)
RETURNS TABLE(id UUID) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT me.id
  FROM gd_medical_events me
  INNER JOIN gd_inscriptions i ON i.id = me.inscription_id
  WHERE i.session_date IS NULL
    AND me.created_at < threshold;
$$;
