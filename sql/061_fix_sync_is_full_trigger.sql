-- Migration 061 : Fix trigger sync_is_full — ajouter end_date au filtre
-- Sans end_date, le trigger propageait is_full à toutes les sessions
-- partageant le même stay_slug + start_date (même si end_date différent)

CREATE OR REPLACE FUNCTION sync_is_full_to_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_full IS DISTINCT FROM OLD.is_full THEN
    UPDATE gd_stay_sessions
    SET is_full = NEW.is_full
    WHERE stay_slug  = NEW.stay_slug
      AND start_date = NEW.start_date
      AND end_date   = NEW.end_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_is_full ON gd_session_prices;
CREATE TRIGGER trg_sync_is_full
  AFTER UPDATE OF is_full ON gd_session_prices
  FOR EACH ROW EXECUTE FUNCTION sync_is_full_to_sessions();
