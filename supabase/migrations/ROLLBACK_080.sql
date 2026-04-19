-- ROLLBACK 080 : restaure les 3 valeurs Title Case de ged_theme

UPDATE public.gd_stays SET ged_theme = 'Lac & Montagne'      WHERE ged_theme = 'LAC_MONTAGNE';
UPDATE public.gd_stays SET ged_theme = 'Mer & Surf'          WHERE ged_theme = 'MER_SURF';
UPDATE public.gd_stays SET ged_theme = 'Nature & Équitation' WHERE ged_theme = 'NATURE_EQUITATION';
