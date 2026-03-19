-- Migration 022 : RPC atomique pour vérification capacité session
-- Remplace le SELECT non-atomique dans api/inscriptions/route.ts
-- À exécuter dans Supabase → SQL Editor

CREATE OR REPLACE FUNCTION gd_check_session_capacity(
  p_slug TEXT,
  p_start_date TEXT
) RETURNS JSONB AS $$
DECLARE
  v_session gd_stay_sessions%ROWTYPE;
BEGIN
  -- Verrou ligne : empêche deux requêtes concurrentes de lire la même valeur
  SELECT * INTO v_session
  FROM gd_stay_sessions
  WHERE stay_slug = p_slug
    AND start_date::date = p_start_date::date
  FOR UPDATE NOWAIT;

  -- Aucune session dans gd_stay_sessions → séjour sans suivi de places → autorisé
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'source', 'no_session');
  END IF;

  -- seats_left = -1 → places illimitées (source UFOVAL)
  IF v_session.seats_left = -1 OR v_session.seats_left IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'age_min', v_session.age_min,
      'age_max', v_session.age_max
    );
  END IF;

  -- Plus de places
  IF v_session.seats_left <= 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'SESSION_FULL');
  END IF;

  -- Places disponibles
  RETURN jsonb_build_object(
    'allowed', true,
    'seats_left', v_session.seats_left,
    'age_min', v_session.age_min,
    'age_max', v_session.age_max
  );

EXCEPTION
  WHEN lock_not_available THEN
    -- Verrou déjà pris par une requête concurrente → refuser pour sécurité
    RETURN jsonb_build_object('allowed', false, 'reason', 'SESSION_FULL');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vérification
SELECT gd_check_session_capacity('test-slug', '2026-07-01');
