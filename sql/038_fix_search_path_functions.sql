-- 038_fix_search_path_functions.sql
-- Fix Supabase Security Advisor : "Function has a role mutable search_path"
-- Toutes les fonctions publiques doivent avoir search_path = public explicite.

ALTER FUNCTION generate_director_code() SET search_path = public;
ALTER FUNCTION generate_structure_code() SET search_path = public;
ALTER FUNCTION generate_payment_reference() SET search_path = public;
ALTER FUNCTION gd_check_session_capacity(text, text) SET search_path = public;
ALTER FUNCTION gd_purge_expired_audit_logs() SET search_path = public;
ALTER FUNCTION gd_purge_expired_medical_data() SET search_path = public;
ALTER FUNCTION get_random_sejour_image() SET search_path = public;
ALTER FUNCTION get_stay_carousel_images(character varying, integer) SET search_path = public;
ALTER FUNCTION get_stays_by_tags(text[], integer, integer) SET search_path = public;
ALTER FUNCTION get_top_sejour_images() SET search_path = public;
