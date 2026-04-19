-- Migration 079 : NULLify location_city erroné sur 17 séjours
--
-- Contexte : bug d'import historique — `location_city='annecy'` (lowercase)
-- propagé par défaut sur 17 séjours dont la destination réelle est ailleurs
-- (Corse, Var, Oléron, Plozévet, Savoie, etc.). Les 5 séjours `'Annecy'`
-- (capitalize) sont légitimes (La Métralière, Les Colombes, Les Puisots,
-- Internat de Poisy, Les Puisots → tous en Haute-Savoie).
--
-- Impact UI : nul. Le champ `geoLabel` n'est pas affiché dans StayDetail.
-- Le filtre search utilise `geography` qui priorise `location_region`.
--
-- Rollback : ROLLBACK_079.sql restaure les 17 valeurs 'annecy'.

UPDATE public.gd_stays
SET location_city = NULL
WHERE location_city = 'annecy';
