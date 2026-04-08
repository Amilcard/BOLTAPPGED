-- Migration 031 : Fix search_path sur gd_check_session_capacity (SECURITY DEFINER)
-- Corrige le risque d'injection de search_path
-- À exécuter dans Supabase → SQL Editor

ALTER FUNCTION public.gd_check_session_capacity(text, text)
  SET search_path = '';

-- Vérification
SELECT proconfig FROM pg_proc WHERE proname = 'gd_check_session_capacity';
