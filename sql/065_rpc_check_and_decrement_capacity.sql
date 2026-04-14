-- 065: RPC atomique check + decrement capacity
-- Remplace gd_check_session_capacity pour le flux inscription
-- Le FOR UPDATE + UPDATE dans la même transaction garantit l'atomicité
-- seats_left = -1 ou NULL = illimité (source UFOVAL)

CREATE OR REPLACE FUNCTION gd_check_and_decrement_capacity(
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
    RETURN jsonb_build_object('allowed', true, 'source', 'no_session');
  END IF;

  IF v_session.seats_left = -1 OR v_session.seats_left IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'age_min', v_session.age_min,
      'age_max', v_session.age_max
    );
  END IF;

  IF v_session.seats_left <= 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'SESSION_FULL');
  END IF;

  -- Décrémentation atomique
  UPDATE gd_stay_sessions
  SET seats_left = seats_left - 1
  WHERE stay_slug = p_slug
    AND start_date::date = p_start_date::date;

  RETURN jsonb_build_object(
    'allowed', true,
    'seats_left', v_session.seats_left - 1,
    'age_min', v_session.age_min,
    'age_max', v_session.age_max
  );

EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'SESSION_FULL');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
