-- Migration 023: Enable RLS on gd_inscription_status_logs
-- Fixes Supabase security warning: RLS disabled on public table
-- Date: 2026-03-25
--
-- Cette table est un audit log interne — accès uniquement via service_role
-- (le code serveur Next.js utilise service_role_key qui bypass RLS).
-- Aucune lecture directe via PostgREST anon/authenticated n'est requise.

ALTER TABLE gd_inscription_status_logs ENABLE ROW LEVEL SECURITY;

-- Bloquer tout accès direct PostgREST (anon, authenticated)
-- Le service_role bypass RLS automatiquement — aucune policy nécessaire pour lui
CREATE POLICY "Service role only" ON gd_inscription_status_logs
  FOR ALL USING (auth.role() = 'service_role');
