-- 027_waitlist.sql
-- Liste d'attente par séjour — notifie les référents quand des places s'ouvrent

CREATE TABLE IF NOT EXISTS public.gd_waitlist (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  sejour_slug  text NOT NULL REFERENCES public.gd_stays(slug) ON DELETE CASCADE,
  nom          text,                          -- nom du référent (optionnel)
  created_at   timestamptz DEFAULT now(),
  notified_at  timestamptz,                   -- date du dernier email envoyé
  CONSTRAINT gd_waitlist_email_sejour_key UNIQUE (email, sejour_slug)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_sejour ON public.gd_waitlist (sejour_slug);
CREATE INDEX IF NOT EXISTS idx_waitlist_not_notified ON public.gd_waitlist (sejour_slug)
  WHERE notified_at IS NULL;

ALTER TABLE public.gd_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON public.gd_waitlist
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE public.gd_waitlist IS
  'Référents en attente de place sur un séjour. Notifiés par email à l ouverture des inscriptions.';
