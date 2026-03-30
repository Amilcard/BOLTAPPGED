---
name: GED_APP Project Context
description: Architecture, stack, auth strategy and key tables for GED_APP (Groupe & Découverte)
type: project
---

GED_APP est une application Next.js 14 + Supabase pour Groupe & Découverte (colonies de vacances, mineurs 3-17 ans).

**Why:** Données sensibles impliquées — données médicales enfants, documents officiels, emails référents, tokens de suivi.

**How to apply:** Toujours auditer en priorité les routes publiques (token-based) et la séparation service_role / anon.

## Stack
- Next.js 14 standalone (déployé sur Vercel depuis branche main)
- Supabase (PostgreSQL) — projet ref: iirfvndgzutbxwfdwawu
- Auth admin: JWT cookie `gd_session` via NEXTAUTH_SECRET, lib/auth-middleware.ts
- Auth référent: UUID suivi_token dans URL (/suivi/[token])
- Auth kid: UUID kid_session_token stocké en localStorage
- Auth éducateur: UUID educateur_token dans URL magic link (/educateur/souhait/[token])
- Email: Resend (EMAIL_SERVICE_API_KEY)
- Paiement: Stripe

## Tables principales identifiées
- gd_inscriptions — inscriptions enfants (données PII complètes + médicales via FK)
- gd_dossier_enfant — fiches sanitaires, bulletins, liaison jeune (données médicales)
- gd_souhaits — souhaits kids → éducateurs
- gd_structures — regroupement par domaine email éducateur
- gd_stays — séjours publiés
- gd_stay_sessions — sessions avec capacité/âges
- gd_session_prices — tarifs
- gd_inscription_status_logs — audit log statuts
- gd_processed_events — idempotency Stripe
- gd_propositions_tarifaires — propositions admin

## RLS status (d'après migrations)
- gd_processed_events: RLS activé, service_role only (migration 011)
- gd_souhaits: RLS activé, mais policy SELECT anon = USING(true) — OUVERT (migration 020)
- gd_structures: RLS activé, policy SELECT anon = USING(true) — ouvert (migration 020)
- gd_inscription_status_logs: RLS activé, service_role only (migration 023)
- gd_inscriptions: RLS STATUS INCONNU dans les migrations fournies
- gd_dossier_enfant: RLS STATUS INCONNU dans les migrations fournies
- gd_stays, gd_session_prices, gd_stay_sessions: RLS STATUS INCONNU

## Supabase Storage
- Bucket: dossier-documents (documents médicaux uploadés)
- Accès bucket: policies non visibles dans le code fourni

## Fonction SECURITY DEFINER
- gd_check_session_capacity (migration 022) — SANS SET search_path fixé dans 022 (mais supabase_functions_search_path_fix.sql le couvre pour d'autres fonctions, pas celle-ci)
