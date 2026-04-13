-- Migration 057 : RPC atomique pour rate limiting
-- Corrige H1 : race condition SELECT+UPDATE non atomique dans lib/rate-limit.ts
--
-- La fonction utilise INSERT ON CONFLICT DO UPDATE avec RETURNING
-- pour garantir l'atomicité en une seule opération SQL.
-- Plus de fenêtre entre le SELECT et l'UPDATE.

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_limit INT,
  p_window_minutes INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_window_start TIMESTAMPTZ;
BEGIN
  -- Atomic upsert : INSERT ou UPDATE en une seule opération
  INSERT INTO gd_login_attempts (ip, attempt_count, window_start)
  VALUES (p_key, 1, NOW())
  ON CONFLICT (ip) DO UPDATE SET
    attempt_count = CASE
      -- Fenêtre expirée → reset à 1
      WHEN gd_login_attempts.window_start < NOW() - (p_window_minutes || ' minutes')::INTERVAL
        THEN 1
      -- Fenêtre active → incrémenter
      ELSE gd_login_attempts.attempt_count + 1
    END,
    window_start = CASE
      -- Fenêtre expirée → nouvelle fenêtre
      WHEN gd_login_attempts.window_start < NOW() - (p_window_minutes || ' minutes')::INTERVAL
        THEN NOW()
      -- Fenêtre active → garder la fenêtre
      ELSE gd_login_attempts.window_start
    END
  RETURNING attempt_count INTO v_count;

  -- Retourne TRUE si rate limited (au-delà de la limite)
  RETURN v_count > p_limit;
END;
$$;

-- Autoriser l'appel via service_role uniquement
REVOKE ALL ON FUNCTION check_rate_limit FROM PUBLIC;
REVOKE ALL ON FUNCTION check_rate_limit FROM anon;
REVOKE ALL ON FUNCTION check_rate_limit FROM authenticated;
