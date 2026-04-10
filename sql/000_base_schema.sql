-- 000_base_schema.sql
-- Schéma consolidé GED App — 17 tables gd_*
-- Généré depuis production le 10 avril 2026
-- Usage : reconstruire la DB from scratch ou créer un env de staging
--
-- IMPORTANT : exécuter AVANT les migrations 001-038

-- ═══════════════════════════════════════════════════════════════════════
-- 1. gd_stays — Séjours éducatifs
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gd_stays (
  slug TEXT PRIMARY KEY,
  title TEXT,
  source_url TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title_pro TEXT,
  title_kids TEXT,
  description_pro TEXT,
  description_kids TEXT,
  sessions_json JSONB,
  import_batch_ts TIMESTAMPTZ DEFAULT NOW(),
  season TEXT,
  location_region TEXT,
  location_city TEXT,
  duration_days INTEGER,
  programme_json JSONB,
  inclusions_json JSONB,
  logistics_json JSONB,
  accroche TEXT,
  programme TEXT,
  pdf_url TEXT,
  centre_name TEXT,
  centre_url TEXT,
  tags JSONB,
  ged_theme TEXT,
  villes_depart JSONB,
  images JSONB,
  age_min INTEGER DEFAULT 6,
  age_max INTEGER DEFAULT 17,
  marketing_title TEXT,
  punchline TEXT,
  expert_pitch TEXT,
  emotion_tag TEXT,
  carousel_group TEXT,
  spot_label TEXT,
  standing_label TEXT,
  expertise_label TEXT,
  intensity_label TEXT,
  price_includes_features JSONB,
  is_full BOOLEAN DEFAULT false,
  documents_requis JSONB DEFAULT '["bulletin", "sanitaire", "liaison"]'::jsonb
);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. gd_stay_sessions — Sessions par séjour
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gd_stay_sessions (
  stay_slug TEXT NOT NULL REFERENCES gd_stays(slug) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  seats_left INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  city_departure TEXT,
  price NUMERIC,
  age_min INTEGER,
  age_max INTEGER,
  import_batch_ts TIMESTAMPTZ DEFAULT NOW(),
  price_ged NUMERIC,
  is_full BOOLEAN DEFAULT false,
  transport_included BOOLEAN DEFAULT false,
  PRIMARY KEY (stay_slug, start_date, end_date, city_departure)
);

-- ═══════════════════════════════════════════════════════════════════════
-- 3. gd_stay_themes — Thèmes par séjour
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gd_stay_themes (
  stay_slug TEXT NOT NULL REFERENCES gd_stays(slug) ON DELETE CASCADE,
  theme TEXT NOT NULL,
  PRIMARY KEY (stay_slug, theme)
);

-- ═══════════════════════════════════════════════════════════════════════
-- 4. gd_session_prices — Prix par session
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gd_session_prices (
  stay_slug TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  base_price_eur INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  city_departure TEXT NOT NULL DEFAULT 'sans_transport',
  transport_surcharge_ufoval INTEGER NOT NULL DEFAULT 0,
  price_ged_total INTEGER,
  transport_surcharge_ged INTEGER,
  is_full BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════════════════
-- 5. gd_structures — Structures sociales (ASE, MECS, foyers)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gd_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  address TEXT,
  postal_code TEXT,
  city TEXT,
  type TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by_email TEXT,
  address_private BOOLEAN NOT NULL DEFAULT false,
  code_directeur TEXT UNIQUE,
  code_expires_at TIMESTAMPTZ,
  code_directeur_expires_at TIMESTAMPTZ,
  code_generated_at TIMESTAMPTZ DEFAULT NOW(),
  code_directeur_generated_at TIMESTAMPTZ,
  code_revoked_at TIMESTAMPTZ,
  code_directeur_revoked_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════════════════
-- 6. gd_inscriptions — Inscriptions professionnels
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gd_inscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jeune_prenom TEXT NOT NULL,
  jeune_nom TEXT NOT NULL,
  jeune_date_naissance DATE NOT NULL,
  jeune_besoins TEXT,
  jeune_sexe TEXT,
  referent_nom TEXT,
  referent_email TEXT,
  referent_tel TEXT,
  referent_fonction TEXT,
  sejour_slug TEXT,
  session_date DATE,
  city_departure TEXT,
  options_educatives TEXT,
  remarques TEXT,
  price_total INTEGER,
  status TEXT DEFAULT 'en_attente',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending_payment',
  payment_reference TEXT,
  stripe_payment_intent_id TEXT,
  payment_validated_at TIMESTAMPTZ,
  organisation TEXT,
  dossier_ref TEXT,
  suivi_token UUID DEFAULT gen_random_uuid(),
  suivi_token_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  documents_status TEXT DEFAULT 'en_attente',
  besoins_pris_en_compte BOOLEAN DEFAULT false,
  equipe_informee BOOLEAN DEFAULT false,
  note_pro TEXT,
  pref_nouvelles_sejour TEXT DEFAULT 'si_besoin',
  pref_canal_contact TEXT DEFAULT 'email',
  pref_bilan_fin_sejour BOOLEAN DEFAULT false,
  consignes_communication TEXT,
  besoins_specifiques TEXT,
  consent_at TIMESTAMPTZ,
  parental_consent_at TIMESTAMPTZ,
  parental_consent_version TEXT,
  structure_domain TEXT,
  structure_id UUID REFERENCES gd_structures(id),
  structure_pending_name TEXT,
  structure_email TEXT,
  structure_postal_code TEXT,
  structure_city TEXT,
  structure_type TEXT,
  structure_address TEXT,
  deleted_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════════════════
-- 7. gd_dossier_enfant — Dossiers enfants ASE
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gd_dossier_enfant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inscription_id UUID NOT NULL REFERENCES gd_inscriptions(id) ON DELETE CASCADE,
  bulletin_complement JSONB DEFAULT '{}'::jsonb,
  fiche_sanitaire JSONB DEFAULT '{}'::jsonb,
  fiche_liaison_jeune JSONB DEFAULT '{}'::jsonb,
  fiche_renseignements JSONB,
  documents_joints JSONB DEFAULT '[]'::jsonb,
  bulletin_completed BOOLEAN DEFAULT false,
  sanitaire_completed BOOLEAN DEFAULT false,
  liaison_completed BOOLEAN DEFAULT false,
  renseignements_completed BOOLEAN DEFAULT false,
  renseignements_required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ged_sent_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════════════════
-- 8. gd_souhaits — Souhaits kids
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gd_souhaits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_prenom TEXT NOT NULL,
  kid_prenom_referent TEXT,
  sejour_slug TEXT NOT NULL,
  sejour_titre TEXT,
  motivation TEXT,
  educateur_email TEXT NOT NULL,
  educateur_prenom TEXT,
  educateur_token UUID DEFAULT gen_random_uuid(),
  educateur_token_expires_at TIMESTAMPTZ,
  kid_session_token UUID,
  choix_mode TEXT,
  structure_domain TEXT,
  structure_id UUID REFERENCES gd_structures(id),
  status TEXT NOT NULL DEFAULT 'emis',
  reponse_educateur TEXT,
  reponse_date TIMESTAMPTZ,
  inscription_id UUID REFERENCES gd_inscriptions(id),
  suivi_token_kid UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 9. gd_wishes — Souhaits (ancien système)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gd_wishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prenom TEXT NOT NULL,
  date_naissance DATE NOT NULL,
  sejour_slug TEXT,
  session_date DATE,
  city_departure TEXT,
  motivation TEXT,
  status TEXT DEFAULT 'nouveau',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 10. gd_educ_options — Options éducatives
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gd_educ_options (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  extra_eur INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- ═══════════════════════════════════════════════════════════════════════
-- 11. gd_propositions_tarifaires — Propositions tarifaires
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gd_propositions_tarifaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_nom TEXT NOT NULL,
  structure_adresse TEXT NOT NULL,
  structure_cp TEXT NOT NULL,
  structure_ville TEXT NOT NULL,
  enfant_nom TEXT NOT NULL,
  enfant_prenom TEXT NOT NULL,
  sejour_slug TEXT NOT NULL,
  sejour_titre TEXT NOT NULL,
  sejour_activites TEXT,
  session_start DATE NOT NULL,
  session_end DATE NOT NULL,
  agrement_dscs TEXT DEFAULT '069ORG0667',
  ville_depart TEXT NOT NULL,
  prix_sejour NUMERIC NOT NULL DEFAULT 0,
  prix_transport NUMERIC NOT NULL DEFAULT 0,
  encadrement BOOLEAN NOT NULL DEFAULT false,
  prix_encadrement NUMERIC NOT NULL DEFAULT 0,
  adhesion TEXT DEFAULT 'Comprise',
  options TEXT DEFAULT 'Tranquillité : recherche individualisée, veille éducative, informations mise en lien, bilans.',
  prix_total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'brouillon',
  inscription_id UUID REFERENCES gd_inscriptions(id),
  pdf_storage_path TEXT,
  created_by TEXT,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 12. gd_admin_2fa — TOTP admin
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gd_admin_2fa (
  user_id UUID PRIMARY KEY,
  totp_secret TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 13. gd_audit_log — Journal audit RGPD
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gd_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  inscription_id UUID,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  ip_address TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 14. gd_inscription_status_logs — Historique statuts
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gd_inscription_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inscription_id UUID NOT NULL REFERENCES gd_inscriptions(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by_email TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 15. gd_login_attempts — Rate limiting
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gd_login_attempts (
  ip TEXT PRIMARY KEY,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 16. gd_processed_events — Idempotence webhooks
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gd_processed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 17. gd_waitlist — Liste d'attente
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gd_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  sejour_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notified_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════════════════
-- INDEX
-- ═══════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_structures_postal_code ON gd_structures (postal_code);
CREATE INDEX IF NOT EXISTS idx_structures_code_directeur ON gd_structures (code_directeur) WHERE code_directeur IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inscriptions_structure_pending ON gd_inscriptions (structure_pending_name) WHERE structure_pending_name IS NOT NULL AND structure_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_status_logs_inscription ON gd_inscription_status_logs (inscription_id, changed_at DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- RLS — Service role only sur tables sensibles
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE gd_inscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gd_dossier_enfant ENABLE ROW LEVEL SECURITY;
ALTER TABLE gd_souhaits ENABLE ROW LEVEL SECURITY;
ALTER TABLE gd_inscription_status_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on inscriptions" ON gd_inscriptions TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on dossier_enfant" ON gd_dossier_enfant TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON gd_souhaits USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY "Service role full access on status_logs" ON gd_inscription_status_logs TO service_role USING (true) WITH CHECK (true);
