---
trigger: always_on
---

# PROJECT CONTEXT — GED APP

## Objectif projet
Application web de gestion et consultation de séjours enfants (GED).
Intégrée au site vitrine Groupe & Découverte.

## Stack
- Next.js App Router
- Supabase = source de vérité unique
- React + components UI internes

## Données : règles absolues
- Source vérité = Supabase uniquement
- Âges = calculés depuis gd_stay_sessions
- Thèmes = table gd_stay_themes
- Prix = prix session + option ville
- Aucun prix hardcodé frontend

## UX actuelle
- Home = carrousels
- Page séjour = détail + sessions + choix ville
- Logique PRO prioritaire (transparence prix)

## Règles critiques
- No regression
- Ne jamais casser Supabase
- Ne pas modifier routing global
- 1 lot = 1 objectif
- Pas de refacto massif

PROJECT CONTEXT — GED

This workspace is Groupe & Découverte web app (GED).

Stack:
- Next.js app integrated into website vitrine
- Supabase database (single source of truth)
- Partner stays imported and reformulated
- Static deployment via Hostinger

Main structure:
- Kids access (no pricing)
- Pro access (pricing + info)
- Stay pages with sessions and ages
- Night sync with partner data

Important:
Reformulated GED content must never be overwritten by partner sync.
Supabase data must stay coherent with frontend.
Navigation and routes must never break.


## Objectif global
Stabilité production + cohérence données + lisibilité UX pour les professionnels.
