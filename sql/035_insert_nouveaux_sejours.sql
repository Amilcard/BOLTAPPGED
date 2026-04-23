-- ============================================================
-- Migration 035 — Insertion des 3 nouveaux séjours GED
-- atlantic-surf-sessions, high-ranch-experience, lake-sky-extreme
-- Cohérent avec la structure gd_stays + gd_session_prices + gd_stay_sessions
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ATLANTIC SURF SESSIONS (= Splash Aventures UFOVAL)
-- ============================================================

INSERT INTO gd_stays (
  slug, title, marketing_title, source_url, published,
  title_pro, title_kids,
  description_pro, description_kids,
  accroche, punchline, expert_pitch,
  age_min, age_max, duration_days, season,
  location_region, location_city, centre_name,
  carousel_group, ged_theme, emotion_tag,
  spot_label, standing_label, expertise_label, intensity_label,
  programme, programme_json, inclusions_json, logistics_json,
  tags, price_includes_features,
  documents_requis, is_full
) VALUES (
  'atlantic-surf-sessions',
  'Atlantic Surf Sessions – Surf & Glisse à Oléron',
  'ATLANTIC SURF SESSIONS',
  'https://ufoval.fol74.org/sejours-colonies-de-vacances-a-locean/splash-aventures',
  true,
  'Atlantic Surf Sessions – Surf, kayak et glisse sur l''Île d''Oléron (12-14 ans)',
  'Atlantic Surf Sessions',
  'Un séjour aquatique et sportif sur l''Île d''Oléron. Surf encadré, kayak, bouée tractée et baignades sur plages surveillées. Encadrement renforcé 1/10, hébergement confort au Moulin d''Oléron.',
  'L''Atlantique, ça se respecte… et ici, ça se ride. Entre surf, kayak et bouée tractée, tu passes ton été dans l''eau ou au soleil. Plages surveillées, piscine, ambiance été à fond.',
  'L''Atlantique, ça se ride. Surf, kayak et bouée tractée sur l''Île d''Oléron.',
  'Surf, océan, sensations',
  'Oléron, c''est l''été à l''état pur. Des vagues pour surfer, une baie pour pagayer, une piscine pour se poser — et une équipe qui fait du sport un terrain de jeu. Ce séjour glisse ne s''arrête jamais.',
  12, 14, 21, 'Été',
  'Nouvelle-Aquitaine', 'Île d''Oléron', 'Le Moulin d''Oléron',
  'ADRENALINE_SENSATIONS', 'Mer & Surf', 'LIBERTÉ',
  'Île d''Oléron', 'Confort', 'Moniteurs fédéraux surf', 'Modérée → Élevée',
  'Surf (2 à 4 séances encadrées)
Kayak en mer
Bouée tractée
Paintball (séjours 21j)
Baignades & jeux de plage',
  '["Surf (2 à 4 séances)", "Kayak en mer", "Bouée tractée", "Paintball (21j)", "Baignades & jeux"]'::jsonb,
  '["Hébergement en centre (chambres 2-6 lits)", "Pension complète", "Activités encadrées", "Transport aller-retour", "Assurance"]'::jsonb,
  '{"centre": "Le Moulin d''Oléron", "chambres": "2 à 6 lits", "piscine": true, "plages": "Plages surveillées à proximité", "encadrement": "1 animateur pour 10-12 jeunes", "transport": "Train ou car jusqu''à Oléron, transfert encadré"}'::jsonb,
  '["mer", "surf", "kayak", "glisse", "océan", "ado", "oléron", "nautique"]'::jsonb,
  '["Surf encadré par moniteurs fédéraux", "Plages surveillées", "Ambiance été garantie"]'::jsonb,
  '["bulletin", "sanitaire", "liaison", "pass_nautique"]'::jsonb,
  false
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  marketing_title = EXCLUDED.marketing_title,
  source_url = EXCLUDED.source_url,
  published = EXCLUDED.published,
  title_pro = EXCLUDED.title_pro,
  title_kids = EXCLUDED.title_kids,
  description_pro = EXCLUDED.description_pro,
  description_kids = EXCLUDED.description_kids,
  accroche = EXCLUDED.accroche,
  punchline = EXCLUDED.punchline,
  expert_pitch = EXCLUDED.expert_pitch,
  age_min = EXCLUDED.age_min,
  age_max = EXCLUDED.age_max,
  duration_days = EXCLUDED.duration_days,
  location_region = EXCLUDED.location_region,
  location_city = EXCLUDED.location_city,
  centre_name = EXCLUDED.centre_name,
  carousel_group = EXCLUDED.carousel_group,
  ged_theme = EXCLUDED.ged_theme,
  emotion_tag = EXCLUDED.emotion_tag,
  spot_label = EXCLUDED.spot_label,
  standing_label = EXCLUDED.standing_label,
  expertise_label = EXCLUDED.expertise_label,
  intensity_label = EXCLUDED.intensity_label,
  programme = EXCLUDED.programme,
  programme_json = EXCLUDED.programme_json,
  inclusions_json = EXCLUDED.inclusions_json,
  logistics_json = EXCLUDED.logistics_json,
  tags = EXCLUDED.tags,
  price_includes_features = EXCLUDED.price_includes_features,
  documents_requis = EXCLUDED.documents_requis,
  updated_at = now();

-- Sessions gd_stay_sessions
INSERT INTO gd_stay_sessions (stay_slug, start_date, end_date, is_full, seats_left)
VALUES
  ('atlantic-surf-sessions', '2026-07-08', '2026-07-14', false, null),
  ('atlantic-surf-sessions', '2026-07-15', '2026-07-21', false, null),
  ('atlantic-surf-sessions', '2026-07-22', '2026-07-28', false, null),
  ('atlantic-surf-sessions', '2026-08-03', '2026-08-09', false, null),
  ('atlantic-surf-sessions', '2026-08-10', '2026-08-16', false, null),
  ('atlantic-surf-sessions', '2026-08-17', '2026-08-23', false, null),
  ('atlantic-surf-sessions', '2026-07-08', '2026-07-21', false, null),
  ('atlantic-surf-sessions', '2026-08-10', '2026-08-23', false, null),
  ('atlantic-surf-sessions', '2026-07-08', '2026-07-28', false, null),
  ('atlantic-surf-sessions', '2026-08-03', '2026-08-23', false, null)
ON CONFLICT (stay_slug, start_date, end_date) DO NOTHING;

-- Prix gd_session_prices (sans_transport)
INSERT INTO gd_session_prices (stay_slug, start_date, end_date, city_departure, base_price_eur, price_ged_total, transport_surcharge_ged, is_full)
VALUES
  ('atlantic-surf-sessions', '2026-07-08', '2026-07-14', 'sans_transport', 710, 890, 0, false),
  ('atlantic-surf-sessions', '2026-07-15', '2026-07-21', 'sans_transport', 710, 890, 0, false),
  ('atlantic-surf-sessions', '2026-07-22', '2026-07-28', 'sans_transport', 710, 890, 0, false),
  ('atlantic-surf-sessions', '2026-08-03', '2026-08-09', 'sans_transport', 710, 890, 0, false),
  ('atlantic-surf-sessions', '2026-08-10', '2026-08-16', 'sans_transport', 710, 890, 0, false),
  ('atlantic-surf-sessions', '2026-08-17', '2026-08-23', 'sans_transport', 710, 890, 0, false),
  ('atlantic-surf-sessions', '2026-07-08', '2026-07-21', 'sans_transport', 1340, 1580, 0, false),
  ('atlantic-surf-sessions', '2026-08-10', '2026-08-23', 'sans_transport', 1340, 1580, 0, false),
  ('atlantic-surf-sessions', '2026-07-08', '2026-07-28', 'sans_transport', 1860, 2270, 0, false),
  ('atlantic-surf-sessions', '2026-08-03', '2026-08-23', 'sans_transport', 1860, 2270, 0, false),
  -- Paris
  ('atlantic-surf-sessions', '2026-07-08', '2026-07-14', 'paris', 710, 890, 0, false),
  ('atlantic-surf-sessions', '2026-07-15', '2026-07-21', 'paris', 710, 890, 0, false),
  ('atlantic-surf-sessions', '2026-07-22', '2026-07-28', 'paris', 710, 890, 0, false),
  ('atlantic-surf-sessions', '2026-08-03', '2026-08-09', 'paris', 710, 890, 0, false),
  ('atlantic-surf-sessions', '2026-08-10', '2026-08-16', 'paris', 710, 890, 0, false),
  ('atlantic-surf-sessions', '2026-08-17', '2026-08-23', 'paris', 710, 890, 0, false),
  ('atlantic-surf-sessions', '2026-07-08', '2026-07-21', 'paris', 1340, 1580, 0, false),
  ('atlantic-surf-sessions', '2026-08-10', '2026-08-23', 'paris', 1340, 1580, 0, false),
  ('atlantic-surf-sessions', '2026-07-08', '2026-07-28', 'paris', 1860, 2270, 0, false),
  ('atlantic-surf-sessions', '2026-08-03', '2026-08-23', 'paris', 1860, 2270, 0, false)
ON CONFLICT (stay_slug, start_date, end_date, city_departure) DO NOTHING;


-- ============================================================
-- 2. HIGH RANCH EXPERIENCE (= Les Chev'aulps du Roc d'Enfer)
-- ============================================================

INSERT INTO gd_stays (
  slug, title, marketing_title, source_url, published,
  title_pro, title_kids,
  description_pro, description_kids,
  accroche, punchline, expert_pitch,
  age_min, age_max, duration_days, season,
  location_region, location_city, centre_name,
  carousel_group, ged_theme, emotion_tag,
  spot_label, standing_label, expertise_label, intensity_label,
  programme, programme_json, inclusions_json, logistics_json,
  tags, price_includes_features,
  documents_requis, is_full
) VALUES (
  'high-ranch-experience',
  'High Ranch Experience – Équitation & Nature en Vallée d''Aulps',
  'HIGH RANCH EXPERIENCE',
  'https://ufoval.fol74.org/sejours-colonies-de-vacances-a-la-montagne/les-chevaulps-du-roc-denfer-1',
  true,
  'High Ranch Experience – Équitation, forêt et bivouac en Haute-Savoie (8-15 ans)',
  'High Ranch Experience',
  'Séjour nature et équitation en Vallée d''Aulps. 5 séances d''équitation par semaine encadrées par des professionnels qualifiés, randonnées, tir à l''arc et bivouac pour les 14j. Cadre alpin, piscine, chambres 2 lits.',
  'Ici, pas de faux ranch. Tu vis au rythme des chevaux, des sentiers et de la montagne. Entre équitation, forêt et bivouac, tu gagnes en confiance tout en profitant d''un été nature, intense et dépaysant.',
  'Vis au rythme des chevaux, des sentiers et de la montagne en Vallée d''Aulps.',
  'Chevaux, forêt, montagne',
  'La Vallée d''Aulps, c''est la montagne version ranch. Des chevaux à soigner le matin, des sentiers à explorer l''après-midi, et une nuit sous les étoiles pour les plus courageux. Un séjour qui construit la confiance en soi.',
  8, 15, 14, 'Été',
  'Haute-Savoie', 'Isle d''Aulps', 'Centre Roc d''Enfer',
  'AVENTURE_DECOUVERTE', 'Nature & Équitation', 'CONFIANCE',
  'Vallée d''Aulps', 'Confort', 'Encadrants équitation qualifiés', 'Modérée',
  'Équitation (5 séances / semaine)
Balades en forêt encadrées
Tir à l''arc
Randonnées en montagne
Nuit sous tente (séjours 14j)',
  '["Équitation (5 séances/semaine)", "Balades en forêt", "Tir à l''arc", "Randonnées", "Bivouac (14j)"]'::jsonb,
  '["Hébergement en centre (chambres 2 lits)", "Pension complète", "Activités encadrées", "Transport aller-retour", "Assurance"]'::jsonb,
  '{"centre": "Centre Roc d''Enfer, Isle d''Aulps", "chambres": "2 lits", "piscine": true, "environnement": "Montagnes, lacs et panoramas alpins", "encadrement": "1 animateur pour 12 jeunes + encadrants équitation qualifiés", "transport": "Train ou car jusqu''à Annecy puis transfert vers le centre"}'::jsonb,
  '["montagne", "équitation", "nature", "cheval", "forêt", "alpes", "bivouac", "haute-savoie"]'::jsonb,
  '["Équitation professionnelle 5x/semaine", "Cadre alpin exceptionnel", "Confiance et autonomie"]'::jsonb,
  '["bulletin", "sanitaire", "liaison"]'::jsonb,
  false
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  marketing_title = EXCLUDED.marketing_title,
  source_url = EXCLUDED.source_url,
  published = EXCLUDED.published,
  title_pro = EXCLUDED.title_pro,
  title_kids = EXCLUDED.title_kids,
  description_pro = EXCLUDED.description_pro,
  description_kids = EXCLUDED.description_kids,
  accroche = EXCLUDED.accroche,
  punchline = EXCLUDED.punchline,
  expert_pitch = EXCLUDED.expert_pitch,
  age_min = EXCLUDED.age_min,
  age_max = EXCLUDED.age_max,
  duration_days = EXCLUDED.duration_days,
  location_region = EXCLUDED.location_region,
  location_city = EXCLUDED.location_city,
  centre_name = EXCLUDED.centre_name,
  carousel_group = EXCLUDED.carousel_group,
  ged_theme = EXCLUDED.ged_theme,
  emotion_tag = EXCLUDED.emotion_tag,
  spot_label = EXCLUDED.spot_label,
  standing_label = EXCLUDED.standing_label,
  expertise_label = EXCLUDED.expertise_label,
  intensity_label = EXCLUDED.intensity_label,
  programme = EXCLUDED.programme,
  programme_json = EXCLUDED.programme_json,
  inclusions_json = EXCLUDED.inclusions_json,
  logistics_json = EXCLUDED.logistics_json,
  tags = EXCLUDED.tags,
  price_includes_features = EXCLUDED.price_includes_features,
  documents_requis = EXCLUDED.documents_requis,
  updated_at = now();

-- Sessions gd_stay_sessions (avec is_full réel depuis UFOVAL)
INSERT INTO gd_stay_sessions (stay_slug, start_date, end_date, is_full, seats_left)
VALUES
  ('high-ranch-experience', '2026-07-05', '2026-07-11', false, null),
  ('high-ranch-experience', '2026-07-12', '2026-07-18', true,  0),
  ('high-ranch-experience', '2026-07-19', '2026-07-25', true,  0),
  ('high-ranch-experience', '2026-07-26', '2026-08-01', false, null),
  ('high-ranch-experience', '2026-08-02', '2026-08-08', true,  0),
  ('high-ranch-experience', '2026-08-09', '2026-08-15', true,  0),
  ('high-ranch-experience', '2026-08-16', '2026-08-22', true,  0),
  ('high-ranch-experience', '2026-07-05', '2026-07-18', true,  0),
  ('high-ranch-experience', '2026-07-19', '2026-08-01', true,  0),
  ('high-ranch-experience', '2026-08-02', '2026-08-15', true,  0)
ON CONFLICT (stay_slug, start_date, end_date) DO NOTHING;

-- Prix gd_session_prices
INSERT INTO gd_session_prices (stay_slug, start_date, end_date, city_departure, base_price_eur, price_ged_total, transport_surcharge_ged, is_full)
VALUES
  ('high-ranch-experience', '2026-07-05', '2026-07-11', 'sans_transport', 775, 955, 0, false),
  ('high-ranch-experience', '2026-07-12', '2026-07-18', 'sans_transport', 775, 955, 0, true),
  ('high-ranch-experience', '2026-07-19', '2026-07-25', 'sans_transport', 775, 955, 0, true),
  ('high-ranch-experience', '2026-07-26', '2026-08-01', 'sans_transport', 775, 955, 0, false),
  ('high-ranch-experience', '2026-08-02', '2026-08-08', 'sans_transport', 775, 955, 0, true),
  ('high-ranch-experience', '2026-08-09', '2026-08-15', 'sans_transport', 775, 955, 0, true),
  ('high-ranch-experience', '2026-08-16', '2026-08-22', 'sans_transport', 775, 955, 0, true),
  ('high-ranch-experience', '2026-07-05', '2026-07-18', 'sans_transport', 1375, 1615, 0, true),
  ('high-ranch-experience', '2026-07-19', '2026-08-01', 'sans_transport', 1375, 1615, 0, true),
  ('high-ranch-experience', '2026-08-02', '2026-08-15', 'sans_transport', 1375, 1615, 0, true)
ON CONFLICT (stay_slug, start_date, end_date, city_departure) DO NOTHING;


-- ============================================================
-- 3. LAKE & SKY EXTREME (= Combiné Sensations Air et Lac à Annecy)
-- ============================================================

INSERT INTO gd_stays (
  slug, title, marketing_title, source_url, published,
  title_pro, title_kids,
  description_pro, description_kids,
  accroche, punchline, expert_pitch,
  age_min, age_max, duration_days, season,
  location_region, location_city, centre_name,
  carousel_group, ged_theme, emotion_tag,
  spot_label, standing_label, expertise_label, intensity_label,
  programme, programme_json, inclusions_json, logistics_json,
  tags, price_includes_features,
  documents_requis, is_full
) VALUES (
  'lake-sky-extreme',
  'Lake & Sky Extreme – Wakeboard, Canyoning & Parapente à Annecy',
  'LAKE & SKY EXTREME',
  'https://ufoval.fol74.org/sejours-colonies-de-vacances-a-la-montagne/combine-sensations-air-et-lac-a-annecy?av=1084',
  true,
  'Lake & Sky Extreme – Wakeboard, canyoning et option parapente au Lac d''Annecy (12-17 ans)',
  'Lake & Sky Extreme',
  'Séjour multi-activités extrêmes au Lac d''Annecy. Wakeboard, canyoning encadré par guide diplômé, option parapente. Internat de Poisy, chambres 2 lits, à 10 min du lac. Encadrement 1/12.',
  'Entre lac et sommets, tu passes en mode action. Wakeboard pour glisser, canyoning pour sauter, et pour les plus chauds, option parapente. Un mix eau + montagne pour un séjour qui ne s''arrête jamais.',
  'Entre lac et sommets, tu passes en mode action totale.',
  'Lac, ciel, sensations extrêmes',
  'Le Lac d''Annecy d''un côté, le Grand Massif de l''autre. On wakeboard le matin, on saute des cascades l''après-midi, et pour les plus courageux, on vole le week-end. Lake & Sky Extreme, c''est le séjour qui fait tout en grand.',
  12, 17, 21, 'Été',
  'Haute-Savoie', 'Annecy', 'Internat de Poisy',
  'ADRENALINE_SENSATIONS', 'Lac & Montagne', 'DÉFI',
  'Lac d''Annecy', 'Confort', 'Guide diplômé canyoning + moniteurs', 'Élevée',
  'Wakeboard (2 séances – séjours 14j)
Canyoning encadré par guide diplômé
Parapente en option
Baignades en lac surveillé
Jeux & veillées',
  '["Wakeboard (2 séances/14j)", "Canyoning encadré", "Parapente (option)", "Baignades lac", "Veillées"]'::jsonb,
  '["Hébergement internat (chambres 2 lits)", "Pension complète", "Activités encadrées", "Guide diplômé canyoning", "Transport aller-retour", "Assurance"]'::jsonb,
  '{"centre": "Internat de Poisy, Annecy", "chambres": "2 lits", "lac": "10 min du Lac d''Annecy", "environnement": "Lac d''Annecy et Grand Massif", "encadrement": "1 animateur pour 12 jeunes + guide diplômé canyoning", "transport": "Train ou car jusqu''à Annecy puis transfert"}'::jsonb,
  '["lac", "montagne", "wakeboard", "canyoning", "parapente", "extrême", "annecy", "ado", "haute-savoie"]'::jsonb,
  '["Canyoning avec guide diplômé", "Option parapente unique", "Lac d''Annecy cadre exceptionnel"]'::jsonb,
  '["bulletin", "sanitaire", "liaison", "pass_nautique", "autorisation_parentale", "certificat_medical", "attestation_assurance"]'::jsonb,
  false
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  marketing_title = EXCLUDED.marketing_title,
  source_url = EXCLUDED.source_url,
  published = EXCLUDED.published,
  title_pro = EXCLUDED.title_pro,
  title_kids = EXCLUDED.title_kids,
  description_pro = EXCLUDED.description_pro,
  description_kids = EXCLUDED.description_kids,
  accroche = EXCLUDED.accroche,
  punchline = EXCLUDED.punchline,
  expert_pitch = EXCLUDED.expert_pitch,
  age_min = EXCLUDED.age_min,
  age_max = EXCLUDED.age_max,
  duration_days = EXCLUDED.duration_days,
  location_region = EXCLUDED.location_region,
  location_city = EXCLUDED.location_city,
  centre_name = EXCLUDED.centre_name,
  carousel_group = EXCLUDED.carousel_group,
  ged_theme = EXCLUDED.ged_theme,
  emotion_tag = EXCLUDED.emotion_tag,
  spot_label = EXCLUDED.spot_label,
  standing_label = EXCLUDED.standing_label,
  expertise_label = EXCLUDED.expertise_label,
  intensity_label = EXCLUDED.intensity_label,
  programme = EXCLUDED.programme,
  programme_json = EXCLUDED.programme_json,
  inclusions_json = EXCLUDED.inclusions_json,
  logistics_json = EXCLUDED.logistics_json,
  tags = EXCLUDED.tags,
  price_includes_features = EXCLUDED.price_includes_features,
  documents_requis = EXCLUDED.documents_requis,
  updated_at = now();

-- Sessions gd_stay_sessions
INSERT INTO gd_stay_sessions (stay_slug, start_date, end_date, is_full, seats_left)
VALUES
  ('lake-sky-extreme', '2026-07-19', '2026-08-01', false, null),
  ('lake-sky-extreme', '2026-07-12', '2026-08-01', false, null)
ON CONFLICT (stay_slug, start_date, end_date) DO NOTHING;

-- Prix gd_session_prices
INSERT INTO gd_session_prices (stay_slug, start_date, end_date, city_departure, base_price_eur, price_ged_total, transport_surcharge_ged, is_full)
VALUES
  ('lake-sky-extreme', '2026-07-19', '2026-08-01', 'sans_transport', 1425, 1665, 0, false),
  ('lake-sky-extreme', '2026-07-12', '2026-08-01', 'sans_transport', 1950, 2360, 0, false),
  ('lake-sky-extreme', '2026-07-19', '2026-08-01', 'paris', 1425, 1665, 0, false),
  ('lake-sky-extreme', '2026-07-12', '2026-08-01', 'paris', 1950, 2360, 0, false)
ON CONFLICT (stay_slug, start_date, end_date, city_departure) DO NOTHING;


-- ============================================================
-- Vérification post-insert
-- ============================================================
SELECT slug, marketing_title, age_min, age_max, carousel_group, published,
       (SELECT COUNT(*) FROM gd_stay_sessions ss WHERE ss.stay_slug = s.slug) as nb_sessions,
       (SELECT COUNT(*) FROM gd_session_prices sp WHERE sp.stay_slug = s.slug) as nb_prix
FROM gd_stays s
WHERE slug IN ('atlantic-surf-sessions', 'high-ranch-experience', 'lake-sky-extreme')
ORDER BY slug;

COMMIT;
