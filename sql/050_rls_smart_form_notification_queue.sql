-- 050_rls_smart_form_notification_queue.sql
-- Fix CR2 : activer RLS sur smart_form_submissions et notification_queue
-- Pattern GED : RLS enabled + zero policy = service_role only (bypass RLS natif)
-- Aucun accès anon ou authenticated via PostgREST

ALTER TABLE smart_form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
