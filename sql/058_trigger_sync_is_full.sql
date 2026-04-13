-- Migration 058 : Trigger sync is_full entre gd_session_prices et gd_stay_sessions
-- Corrige H5 : is_full desync récurrent après chaque sync UFOVAL n8n
--
-- Quand gd_session_prices.is_full est mis à jour (par n8n ou manuellement),
-- le trigger propage automatiquement vers gd_stay_sessions.is_full
-- en utilisant le matching session_id.

CREATE OR REPLACE FUNCTION sync_is_full_to_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Propagation seulement si is_full a changé
  IF NEW.is_full IS DISTINCT FROM OLD.is_full THEN
    UPDATE gd_stay_sessions
    SET is_full = NEW.is_full
    WHERE stay_slug = NEW.stay_slug
      AND start_date = NEW.start_date;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop si existe déjà (idempotent)
DROP TRIGGER IF EXISTS trg_sync_is_full ON gd_session_prices;

CREATE TRIGGER trg_sync_is_full
  AFTER UPDATE OF is_full ON gd_session_prices
  FOR EACH ROW
  EXECUTE FUNCTION sync_is_full_to_sessions();

-- Sync initial : corriger l'état actuel
UPDATE gd_stay_sessions ss
SET is_full = sp.is_full
FROM gd_session_prices sp
WHERE sp.stay_slug = ss.stay_slug
  AND sp.start_date = ss.start_date
  AND sp.is_full IS DISTINCT FROM ss.is_full;
