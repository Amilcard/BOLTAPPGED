-- Migration 081 : supprime le séjour brouillon Berlin Street Art
--
-- Contexte : stub importé d'UFOVAL, jamais finalisé côté GED (marketing_title
-- NULL, centre_name NULL, published=false). Zéro dépendance FK vérifiée
-- (sessions=0, prices=0, themes=0, inscriptions=0, souhaits=0, waitlist=0,
-- propositions=0).
--
-- Décision produit user 2026-04-19 : DELETE. Ré-importation future possible
-- via workflow n8n UFOVAL si la destination Berlin est un jour commercialisée.
--
-- Rollback : ROLLBACK_081.sql réinsère la ligne avec valeurs strictes au
-- moment de la migration.

DELETE FROM public.gd_stays
WHERE slug = 'street-art-et-histoire'
  AND published = false
  AND marketing_title IS NULL;
