---
name: GED_APP Architecture Overview
description: Core architecture of GED_APP — Supabase + Next.js app for Groupe & Decouverte youth camp inscriptions, admin dashboard, referent dossier/suivi, Stripe payments
type: project
---

GED_APP is a Next.js app for "Groupe & Decouverte" — a youth camp organization. Single Supabase project, single Next.js app.

**Why:** Post-MVP stabilization phase as of 2026-03-19. ~20 commits of security fixes, functional additions, DB migrations.

**How to apply:** All reviews should consider the tight coupling between admin API routes, referent-facing suivi/dossier flows, Stripe webhook, and email side-effects. The app uses service_role_key everywhere (no RLS-dependent client calls). The suivi_token UUID is the sole auth mechanism for referent-facing routes — treat it as a secret.

Key tables: gd_inscriptions (central), gd_dossier_enfant, gd_processed_events, gd_inscription_status_logs, gd_propositions_tarifaires, gd_stays, gd_stay_sessions, gd_session_prices, payment_status_logs.

Auth: Cookie-based middleware for admin pages (gd_session cookie), JWT Bearer for admin API routes, UUID suivi_token for referent routes.

DB types file (types/database.types.ts) is STALE — missing consent_at, referent_fonction columns and gd_inscription_status_logs table entirely.
