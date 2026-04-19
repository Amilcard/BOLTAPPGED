-- ROLLBACK 081 : réinsère le stub Berlin Street Art avec valeurs strictes
-- gelées au moment de la migration 081 (2026-04-19).
--
-- Attention : champs non essentiels (programme, images, etc.) perdus. Pour
-- restauration complète, relancer le workflow n8n UFOVAL scrape sur
-- l'URL source.

INSERT INTO public.gd_stays (slug, title, source_url, published)
VALUES (
  'street-art-et-histoire',
  'Colonie UFOVAL : BERLIN Street Art et Hisoire',
  'https://ufoval.fol74.org/sejours-colonies-de-vacances-a-letranger/street-art-et-histoire',
  false
)
ON CONFLICT (slug) DO NOTHING;
