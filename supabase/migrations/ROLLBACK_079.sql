-- ROLLBACK 079 : restaure location_city='annecy' sur les 17 séjours
-- concernés par la migration 079 (si régression détectée).
--
-- Liste gelée au moment de la migration — cf docs/BACKLOG_AUDIT.md pour le mapping réel.

UPDATE public.gd_stays
SET location_city = 'annecy'
WHERE marketing_title IN (
  'ALPINE TREK JUNIOR', 'ALPOO KIDS', 'AZUR DIVE & JET', 'BABY RIDERS',
  'BLUE EXPERIENCE', 'BRETAGNE OCEAN RIDE', 'CORSICA WILD TRIP',
  'DUNE OCEAN KIDS', 'GAMING HOUSE 1850', 'GRAVITY BIKE PARK',
  'HUSKY ADVENTURE', 'INTO THE WILD', 'MX RIDER ACADEMY', 'PARKOUR',
  'SURVIVOR CAMP 74', 'WEST COAST SURF CAMP', 'WILDLIFE REPORTER'
) AND location_city IS NULL;
