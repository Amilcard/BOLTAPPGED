-- Migration 062 : Ajouter SET search_path = public aux fonctions de purge RGPD
-- Alignement avec le hardening appliqué sur toutes les autres SECURITY DEFINER (040, 057, 058)

ALTER FUNCTION public.gd_purge_expired_audit_logs()
  SET search_path = public;

ALTER FUNCTION public.gd_purge_expired_medical_data()
  SET search_path = public;
