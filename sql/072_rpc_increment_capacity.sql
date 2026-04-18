-- Migration 072 — RPC gd_increment_capacity (compensating action)
-- Inverse atomique de gd_check_and_decrement_capacity (migration 065).
-- Utilisé par app/api/inscriptions/route.ts pour restaurer le seat en cas
-- d'échec de l'INSERT inscription post-décrémentation.
--
-- Sémantique :
-- - Si session n'existe pas ou seats_left = -1/NULL (illimité) → no-op
-- - Sinon → seats_left += 1 (pas de borne max : la RPC decrement est la source de vérité)

CREATE OR REPLACE FUNCTION gd_increment_capacity(
  p_slug TEXT,
  p_start_date TEXT
) RETURNS JSONB AS $$
DECLARE
  v_session gd_stay_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session
  FROM gd_stay_sessions
  WHERE stay_slug = p_slug
    AND start_date::date = p_start_date::date
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('restored', false, 'reason', 'no_session');
  END IF;

  -- Session illimitée → pas de compteur à restaurer
  IF v_session.seats_left = -1 OR v_session.seats_left IS NULL THEN
    RETURN jsonb_build_object('restored', false, 'reason', 'unlimited');
  END IF;

  UPDATE gd_stay_sessions
  SET seats_left = seats_left + 1
  WHERE stay_slug = p_slug
    AND start_date::date = p_start_date::date;

  RETURN jsonb_build_object(
    'restored', true,
    'seats_left', v_session.seats_left + 1
  );

EXCEPTION
  WHEN lock_not_available THEN
    -- Retry silencieux laissé au caller (log côté applicatif)
    RETURN jsonb_build_object('restored', false, 'reason', 'lock_not_available');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
