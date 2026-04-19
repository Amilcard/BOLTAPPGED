-- ROLLBACK 082 : recrée la policy legacy "Lecture publique" sur gd_stay_sessions.
-- À utiliser uniquement si régression constatée (aucune attendue — doublon pur).

CREATE POLICY "Lecture publique"
  ON public.gd_stay_sessions
  FOR SELECT
  TO public
  USING (true);
