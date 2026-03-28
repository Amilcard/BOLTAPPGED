--
-- PostgreSQL database dump
--

\restrict E2qZBBTHJfOJCx2P4qf6h0VN639fcUr0AanPGtAGISOIjYegucq0L4FVNkw23SW

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: estimate_financial_aid(integer, boolean, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.estimate_financial_aid(p_qf integer, p_qpv boolean, p_sejour_price integer) RETURNS TABLE(aide_montant integer, reste_a_charge integer, taux_prise_en_charge numeric, eligible_aide_max boolean)
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_aide_montant INTEGER;
  v_reste_a_charge INTEGER;
  v_taux NUMERIC;
BEGIN
  -- Logique simplifiée d'aides financières
  -- Basée sur business_logic_rules.json

  IF p_qf IS NULL THEN
    -- Pas de QF fourni, pas d'estimation possible
    RETURN QUERY SELECT 0, p_sejour_price, 0.0::NUMERIC, FALSE;
    RETURN;
  END IF;

  -- Calcul aide selon QF (logique à affiner selon vos barèmes)
  v_taux := CASE
    WHEN p_qf <= 400 THEN 1.0  -- 100% pris en charge
    WHEN p_qf <= 600 THEN 0.9  -- 90%
    WHEN p_qf <= 800 THEN 0.75 -- 75%
    WHEN p_qf <= 1000 THEN 0.6 -- 60%
    WHEN p_qf <= 1200 THEN 0.4 -- 40%
    ELSE 0.2                    -- 20%
  END;

  -- Bonus QPV : +10% de prise en charge
  IF p_qpv = TRUE THEN
    v_taux := LEAST(1.0, v_taux + 0.1);
  END IF;

  v_aide_montant := FLOOR(p_sejour_price * v_taux);
  v_reste_a_charge := p_sejour_price - v_aide_montant;

  RETURN QUERY SELECT
    v_aide_montant,
    v_reste_a_charge,
    v_taux,
    (v_taux >= 1.0) as eligible_aide_max;
END;
$$;


--
-- Name: FUNCTION estimate_financial_aid(p_qf integer, p_qpv boolean, p_sejour_price integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.estimate_financial_aid(p_qf integer, p_qpv boolean, p_sejour_price integer) IS 'Estime aide financière selon QF et QPV';


--
-- Name: gd_check_session_capacity(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gd_check_session_capacity(p_slug text, p_start_date text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_session gd_stay_sessions%ROWTYPE;
BEGIN
  -- Verrou ligne : empêche deux requêtes concurrentes de lire la même valeur
  SELECT * INTO v_session
  FROM gd_stay_sessions
  WHERE stay_slug = p_slug
    AND start_date::date = p_start_date::date
  FOR UPDATE NOWAIT;

  -- Aucune session dans gd_stay_sessions → séjour sans suivi de places → autorisé
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'source', 'no_session');
  END IF;

  -- seats_left = -1 → places illimitées (source UFOVAL)
  IF v_session.seats_left = -1 OR v_session.seats_left IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'age_min', v_session.age_min,
      'age_max', v_session.age_max
    );
  END IF;

  -- Plus de places
  IF v_session.seats_left <= 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'SESSION_FULL');
  END IF;

  -- Places disponibles
  RETURN jsonb_build_object(
    'allowed', true,
    'seats_left', v_session.seats_left,
    'age_min', v_session.age_min,
    'age_max', v_session.age_max
  );

EXCEPTION
  WHEN lock_not_available THEN
    -- Verrou déjà pris par une requête concurrente → refuser pour sécurité
    RETURN jsonb_build_object('allowed', false, 'reason', 'SESSION_FULL');
END;
$$;


--
-- Name: generate_payment_reference(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_payment_reference() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$ BEGIN IF NEW.payment_reference IS NULL THEN NEW.payment_reference := 'PAY-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 8); END IF; RETURN NEW; END; $$;


--
-- Name: get_random_sejour_image(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_random_sejour_image(sejour_slug character varying) RETURNS TABLE(id uuid, public_url text, thumbnail_url text, alt_description text, photographer_name character varying, photographer_url text)
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.id,
    si.public_url,
    si.thumbnail_url,
    si.alt_description,
    si.photographer_name,
    si.photographer_url
  FROM sejours_images si
  WHERE si.slug = sejour_slug
    AND si.status = 'active'
  ORDER BY RANDOM()
  LIMIT 1;
END;
$$;


--
-- Name: get_stay_carousel_images(character varying, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_stay_carousel_images(stay_slug character varying, image_limit integer DEFAULT 6) RETURNS TABLE(id uuid, public_url text, thumbnail_url text, alt_description text, photographer_name character varying, photographer_url text, visual_mood character varying, color_palette text, quality_score integer)
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.id,
    si.public_url,
    si.thumbnail_url,
    si.alt_description,
    si.photographer_name,
    si.photographer_url,
    si.visual_mood,
    si.color_palette,
    si.quality_score
  FROM sejours_images si
  WHERE si.slug = stay_slug
    AND si.status = 'active'
  ORDER BY
    -- Prioriser :
    -- 1. Images manuellement sélectionnées
    si.manual_selection DESC,
    -- 2. Images de query primary
    CASE si.query_type WHEN 'primary' THEN 1 ELSE 2 END,
    -- 3. Score qualité visuelle
    si.quality_score DESC,
    -- 4. Moins utilisées (pour rotation)
    si.usage_count ASC,
    -- 5. Plus récentes
    si.imported_at DESC
  LIMIT image_limit;
END;
$$;


--
-- Name: FUNCTION get_stay_carousel_images(stay_slug character varying, image_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_stay_carousel_images(stay_slug character varying, image_limit integer) IS 'Récupère images optimisées pour carousel séjour';


--
-- Name: get_stays_by_tags(text[], integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_stays_by_tags(filter_tags text[], child_age integer DEFAULT NULL::integer, limit_count integer DEFAULT 12) RETURNS TABLE(slug character varying, marketing_title character varying, emotion_tag character varying, carousel_group character varying, age_min integer, age_max integer, punchline text, image_url text, match_score integer)
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.slug,
    s.marketing_title,
    s.emotion_tag,
    s.carousel_group,
    s.age_min,
    s.age_max,
    s.punchline,
    si.public_url as image_url,
    (
      -- Score de matching : nb de tags correspondants
      SELECT COUNT(*)::INTEGER
      FROM unnest(filter_tags) AS tag
      WHERE s.emotion_tag ILIKE '%' || tag || '%'
        OR s.punchline ILIKE '%' || tag || '%'
        OR s.carousel_group ILIKE '%' || tag || '%'
    ) as match_score
  FROM gd_stays s
  LEFT JOIN LATERAL (
    SELECT public_url
    FROM sejours_images
    WHERE slug = s.slug
      AND status = 'active'
    ORDER BY quality_score DESC
    LIMIT 1
  ) si ON true
  WHERE s.published = true
    AND (child_age IS NULL OR (s.age_min <= child_age AND s.age_max >= child_age))
    AND EXISTS (
      SELECT 1
      FROM unnest(filter_tags) AS tag
      WHERE s.emotion_tag ILIKE '%' || tag || '%'
        OR s.punchline ILIKE '%' || tag || '%'
        OR s.carousel_group ILIKE '%' || tag || '%'
    )
  ORDER BY match_score DESC, s.marketing_title
  LIMIT limit_count;
END;
$$;


--
-- Name: FUNCTION get_stays_by_tags(filter_tags text[], child_age integer, limit_count integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_stays_by_tags(filter_tags text[], child_age integer, limit_count integer) IS 'Recherche séjours par tags avec score de pertinence';


--
-- Name: get_top_sejour_images(character varying, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_top_sejour_images(sejour_slug character varying, limit_count integer DEFAULT 5) RETURNS TABLE(id uuid, public_url text, thumbnail_url text, alt_description text, photographer_name character varying, photographer_url text, quality_score integer, usage_count integer)
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.id,
    si.public_url,
    si.thumbnail_url,
    si.alt_description,
    si.photographer_name,
    si.photographer_url,
    si.quality_score,
    si.usage_count
  FROM sejours_images si
  WHERE si.slug = sejour_slug
    AND si.status = 'active'
  ORDER BY
    (si.quality_score * 0.6 + LEAST(si.usage_count, 10) * 0.4) DESC,
    si.imported_at DESC
  LIMIT limit_count;
END;
$$;


--
-- Name: increment_image_usage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_image_usage(image_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  UPDATE sejours_images
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = image_id;
END;
$$;


--
-- Name: v_activity_with_sessions; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_activity_with_sessions AS
SELECT
    NULL::uuid AS id,
    NULL::text AS title,
    NULL::text AS category,
    NULL::text[] AS tags,
    NULL::integer AS age_min,
    NULL::integer AS age_max,
    NULL::text AS location_name,
    NULL::text AS location_region,
    NULL::text AS period_type,
    NULL::text[] AS vacation_periods,
    NULL::text AS short_description,
    NULL::text AS description,
    NULL::jsonb AS program_brief,
    NULL::jsonb AS program_detailed,
    NULL::text AS accommodation,
    NULL::text AS supervision,
    NULL::text AS pro_price_note,
    NULL::text AS status,
    NULL::text AS source_url,
    NULL::timestamp with time zone AS created_at,
    NULL::timestamp with time zone AS updated_at,
    NULL::json AS sessions;


--
-- Name: list_published_activities_with_sessions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_published_activities_with_sessions() RETURNS SETOF public.v_activity_with_sessions
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select *
  from public.v_activity_with_sessions
  where status = 'published'
  order by title;
$$;


--
-- Name: log_smart_form_submission(character varying, integer, text[], boolean, boolean, integer, boolean, character varying, character varying, character varying, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_smart_form_submission(p_inclusion_level character varying, p_child_age integer, p_interests text[], p_urgence_48h boolean, p_handicap boolean, p_qf integer, p_qpv boolean, p_referent_organization character varying, p_contact_email character varying, p_contact_phone character varying, p_suggested_stays jsonb) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_submission_id UUID;
  v_alert_priority VARCHAR(50);
BEGIN
  -- Déterminer priorité alerte selon business logic
  v_alert_priority := CASE
    WHEN p_inclusion_level = 'NIVEAU_3_RUPTURE' THEN 'HIGH_PRIORITY_CALL_NOW'
    WHEN p_urgence_48h = TRUE THEN 'HOT_LEAD'
    WHEN p_inclusion_level = 'NIVEAU_2_RENFORCE' THEN 'MEDIUM_PRIORITY'
    ELSE 'STANDARD'
  END;

  -- Insérer soumission
  INSERT INTO smart_form_submissions (
    inclusion_level,
    child_age,
    interests,
    urgence_48h,
    handicap,
    qf,
    qpv,
    referent_organization,
    contact_email,
    contact_phone,
    suggested_stays,
    alert_priority
  ) VALUES (
    p_inclusion_level,
    p_child_age,
    p_interests,
    p_urgence_48h,
    p_handicap,
    p_qf,
    p_qpv,
    p_referent_organization,
    p_contact_email,
    p_contact_phone,
    p_suggested_stays,
    v_alert_priority
  )
  RETURNING id INTO v_submission_id;

  RETURN v_submission_id;
END;
$$;


--
-- Name: FUNCTION log_smart_form_submission(p_inclusion_level character varying, p_child_age integer, p_interests text[], p_urgence_48h boolean, p_handicap boolean, p_qf integer, p_qpv boolean, p_referent_organization character varying, p_contact_email character varying, p_contact_phone character varying, p_suggested_stays jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.log_smart_form_submission(p_inclusion_level character varying, p_child_age integer, p_interests text[], p_urgence_48h boolean, p_handicap boolean, p_qf integer, p_qpv boolean, p_referent_organization character varying, p_contact_email character varying, p_contact_phone character varying, p_suggested_stays jsonb) IS 'Enregistre soumission smart form avec routage alerte';


--
-- Name: notify_urgent_submission(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_urgent_submission() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  -- Si alerte high priority ou hot lead, déclencher notification
  IF NEW.alert_priority IN ('HIGH_PRIORITY_CALL_NOW', 'HOT_LEAD') THEN
    -- Ici : appel webhook, email, SMS selon votre stack
    -- Exemple simplifié : log dans table notifications
    INSERT INTO notification_queue (
      type,
      priority,
      recipient,
      subject,
      payload,
      created_at
    ) VALUES (
      'smart_form_alert',
      NEW.alert_priority,
      'sales_team_oncall',
      CONCAT('[', NEW.alert_priority, '] Nouvelle demande urgente'),
      json_build_object(
        'submission_id', NEW.id,
        'inclusion_level', NEW.inclusion_level,
        'contact_phone', NEW.contact_phone,
        'organization', NEW.referent_organization
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: reject_dates_prices_in_editorial(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_dates_prices_in_editorial() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  txt text;
begin
  txt := coalesce(new.short_description,'') || ' ' || coalesce(new.description,'');

  -- Détecte formats de dates courants: 10/07/2026, 10-07-2026, 10 juillet 2026, 2026-07-10
  if txt ~* '(\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b)|(\b\d{4}\-\d{2}\-\d{2}\b)|(\b\d{1,2}\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+\d{4}\b)' then
    raise exception 'Editorial text must not contain explicit dates. Put dates in activity_sessions.';
  end if;

  -- Détecte prix: 1883 €, 1 883€, 1883.00 EUR, etc.
  if txt ~* '(\b\d{1,3}(\s?\d{3})*(\.\d{2})?\s?(€|eur)\b)' then
    raise exception 'Editorial text must not contain explicit prices. Put price in activity_sessions.price_base.';
  end if;

  return new;
end;
$$;


--
-- Name: set_inscriptions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_inscriptions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: set_payment_reference(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_payment_reference() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.payment_reference IS NULL THEN
    NEW.payment_reference := generate_payment_reference();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_session_prices_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_session_prices_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: set_structures_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_structures_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: sync_stay_sessions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_stay_sessions() RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  stay_record RECORD;
  session_item JSONB;
  sessions_array JSONB;
  inserted_count INTEGER := 0;
  duration_days INTEGER;
  markup INTEGER;
  final_price NUMERIC;
BEGIN
  FOR stay_record IN 
    SELECT slug, sessions_json 
    FROM gd_stays 
    WHERE sessions_json IS NOT NULL
  LOOP
    sessions_array := (stay_record.sessions_json #>> '{}')::jsonb;
    
    IF jsonb_typeof(sessions_array) = 'array' THEN
      FOR session_item IN SELECT * FROM jsonb_array_elements(sessions_array)
      LOOP
        duration_days := (session_item->>'end_date')::date - (session_item->>'start_date')::date;
        
        IF duration_days >= 7 AND duration_days <= 10 THEN markup := 180;
        ELSIF duration_days >= 11 AND duration_days <= 17 THEN markup := 240;
        ELSIF duration_days >= 18 AND duration_days <= 21 THEN markup := 410;
        ELSE markup := 0;
        END IF;
        
        final_price := COALESCE((session_item->>'price_base')::numeric, 0) + markup;
        
        INSERT INTO gd_stay_sessions (stay_slug, start_date, end_date, seats_left, price, import_batch_ts)
        VALUES (
          stay_record.slug,
          (session_item->>'start_date')::date,
          (session_item->>'end_date')::date,
          (session_item->>'capacity_remaining')::integer,
          final_price,
          NOW()
        )
        ON CONFLICT (stay_slug, start_date, end_date) DO UPDATE SET
          seats_left = EXCLUDED.seats_left,
          price = EXCLUDED.price,
          updated_at = NOW();
        
        inserted_count := inserted_count + 1;
      END LOOP;
    END IF;
  END LOOP;
  
  RETURN inserted_count;
END;
$$;


--
-- Name: update_dossier_enfant_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_dossier_enfant_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_propositions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_propositions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_sejours_images_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_sejours_images_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    category text DEFAULT 'colonies'::text NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    age_min integer NOT NULL,
    age_max integer NOT NULL,
    location_name text,
    location_region text,
    period_type text DEFAULT 'vacances'::text NOT NULL,
    vacation_periods text[] DEFAULT '{}'::text[] NOT NULL,
    short_description text,
    description text,
    program_brief jsonb DEFAULT '[]'::jsonb NOT NULL,
    program_detailed jsonb DEFAULT '[]'::jsonb NOT NULL,
    accommodation text,
    supervision text,
    pro_price_note text,
    status text DEFAULT 'draft'::text NOT NULL,
    source_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source text,
    import_run_id text,
    CONSTRAINT activities_age_min_check CHECK ((age_min >= 0)),
    CONSTRAINT activities_category_check CHECK ((category = ANY (ARRAY['colonies'::text, 'distanciation'::text]))),
    CONSTRAINT activities_check CHECK ((age_max >= age_min)),
    CONSTRAINT activities_period_type_check CHECK ((period_type = ANY (ARRAY['vacances'::text, 'scolaire'::text]))),
    CONSTRAINT activities_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'needs_review'::text]))),
    CONSTRAINT activities_vacation_periods_check CHECK ((vacation_periods <@ ARRAY['hiver'::text, 'printemps'::text, 'ete'::text, 'toussaint'::text, 'noel'::text]))
);


--
-- Name: activity_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    activity_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    capacity_total integer,
    capacity_remaining integer,
    price_base numeric(12,2),
    price_unit text DEFAULT '€'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT activity_sessions_capacity_total_check CHECK (((capacity_total IS NULL) OR (capacity_total >= 0))),
    CONSTRAINT activity_sessions_check CHECK ((end_date > start_date)),
    CONSTRAINT activity_sessions_check1 CHECK (((capacity_remaining IS NULL) OR ((capacity_remaining >= 0) AND ((capacity_total IS NULL) OR (capacity_remaining <= capacity_total))))),
    CONSTRAINT activity_sessions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'full'::text, 'closed'::text])))
);


--
-- Name: gd_dossier_enfant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gd_dossier_enfant (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inscription_id uuid NOT NULL,
    bulletin_complement jsonb DEFAULT '{}'::jsonb,
    fiche_sanitaire jsonb DEFAULT '{}'::jsonb,
    fiche_liaison_jeune jsonb DEFAULT '{}'::jsonb,
    fiche_renseignements jsonb,
    documents_joints jsonb DEFAULT '[]'::jsonb,
    bulletin_completed boolean DEFAULT false,
    sanitaire_completed boolean DEFAULT false,
    liaison_completed boolean DEFAULT false,
    renseignements_completed boolean DEFAULT false,
    renseignements_required boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    ged_sent_at timestamp with time zone
);


--
-- Name: gd_dossier_ref_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gd_dossier_ref_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gd_educ_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gd_educ_options (
    code text NOT NULL,
    label text NOT NULL,
    extra_eur integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT gd_educ_options_extra_eur_check CHECK ((extra_eur >= 0))
);


--
-- Name: gd_inscription_status_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gd_inscription_status_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inscription_id uuid NOT NULL,
    old_status text,
    new_status text NOT NULL,
    changed_by_email text,
    changed_at timestamp with time zone DEFAULT now()
);


--
-- Name: gd_inscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gd_inscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jeune_prenom text NOT NULL,
    jeune_nom text NOT NULL,
    jeune_date_naissance date NOT NULL,
    jeune_besoins text,
    referent_nom text,
    referent_email text,
    referent_tel text,
    sejour_slug text,
    session_date date,
    city_departure text,
    options_educatives text,
    remarques text,
    price_total integer,
    status text DEFAULT 'en_attente'::text,
    created_at timestamp with time zone DEFAULT now(),
    payment_method text,
    payment_status text DEFAULT 'pending_payment'::text,
    payment_reference text,
    stripe_payment_intent_id text,
    payment_validated_at timestamp with time zone,
    organisation text,
    dossier_ref text,
    suivi_token uuid DEFAULT gen_random_uuid(),
    updated_at timestamp with time zone DEFAULT now(),
    documents_status text DEFAULT 'en_attente'::text,
    besoins_pris_en_compte boolean DEFAULT false,
    equipe_informee boolean DEFAULT false,
    note_pro text,
    pref_nouvelles_sejour text DEFAULT 'si_besoin'::text,
    pref_canal_contact text DEFAULT 'email'::text,
    pref_bilan_fin_sejour boolean DEFAULT false,
    consignes_communication text,
    besoins_specifiques text,
    consent_at timestamp with time zone,
    referent_fonction text,
    structure_domain text,
    structure_id uuid,
    CONSTRAINT gd_inscriptions_payment_method_check CHECK ((payment_method = ANY (ARRAY['stripe'::text, 'transfer'::text, 'check'::text]))),
    CONSTRAINT gd_inscriptions_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending_payment'::text, 'pending_transfer'::text, 'pending_check'::text, 'paid'::text, 'failed'::text, 'amount_mismatch'::text])))
);


--
-- Name: COLUMN gd_inscriptions.payment_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_inscriptions.payment_method IS 'Payment method: stripe (CB en ligne), transfer (virement), check (chèque)';


--
-- Name: gd_processed_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gd_processed_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id text NOT NULL,
    event_type text NOT NULL,
    processed_at timestamp with time zone DEFAULT now()
);


--
-- Name: gd_propositions_tarifaires; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gd_propositions_tarifaires (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_nom text NOT NULL,
    structure_adresse text NOT NULL,
    structure_cp text NOT NULL,
    structure_ville text NOT NULL,
    enfant_nom text NOT NULL,
    enfant_prenom text NOT NULL,
    sejour_slug text NOT NULL,
    sejour_titre text NOT NULL,
    sejour_activites text,
    session_start date NOT NULL,
    session_end date NOT NULL,
    agrement_dscs text DEFAULT '069ORG0667'::text,
    ville_depart text NOT NULL,
    prix_sejour numeric(10,2) DEFAULT 0 NOT NULL,
    prix_transport numeric(10,2) DEFAULT 0 NOT NULL,
    encadrement boolean DEFAULT false NOT NULL,
    prix_encadrement numeric(10,2) DEFAULT 0 NOT NULL,
    adhesion text DEFAULT 'Comprise'::text,
    options text DEFAULT 'Tranquillité : recherche individualisée, veille éducative, informations mise en lien, bilans.'::text,
    prix_total numeric(10,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'brouillon'::text NOT NULL,
    inscription_id uuid,
    pdf_storage_path text,
    created_by text,
    validated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT gd_propositions_tarifaires_status_check CHECK ((status = ANY (ARRAY['brouillon'::text, 'envoyee'::text, 'validee'::text, 'refusee'::text, 'annulee'::text])))
);


--
-- Name: gd_session_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gd_session_prices (
    stay_slug text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    base_price_eur integer NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    city_departure text DEFAULT 'sans_transport'::text NOT NULL,
    transport_surcharge_ufoval integer DEFAULT 0 NOT NULL,
    price_ged_total integer,
    transport_surcharge_ged integer GENERATED ALWAYS AS (
CASE
    WHEN (transport_surcharge_ufoval = 0) THEN 0
    ELSE (transport_surcharge_ufoval + 18)
END) STORED,
    is_full boolean DEFAULT false,
    updated_at timestamp with time zone,
    CONSTRAINT gd_session_prices_base_price_eur_check CHECK ((base_price_eur >= 0)),
    CONSTRAINT gd_session_prices_end_after_start CHECK ((end_date >= start_date)),
    CONSTRAINT gd_session_prices_transport_surcharge_ufoval_check CHECK ((transport_surcharge_ufoval >= 0))
);


--
-- Name: COLUMN gd_session_prices.city_departure; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_session_prices.city_departure IS 'Ville de départ (sans_transport, lyon, paris, etc.)';


--
-- Name: COLUMN gd_session_prices.transport_surcharge_ufoval; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_session_prices.transport_surcharge_ufoval IS 'Surcoût transport UFOVAL en euros';


--
-- Name: COLUMN gd_session_prices.price_ged_total; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_session_prices.price_ged_total IS 'Prix GED total = base + markup_durée + transport_ged';


--
-- Name: COLUMN gd_session_prices.is_full; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_session_prices.is_full IS 'Session complète. Détecté par scraping n8n.';


--
-- Name: gd_session_prices_backup_align_enddate_2026_02_22; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gd_session_prices_backup_align_enddate_2026_02_22 (
    stay_slug text,
    start_date date,
    end_date date,
    base_price_eur integer,
    currency text,
    city_departure text,
    transport_surcharge_ufoval integer,
    price_ged_total integer,
    transport_surcharge_ged integer,
    is_full boolean
);


--
-- Name: gd_souhaits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gd_souhaits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kid_prenom text NOT NULL,
    kid_prenom_referent text,
    sejour_slug text NOT NULL,
    sejour_titre text,
    motivation text,
    educateur_email text NOT NULL,
    structure_domain text,
    structure_id uuid,
    status text DEFAULT 'emis'::text NOT NULL,
    reponse_educateur text,
    reponse_date timestamp with time zone,
    inscription_id uuid,
    suivi_token_kid uuid DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    educateur_token uuid DEFAULT gen_random_uuid(),
    educateur_prenom text,
    kid_session_token uuid
);


--
-- Name: gd_stay_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gd_stay_sessions (
    stay_slug text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    seats_left integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    city_departure text,
    price numeric(10,2),
    age_min integer,
    age_max integer,
    import_batch_ts timestamp with time zone DEFAULT now(),
    price_ged numeric,
    is_full boolean DEFAULT false,
    transport_included boolean DEFAULT false,
    CONSTRAINT gd_stay_sessions_dates_check CHECK ((end_date >= start_date))
);


--
-- Name: COLUMN gd_stay_sessions.city_departure; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_stay_sessions.city_departure IS 'Ville de départ du séjour';


--
-- Name: COLUMN gd_stay_sessions.price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_stay_sessions.price IS 'Prix UFOVAL brut (source)';


--
-- Name: COLUMN gd_stay_sessions.age_min; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_stay_sessions.age_min IS 'Âge minimum pour cette session';


--
-- Name: COLUMN gd_stay_sessions.age_max; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_stay_sessions.age_max IS 'Âge maximum pour cette session';


--
-- Name: COLUMN gd_stay_sessions.import_batch_ts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_stay_sessions.import_batch_ts IS 'Timestamp du dernier import n8n';


--
-- Name: COLUMN gd_stay_sessions.price_ged; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_stay_sessions.price_ged IS 'Prix GED final (UFOVAL + markup) - affiché au front';


--
-- Name: COLUMN gd_stay_sessions.is_full; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_stay_sessions.is_full IS 'Session complète (grisée sur UFOVAL). Détecté par scraping n8n.';


--
-- Name: gd_stay_sessions_backup_6jours_ptits_puisotins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gd_stay_sessions_backup_6jours_ptits_puisotins (
    stay_slug text,
    start_date date,
    end_date date,
    seats_left integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    city_departure text,
    price numeric(10,2),
    age_min integer,
    age_max integer,
    import_batch_ts timestamp with time zone,
    price_ged numeric
);


--
-- Name: gd_stay_sessions_backup_8jours_20260217; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gd_stay_sessions_backup_8jours_20260217 (
    stay_slug text,
    start_date date,
    end_date date,
    seats_left integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    city_departure text,
    price numeric(10,2),
    age_min integer,
    age_max integer,
    import_batch_ts timestamp with time zone,
    price_ged numeric
);


--
-- Name: gd_stay_themes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gd_stay_themes (
    stay_slug text NOT NULL,
    theme text NOT NULL
);


--
-- Name: gd_stays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gd_stays (
    slug text NOT NULL,
    title text,
    source_url text,
    published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    title_pro text,
    title_kids text,
    description_pro text,
    description_kids text,
    sessions_json jsonb,
    import_batch_ts timestamp with time zone DEFAULT now(),
    season text,
    location_region text,
    location_city text,
    duration_days integer,
    programme_json jsonb,
    inclusions_json jsonb,
    logistics_json jsonb,
    accroche text,
    programme text,
    pdf_url text,
    centre_name text,
    centre_url text,
    tags jsonb,
    ged_theme text,
    villes_depart jsonb,
    images jsonb,
    age_min integer DEFAULT 6,
    age_max integer DEFAULT 17,
    marketing_title text,
    punchline text,
    expert_pitch text,
    emotion_tag text,
    carousel_group text,
    spot_label text,
    standing_label text,
    expertise_label text,
    intensity_label text,
    price_includes_features jsonb,
    is_full boolean DEFAULT false,
    documents_requis jsonb DEFAULT '["bulletin", "sanitaire", "liaison"]'::jsonb,
    CONSTRAINT gd_stays_season_check CHECK ((season = ANY (ARRAY['Été'::text, 'Hiver'::text, 'Printemps'::text, 'Automne'::text, 'Fin d''année'::text, 'Toutes saisons'::text, 'Année complète'::text])))
);


--
-- Name: COLUMN gd_stays.title_pro; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_stays.title_pro IS 'Titre du séjour destiné aux organisateurs/pros';


--
-- Name: COLUMN gd_stays.title_kids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_stays.title_kids IS 'Titre du séjour destiné aux enfants/familles';


--
-- Name: COLUMN gd_stays.description_pro; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_stays.description_pro IS 'Description destinée aux organisateurs/pros';


--
-- Name: COLUMN gd_stays.description_kids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_stays.description_kids IS 'Description destinée aux enfants/familles';


--
-- Name: COLUMN gd_stays.sessions_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_stays.sessions_json IS 'Archive JSON brute des sessions scrapées depuis UFOVAL';


--
-- Name: COLUMN gd_stays.import_batch_ts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_stays.import_batch_ts IS 'Timestamp du dernier import n8n (permet de tracer les updates)';


--
-- Name: COLUMN gd_stays.season; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_stays.season IS 'Saison de vacances (Été, Hiver, Printemps, Automne, Fin d''année)';


--
-- Name: COLUMN gd_stays.location_region; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_stays.location_region IS 'Région géographique (Alpes, Méditerranée, Paris, etc.)';


--
-- Name: COLUMN gd_stays.location_city; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_stays.location_city IS 'Ville ou lieu précis (Courchevel, Berlin, etc.)';


--
-- Name: COLUMN gd_stays.duration_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_stays.duration_days IS 'Durée du séjour en jours (calculée depuis sessions)';


--
-- Name: COLUMN gd_stays.programme_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_stays.programme_json IS 'Programme détaillé des activités (liste ou objet structuré)';


--
-- Name: COLUMN gd_stays.inclusions_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_stays.inclusions_json IS 'Ce qui est inclus (hébergement, repas, transports, etc.)';


--
-- Name: COLUMN gd_stays.logistics_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_stays.logistics_json IS 'Informations logistiques: lieu, hébergement type, encadrement';


--
-- Name: COLUMN gd_stays.is_full; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gd_stays.is_full IS 'Au moins 1 session complète. Mis à jour par scraping n8n (classe CSS availability-status-full sur pages UFOVAL).';


--
-- Name: gd_structures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gd_structures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain text NOT NULL,
    name text NOT NULL,
    code text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: import_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type character varying(50) NOT NULL,
    total_items integer DEFAULT 0 NOT NULL,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: notification_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type character varying(50) NOT NULL,
    priority character varying(50) NOT NULL,
    recipient character varying(255) NOT NULL,
    subject text,
    payload jsonb,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    sent_at timestamp with time zone,
    error_message text,
    CONSTRAINT notification_queue_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: payment_status_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_status_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inscription_id uuid,
    old_status text,
    new_status text NOT NULL,
    changed_at timestamp with time zone DEFAULT now(),
    note text
);


--
-- Name: sejours_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sejours_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug character varying(255) NOT NULL,
    marketing_title character varying(255) NOT NULL,
    emotion_tag character varying(50) NOT NULL,
    carousel_group character varying(50) NOT NULL,
    age_range character varying(20) NOT NULL,
    source character varying(20) NOT NULL,
    source_id character varying(100) NOT NULL,
    storage_path text NOT NULL,
    public_url text NOT NULL,
    thumbnail_url text,
    photographer_name character varying(255) NOT NULL,
    photographer_url text,
    photographer_portfolio text,
    alt_description text,
    keyword_used character varying(255),
    width integer NOT NULL,
    height integer NOT NULL,
    color character varying(10),
    likes integer DEFAULT 0,
    status character varying(20) DEFAULT 'active'::character varying,
    quality_score integer DEFAULT 5,
    manual_selection boolean DEFAULT false,
    imported_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_used_at timestamp with time zone,
    usage_count integer DEFAULT 0,
    scene_type text,
    prompt_used text,
    CONSTRAINT sejours_images_quality_score_check CHECK (((quality_score >= 1) AND (quality_score <= 10))),
    CONSTRAINT sejours_images_source_check CHECK (((source)::text = ANY ((ARRAY['unsplash'::character varying, 'pexels'::character varying, 'dalle3'::character varying, 'flux1'::character varying])::text[]))),
    CONSTRAINT sejours_images_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'archived'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: TABLE sejours_images; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sejours_images IS 'Stockage des métadonnées des images de séjours collectées depuis Unsplash et Pexels via n8n';


--
-- Name: COLUMN sejours_images.slug; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sejours_images.slug IS 'Référence unique du séjour (ex: moto-moto, annecy-element)';


--
-- Name: COLUMN sejours_images.emotion_tag; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sejours_images.emotion_tag IS 'Tag émotionnel (MÉCANIQUE, AÉRIEN, SURVIE, etc.)';


--
-- Name: COLUMN sejours_images.carousel_group; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sejours_images.carousel_group IS 'Groupe carousel (ADRENALINE_SENSATIONS, ALTITUDE_AVENTURE, etc.)';


--
-- Name: COLUMN sejours_images.quality_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sejours_images.quality_score IS 'Score qualité manuel 1-10, défaut 5';


--
-- Name: COLUMN sejours_images.manual_selection; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sejours_images.manual_selection IS 'TRUE si sélectionné manuellement par équipe';


--
-- Name: COLUMN sejours_images.usage_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sejours_images.usage_count IS 'Nombre de fois où l''image a été affichée';


--
-- Name: smart_form_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.smart_form_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inclusion_level character varying(50),
    child_age integer,
    interests text[],
    urgence_48h boolean DEFAULT false,
    handicap boolean DEFAULT false,
    qf integer,
    qpv boolean DEFAULT false,
    referent_organization character varying(255),
    contact_email character varying(255),
    contact_phone character varying(50),
    suggested_stays jsonb,
    alert_priority character varying(50),
    submitted_at timestamp with time zone DEFAULT now(),
    crm_synced_at timestamp with time zone,
    crm_lead_id character varying(100)
);


--
-- Name: v_orphaned_records; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_orphaned_records WITH (security_invoker='true') AS
 SELECT 'inscription_sans_sejour'::text AS type,
    (i.id)::text AS record_id,
    i.sejour_slug AS ref_value
   FROM (public.gd_inscriptions i
     LEFT JOIN public.gd_stays s ON ((i.sejour_slug = s.slug)))
  WHERE (s.slug IS NULL)
UNION ALL
 SELECT 'session_sans_sejour'::text AS type,
    ss.stay_slug AS record_id,
    ss.stay_slug AS ref_value
   FROM (public.gd_stay_sessions ss
     LEFT JOIN public.gd_stays s ON ((ss.stay_slug = s.slug)))
  WHERE (s.slug IS NULL)
UNION ALL
 SELECT 'prix_sans_sejour'::text AS type,
    sp.stay_slug AS record_id,
    sp.stay_slug AS ref_value
   FROM (public.gd_session_prices sp
     LEFT JOIN public.gd_stays s ON ((sp.stay_slug = s.slug)))
  WHERE (s.slug IS NULL)
UNION ALL
 SELECT 'inscription_session_orpheline'::text AS type,
    (i.id)::text AS record_id,
    ((i.sejour_slug || ' @ '::text) || i.session_date) AS ref_value
   FROM (public.gd_inscriptions i
     LEFT JOIN public.gd_stay_sessions ss ON (((i.sejour_slug = ss.stay_slug) AND (i.session_date = ss.start_date))))
  WHERE ((ss.start_date IS NULL) AND (i.session_date IS NOT NULL));


--
-- Name: v_sejours_images_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_sejours_images_stats WITH (security_invoker='true') AS
 SELECT slug,
    marketing_title,
    carousel_group,
    count(*) AS total_images,
    count(*) FILTER (WHERE ((status)::text = 'active'::text)) AS active_images,
    count(*) FILTER (WHERE ((source)::text = 'unsplash'::text)) AS from_unsplash,
    count(*) FILTER (WHERE ((source)::text = 'pexels'::text)) AS from_pexels,
    avg(quality_score) AS avg_quality,
    max(imported_at) AS last_import_date
   FROM public.sejours_images
  GROUP BY slug, marketing_title, carousel_group
  ORDER BY (count(*)) DESC;


--
-- Name: v_sejours_missing_images; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_sejours_missing_images WITH (security_invoker='true') AS
 WITH expected_sejours AS (
         SELECT DISTINCT gd_stays.slug,
            gd_stays.marketing_title,
            gd_stays.carousel_group
           FROM public.gd_stays
          WHERE (gd_stays.published = true)
        )
 SELECT es.slug,
    es.marketing_title,
    es.carousel_group,
    COALESCE(si.image_count, (0)::bigint) AS current_images,
        CASE
            WHEN (COALESCE(si.image_count, (0)::bigint) = 0) THEN 'CRITICAL'::text
            WHEN (COALESCE(si.image_count, (0)::bigint) < 3) THEN 'LOW'::text
            WHEN (COALESCE(si.image_count, (0)::bigint) < 6) THEN 'MEDIUM'::text
            ELSE 'OK'::text
        END AS priority
   FROM (expected_sejours es
     LEFT JOIN ( SELECT sejours_images.slug,
            count(*) AS image_count
           FROM public.sejours_images
          WHERE ((sejours_images.status)::text = 'active'::text)
          GROUP BY sejours_images.slug) si ON ((es.slug = (si.slug)::text)))
  ORDER BY COALESCE(si.image_count, (0)::bigint), es.slug;


--
-- Name: v_smart_form_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_smart_form_stats WITH (security_invoker='true') AS
 SELECT inclusion_level,
    count(*) AS total_submissions,
    count(*) FILTER (WHERE (urgence_48h = true)) AS urgent_count,
    count(*) FILTER (WHERE (handicap = true)) AS handicap_count,
    count(*) FILTER (WHERE (qpv = true)) AS qpv_count,
    avg(child_age) AS avg_child_age,
    avg(qf) AS avg_qf,
    count(*) FILTER (WHERE (crm_synced_at IS NOT NULL)) AS synced_to_crm,
    max(submitted_at) AS last_submission
   FROM public.smart_form_submissions
  GROUP BY inclusion_level
  ORDER BY (count(*)) DESC;


--
-- Name: v_smart_form_urgent_alerts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_smart_form_urgent_alerts WITH (security_invoker='true') AS
 SELECT id,
    inclusion_level,
    child_age,
    referent_organization,
    contact_email,
    contact_phone,
    alert_priority,
    submitted_at,
    (EXTRACT(epoch FROM (now() - submitted_at)) / (3600)::numeric) AS hours_since_submission
   FROM public.smart_form_submissions
  WHERE (((alert_priority)::text = ANY ((ARRAY['HIGH_PRIORITY_CALL_NOW'::character varying, 'HOT_LEAD'::character varying])::text[])) AND (crm_synced_at IS NULL))
  ORDER BY
        CASE alert_priority
            WHEN 'HIGH_PRIORITY_CALL_NOW'::text THEN 1
            WHEN 'HOT_LEAD'::text THEN 2
            ELSE NULL::integer
        END, submitted_at;


--
-- Name: v_top_sejours_images; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_top_sejours_images WITH (security_invoker='true') AS
 SELECT id,
    slug,
    marketing_title,
    emotion_tag,
    source,
    public_url,
    thumbnail_url,
    photographer_name,
    quality_score,
    usage_count,
    (((quality_score)::numeric * 0.6) + ((LEAST(usage_count, 10))::numeric * 0.4)) AS relevance_score
   FROM public.sejours_images
  WHERE ((status)::text = 'active'::text)
  ORDER BY (((quality_score)::numeric * 0.6) + ((LEAST(usage_count, 10))::numeric * 0.4)) DESC;


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: activity_sessions activity_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_sessions
    ADD CONSTRAINT activity_sessions_pkey PRIMARY KEY (id);


--
-- Name: gd_dossier_enfant gd_dossier_enfant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_dossier_enfant
    ADD CONSTRAINT gd_dossier_enfant_pkey PRIMARY KEY (id);


--
-- Name: gd_educ_options gd_educ_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_educ_options
    ADD CONSTRAINT gd_educ_options_pkey PRIMARY KEY (code);


--
-- Name: gd_inscription_status_logs gd_inscription_status_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_inscription_status_logs
    ADD CONSTRAINT gd_inscription_status_logs_pkey PRIMARY KEY (id);


--
-- Name: gd_inscriptions gd_inscriptions_dossier_ref_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_inscriptions
    ADD CONSTRAINT gd_inscriptions_dossier_ref_key UNIQUE (dossier_ref);


--
-- Name: gd_inscriptions gd_inscriptions_payment_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_inscriptions
    ADD CONSTRAINT gd_inscriptions_payment_reference_key UNIQUE (payment_reference);


--
-- Name: gd_inscriptions gd_inscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_inscriptions
    ADD CONSTRAINT gd_inscriptions_pkey PRIMARY KEY (id);


--
-- Name: gd_processed_events gd_processed_events_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_processed_events
    ADD CONSTRAINT gd_processed_events_event_id_key UNIQUE (event_id);


--
-- Name: gd_processed_events gd_processed_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_processed_events
    ADD CONSTRAINT gd_processed_events_pkey PRIMARY KEY (id);


--
-- Name: gd_propositions_tarifaires gd_propositions_tarifaires_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_propositions_tarifaires
    ADD CONSTRAINT gd_propositions_tarifaires_pkey PRIMARY KEY (id);


--
-- Name: gd_session_prices gd_session_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_session_prices
    ADD CONSTRAINT gd_session_prices_pkey PRIMARY KEY (stay_slug, start_date, end_date, city_departure);


--
-- Name: gd_souhaits gd_souhaits_educateur_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_souhaits
    ADD CONSTRAINT gd_souhaits_educateur_token_key UNIQUE (educateur_token);


--
-- Name: gd_souhaits gd_souhaits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_souhaits
    ADD CONSTRAINT gd_souhaits_pkey PRIMARY KEY (id);


--
-- Name: gd_stay_sessions gd_stay_sessions_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_stay_sessions
    ADD CONSTRAINT gd_stay_sessions_pk PRIMARY KEY (stay_slug, start_date, end_date);


--
-- Name: gd_stay_themes gd_stay_themes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_stay_themes
    ADD CONSTRAINT gd_stay_themes_pkey PRIMARY KEY (stay_slug, theme);


--
-- Name: gd_stays gd_stays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_stays
    ADD CONSTRAINT gd_stays_pkey PRIMARY KEY (slug);


--
-- Name: gd_stays gd_stays_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_stays
    ADD CONSTRAINT gd_stays_slug_unique UNIQUE (slug);


--
-- Name: gd_structures gd_structures_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_structures
    ADD CONSTRAINT gd_structures_code_key UNIQUE (code);


--
-- Name: gd_structures gd_structures_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_structures
    ADD CONSTRAINT gd_structures_domain_key UNIQUE (domain);


--
-- Name: gd_structures gd_structures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_structures
    ADD CONSTRAINT gd_structures_pkey PRIMARY KEY (id);



--
-- Name: import_logs import_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_logs
    ADD CONSTRAINT import_logs_pkey PRIMARY KEY (id);


--
-- Name: notification_queue notification_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_queue
    ADD CONSTRAINT notification_queue_pkey PRIMARY KEY (id);


--
-- Name: payment_status_logs payment_status_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_status_logs
    ADD CONSTRAINT payment_status_logs_pkey PRIMARY KEY (id);


--
-- Name: sejours_images sejours_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sejours_images
    ADD CONSTRAINT sejours_images_pkey PRIMARY KEY (id);


--
-- Name: sejours_images sejours_images_source_source_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sejours_images
    ADD CONSTRAINT sejours_images_source_source_id_key UNIQUE (source, source_id);


--
-- Name: smart_form_submissions smart_form_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_form_submissions
    ADD CONSTRAINT smart_form_submissions_pkey PRIMARY KEY (id);


--
-- Name: gd_session_prices_stay_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gd_session_prices_stay_slug_idx ON public.gd_session_prices USING btree (stay_slug);


--
-- Name: gd_stay_sessions_stay_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gd_stay_sessions_stay_slug_idx ON public.gd_stay_sessions USING btree (stay_slug);


--
-- Name: gd_stays_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gd_stays_published_idx ON public.gd_stays USING btree (published);


--
-- Name: gd_stays_source_url_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX gd_stays_source_url_uidx ON public.gd_stays USING btree (source_url) WHERE (source_url IS NOT NULL);


--
-- Name: gd_stays_source_url_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX gd_stays_source_url_uniq ON public.gd_stays USING btree (source_url) WHERE (source_url IS NOT NULL);


--
-- Name: idx_activities_age; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_age ON public.activities USING btree (age_min, age_max);


--
-- Name: idx_activities_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_category ON public.activities USING btree (category);


--
-- Name: idx_activities_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_status ON public.activities USING btree (status);


--
-- Name: idx_dossier_enfant_inscription; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_dossier_enfant_inscription ON public.gd_dossier_enfant USING btree (inscription_id);


--
-- Name: idx_gd_session_prices_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gd_session_prices_city ON public.gd_session_prices USING btree (city_departure);


--
-- Name: idx_gd_stays_carousel_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gd_stays_carousel_group ON public.gd_stays USING btree (carousel_group);


--
-- Name: idx_gd_stays_is_full; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gd_stays_is_full ON public.gd_stays USING btree (is_full);


--
-- Name: idx_gd_stays_location_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gd_stays_location_region ON public.gd_stays USING btree (location_region) WHERE (location_region IS NOT NULL);


--
-- Name: idx_gd_stays_season; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gd_stays_season ON public.gd_stays USING btree (season) WHERE (season IS NOT NULL);


--
-- Name: idx_gd_stays_season_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gd_stays_season_region ON public.gd_stays USING btree (season, location_region) WHERE ((season IS NOT NULL) AND (location_region IS NOT NULL));


--
-- Name: idx_import_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_logs_created ON public.import_logs USING btree (created_at DESC);


--
-- Name: idx_import_logs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_logs_type ON public.import_logs USING btree (type);


--
-- Name: idx_inscriptions_payment_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inscriptions_payment_reference ON public.gd_inscriptions USING btree (payment_reference);


--
-- Name: idx_inscriptions_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inscriptions_payment_status ON public.gd_inscriptions USING btree (payment_status);


--
-- Name: idx_inscriptions_stripe_intent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inscriptions_stripe_intent ON public.gd_inscriptions USING btree (stripe_payment_intent_id);


--
-- Name: idx_inscriptions_structure_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inscriptions_structure_domain ON public.gd_inscriptions USING btree (structure_domain);


--
-- Name: idx_inscriptions_structure_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inscriptions_structure_id ON public.gd_inscriptions USING btree (structure_id);


--
-- Name: idx_notification_queue_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_queue_priority ON public.notification_queue USING btree (priority, created_at);


--
-- Name: idx_notification_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_queue_status ON public.notification_queue USING btree (status, created_at);


--
-- Name: idx_payment_logs_inscription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_logs_inscription ON public.payment_status_logs USING btree (inscription_id);


--
-- Name: idx_processed_events_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processed_events_event_id ON public.gd_processed_events USING btree (event_id);


--
-- Name: idx_propositions_enfant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_propositions_enfant ON public.gd_propositions_tarifaires USING btree (enfant_nom, enfant_prenom);


--
-- Name: idx_propositions_sejour; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_propositions_sejour ON public.gd_propositions_tarifaires USING btree (sejour_slug);


--
-- Name: idx_propositions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_propositions_status ON public.gd_propositions_tarifaires USING btree (status);


--
-- Name: idx_propositions_structure; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_propositions_structure ON public.gd_propositions_tarifaires USING btree (structure_nom);


--
-- Name: idx_sejours_images_age_range; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sejours_images_age_range ON public.sejours_images USING btree (age_range);


--
-- Name: idx_sejours_images_carousel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sejours_images_carousel ON public.sejours_images USING btree (carousel_group);


--
-- Name: idx_sejours_images_emotion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sejours_images_emotion ON public.sejours_images USING btree (emotion_tag);


--
-- Name: idx_sejours_images_imported; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sejours_images_imported ON public.sejours_images USING btree (imported_at DESC);


--
-- Name: idx_sejours_images_quality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sejours_images_quality ON public.sejours_images USING btree (quality_score DESC);


--
-- Name: idx_sejours_images_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sejours_images_slug ON public.sejours_images USING btree (slug);


--
-- Name: idx_sejours_images_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sejours_images_source ON public.sejours_images USING btree (source, source_id);


--
-- Name: idx_sejours_images_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sejours_images_status ON public.sejours_images USING btree (status);


--
-- Name: idx_sessions_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_activity ON public.activity_sessions USING btree (activity_id);


--
-- Name: idx_sessions_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_dates ON public.activity_sessions USING btree (start_date, end_date);


--
-- Name: idx_smart_form_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_smart_form_level ON public.smart_form_submissions USING btree (inclusion_level);


--
-- Name: idx_smart_form_submitted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_smart_form_submitted ON public.smart_form_submissions USING btree (submitted_at DESC);


--
-- Name: idx_smart_form_urgence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_smart_form_urgence ON public.smart_form_submissions USING btree (urgence_48h) WHERE (urgence_48h = true);


--
-- Name: idx_souhaits_educateur_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_souhaits_educateur_email ON public.gd_souhaits USING btree (educateur_email);


--
-- Name: idx_souhaits_educateur_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_souhaits_educateur_token ON public.gd_souhaits USING btree (educateur_token);


--
-- Name: idx_souhaits_kid_session_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_souhaits_kid_session_token ON public.gd_souhaits USING btree (kid_session_token);


--
-- Name: idx_souhaits_sejour_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_souhaits_sejour_slug ON public.gd_souhaits USING btree (sejour_slug);


--
-- Name: idx_souhaits_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_souhaits_status ON public.gd_souhaits USING btree (status);


--
-- Name: idx_souhaits_structure_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_souhaits_structure_id ON public.gd_souhaits USING btree (structure_id);


--
-- Name: idx_souhaits_suivi_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_souhaits_suivi_token ON public.gd_souhaits USING btree (suivi_token_kid);


--
-- Name: idx_status_logs_inscription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_status_logs_inscription ON public.gd_inscription_status_logs USING btree (inscription_id);


--
-- Name: idx_structures_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_structures_domain ON public.gd_structures USING btree (domain);


--
-- Name: uniq_gd_stay_sessions_slug_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_gd_stay_sessions_slug_dates ON public.gd_stay_sessions USING btree (stay_slug, start_date, end_date);


--
-- Name: INDEX uniq_gd_stay_sessions_slug_dates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.uniq_gd_stay_sessions_slug_dates IS 'Empêche les doublons de sessions : même stay + mêmes dates = upsert au lieu de insert';


--
-- Name: uniq_gd_stays_source_url; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_gd_stays_source_url ON public.gd_stays USING btree (source_url) WHERE (source_url IS NOT NULL);


--
-- Name: INDEX uniq_gd_stays_source_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.uniq_gd_stays_source_url IS 'Empêche les doublons de stays : même source_url = upsert au lieu de insert';


--
-- Name: v_activity_with_sessions _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.v_activity_with_sessions WITH (security_invoker='true') AS
 SELECT a.id,
    a.title,
    a.category,
    a.tags,
    a.age_min,
    a.age_max,
    a.location_name,
    a.location_region,
    a.period_type,
    a.vacation_periods,
    a.short_description,
    a.description,
    a.program_brief,
    a.program_detailed,
    a.accommodation,
    a.supervision,
    a.pro_price_note,
    a.status,
    a.source_url,
    a.created_at,
    a.updated_at,
    COALESCE(json_agg(json_build_object('id', s.id, 'start_date', s.start_date, 'end_date', s.end_date, 'capacity_remaining', s.capacity_remaining, 'capacity_total', s.capacity_total, 'price_base', s.price_base, 'price_unit', s.price_unit, 'status', s.status) ORDER BY s.start_date) FILTER (WHERE (s.id IS NOT NULL)), '[]'::json) AS sessions
   FROM (public.activities a
     LEFT JOIN public.activity_sessions s ON ((s.activity_id = a.id)))
  GROUP BY a.id;


--
-- Name: gd_inscriptions set_payment_reference; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_payment_reference BEFORE INSERT ON public.gd_inscriptions FOR EACH ROW EXECUTE FUNCTION public.generate_payment_reference();


--
-- Name: activities trg_activities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_activities_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: gd_dossier_enfant trg_dossier_enfant_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dossier_enfant_updated_at BEFORE UPDATE ON public.gd_dossier_enfant FOR EACH ROW EXECUTE FUNCTION public.update_dossier_enfant_updated_at();


--
-- Name: gd_inscriptions trg_inscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inscriptions_updated_at BEFORE UPDATE ON public.gd_inscriptions FOR EACH ROW EXECUTE FUNCTION public.set_inscriptions_updated_at();


--
-- Name: activities trg_reject_dates_prices_activities; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reject_dates_prices_activities BEFORE INSERT OR UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.reject_dates_prices_in_editorial();


--
-- Name: gd_session_prices trg_session_prices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_session_prices_updated_at BEFORE UPDATE ON public.gd_session_prices FOR EACH ROW EXECUTE FUNCTION public.set_session_prices_updated_at();


--
-- Name: activity_sessions trg_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sessions_updated_at BEFORE UPDATE ON public.activity_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: gd_souhaits trg_souhaits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_souhaits_updated_at BEFORE UPDATE ON public.gd_souhaits FOR EACH ROW EXECUTE FUNCTION public.set_inscriptions_updated_at();


--
-- Name: gd_structures trg_structures_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_structures_updated_at BEFORE UPDATE ON public.gd_structures FOR EACH ROW EXECUTE FUNCTION public.set_structures_updated_at();


--
-- Name: smart_form_submissions trigger_notify_urgent_submission; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_notify_urgent_submission AFTER INSERT ON public.smart_form_submissions FOR EACH ROW EXECUTE FUNCTION public.notify_urgent_submission();


--
-- Name: gd_propositions_tarifaires trigger_propositions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_propositions_updated_at BEFORE UPDATE ON public.gd_propositions_tarifaires FOR EACH ROW EXECUTE FUNCTION public.update_propositions_updated_at();


--
-- Name: sejours_images trigger_sejours_images_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sejours_images_updated_at BEFORE UPDATE ON public.sejours_images FOR EACH ROW EXECUTE FUNCTION public.update_sejours_images_updated_at();


--
-- Name: gd_inscriptions trigger_set_payment_reference; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_set_payment_reference BEFORE INSERT ON public.gd_inscriptions FOR EACH ROW EXECUTE FUNCTION public.set_payment_reference();


--
-- Name: activity_sessions activity_sessions_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_sessions
    ADD CONSTRAINT activity_sessions_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;


--
-- Name: gd_inscriptions fk_inscriptions_stay; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_inscriptions
    ADD CONSTRAINT fk_inscriptions_stay FOREIGN KEY (sejour_slug) REFERENCES public.gd_stays(slug);


--
-- Name: gd_session_prices fk_session_prices_stay; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_session_prices
    ADD CONSTRAINT fk_session_prices_stay FOREIGN KEY (stay_slug) REFERENCES public.gd_stays(slug);


--
-- Name: gd_stay_sessions fk_stay_sessions_stay; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_stay_sessions
    ADD CONSTRAINT fk_stay_sessions_stay FOREIGN KEY (stay_slug) REFERENCES public.gd_stays(slug);


--
-- Name: gd_dossier_enfant gd_dossier_enfant_inscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_dossier_enfant
    ADD CONSTRAINT gd_dossier_enfant_inscription_id_fkey FOREIGN KEY (inscription_id) REFERENCES public.gd_inscriptions(id) ON DELETE CASCADE;


--
-- Name: gd_inscription_status_logs gd_inscription_status_logs_inscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_inscription_status_logs
    ADD CONSTRAINT gd_inscription_status_logs_inscription_id_fkey FOREIGN KEY (inscription_id) REFERENCES public.gd_inscriptions(id) ON DELETE CASCADE;


--
-- Name: gd_inscriptions gd_inscriptions_sejour_slug_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_inscriptions
    ADD CONSTRAINT gd_inscriptions_sejour_slug_fkey FOREIGN KEY (sejour_slug) REFERENCES public.gd_stays(slug);


--
-- Name: gd_inscriptions gd_inscriptions_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_inscriptions
    ADD CONSTRAINT gd_inscriptions_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.gd_structures(id);


--
-- Name: gd_propositions_tarifaires gd_propositions_tarifaires_inscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_propositions_tarifaires
    ADD CONSTRAINT gd_propositions_tarifaires_inscription_id_fkey FOREIGN KEY (inscription_id) REFERENCES public.gd_inscriptions(id) ON DELETE SET NULL;


--
-- Name: gd_propositions_tarifaires gd_propositions_tarifaires_sejour_slug_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_propositions_tarifaires
    ADD CONSTRAINT gd_propositions_tarifaires_sejour_slug_fkey FOREIGN KEY (sejour_slug) REFERENCES public.gd_stays(slug);


--
-- Name: gd_session_prices gd_session_prices_stay_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_session_prices
    ADD CONSTRAINT gd_session_prices_stay_fk FOREIGN KEY (stay_slug) REFERENCES public.gd_stays(slug) ON DELETE CASCADE;


--
-- Name: gd_souhaits gd_souhaits_inscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_souhaits
    ADD CONSTRAINT gd_souhaits_inscription_id_fkey FOREIGN KEY (inscription_id) REFERENCES public.gd_inscriptions(id);


--
-- Name: gd_souhaits gd_souhaits_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_souhaits
    ADD CONSTRAINT gd_souhaits_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.gd_structures(id);


--
-- Name: gd_stay_sessions gd_stay_sessions_stay_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_stay_sessions
    ADD CONSTRAINT gd_stay_sessions_stay_fk FOREIGN KEY (stay_slug) REFERENCES public.gd_stays(slug) ON DELETE CASCADE;


--
-- Name: gd_stay_themes gd_stay_themes_stay_slug_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gd_stay_themes
    ADD CONSTRAINT gd_stay_themes_stay_slug_fkey FOREIGN KEY (stay_slug) REFERENCES public.gd_stays(slug) ON DELETE CASCADE;



--
-- Name: payment_status_logs payment_status_logs_inscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_status_logs
    ADD CONSTRAINT payment_status_logs_inscription_id_fkey FOREIGN KEY (inscription_id) REFERENCES public.gd_inscriptions(id) ON DELETE CASCADE;


--
-- Name: gd_stays Insert gd_stays public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Insert gd_stays public" ON public.gd_stays FOR INSERT WITH CHECK (((slug IS NOT NULL) AND (slug <> ''::text) AND (source_url IS NOT NULL) AND (source_url <> ''::text)));



--
-- Name: gd_educ_options Lecture publique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture publique" ON public.gd_educ_options FOR SELECT USING (true);


--
-- Name: gd_session_prices Lecture publique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture publique" ON public.gd_session_prices FOR SELECT USING (true);


--
-- Name: gd_stay_sessions Lecture publique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture publique" ON public.gd_stay_sessions FOR SELECT USING (true);


--
-- Name: gd_stay_themes Lecture publique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture publique" ON public.gd_stay_themes FOR SELECT USING (true);


--
-- Name: gd_stays Lecture publique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture publique" ON public.gd_stays FOR SELECT USING (true);



--
-- Name: gd_dossier_enfant Service role full access on dossier_enfant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access on dossier_enfant" ON public.gd_dossier_enfant TO service_role USING (true) WITH CHECK (true);


--
-- Name: gd_inscriptions Service role full access on inscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access on inscriptions" ON public.gd_inscriptions TO service_role USING (true) WITH CHECK (true);


--
-- Name: gd_propositions_tarifaires Service role full access on propositions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access on propositions" ON public.gd_propositions_tarifaires USING (true) WITH CHECK (true);


--
-- Name: gd_inscription_status_logs Service role only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role only" ON public.gd_inscription_status_logs USING ((auth.role() = 'service_role'::text));


--
-- Name: gd_processed_events Service role only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role only" ON public.gd_processed_events USING ((auth.role() = 'service_role'::text));


--
-- Name: gd_stays Update gd_stays public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Update gd_stays public" ON public.gd_stays FOR UPDATE USING (true) WITH CHECK (((slug IS NOT NULL) AND (slug <> ''::text)));


--
-- Name: activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: gd_structures anon_read_structures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_read_structures ON public.gd_structures FOR SELECT USING (true);


--
-- Name: sejours_images auth_read_images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auth_read_images ON public.sejours_images FOR SELECT TO authenticated USING (true);


--
-- Name: gd_dossier_enfant; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gd_dossier_enfant ENABLE ROW LEVEL SECURITY;

--
-- Name: gd_educ_options; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gd_educ_options ENABLE ROW LEVEL SECURITY;

--
-- Name: gd_inscription_status_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gd_inscription_status_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: gd_inscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gd_inscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: gd_processed_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gd_processed_events ENABLE ROW LEVEL SECURITY;

--
-- Name: gd_propositions_tarifaires; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gd_propositions_tarifaires ENABLE ROW LEVEL SECURITY;

--
-- Name: gd_session_prices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gd_session_prices ENABLE ROW LEVEL SECURITY;

--
-- Name: gd_session_prices_backup_align_enddate_2026_02_22; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gd_session_prices_backup_align_enddate_2026_02_22 ENABLE ROW LEVEL SECURITY;

--
-- Name: gd_souhaits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gd_souhaits ENABLE ROW LEVEL SECURITY;

--
-- Name: gd_stay_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gd_stay_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: gd_stay_sessions_backup_6jours_ptits_puisotins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gd_stay_sessions_backup_6jours_ptits_puisotins ENABLE ROW LEVEL SECURITY;

--
-- Name: gd_stay_sessions_backup_8jours_20260217; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gd_stay_sessions_backup_8jours_20260217 ENABLE ROW LEVEL SECURITY;

--
-- Name: gd_stay_themes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gd_stay_themes ENABLE ROW LEVEL SECURITY;

--
-- Name: gd_stays; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gd_stays ENABLE ROW LEVEL SECURITY;

--
-- Name: gd_structures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gd_structures ENABLE ROW LEVEL SECURITY;


--
-- Name: import_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_status_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_status_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: sejours_images public_read_images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_images ON public.sejours_images FOR SELECT TO anon USING (true);


--
-- Name: activities public_read_published_activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_published_activities ON public.activities FOR SELECT USING ((status = 'published'::text));


--
-- Name: activity_sessions public_read_sessions_for_published; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_sessions_for_published ON public.activity_sessions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.activities a
  WHERE ((a.id = activity_sessions.activity_id) AND (a.status = 'published'::text)))));


--
-- Name: sejours_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sejours_images ENABLE ROW LEVEL SECURITY;

--
-- Name: gd_souhaits service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.gd_souhaits USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: gd_structures service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.gd_structures USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: smart_form_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.smart_form_submissions ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict E2qZBBTHJfOJCx2P4qf6h0VN639fcUr0AanPGtAGISOIjYegucq0L4FVNkw23SW

