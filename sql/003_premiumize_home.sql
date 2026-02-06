-- ============================================
-- LOT PREMIUM HOME: Nettoyage Badges + Fusion Carrousels
-- Objectif: Passer de "Catalogue Administratif" à "Plateforme d'Expériences"
-- ============================================
-- RÈGLE D'OR: Le badge (emotion_tag) vend une INTENSITÉ ou THÉMATIQUE FORTE
--             Jamais une géographie (MER, MONTAGNE) ni un terme générique (PLEIN AIR)
-- ============================================

-- ========================
-- ÉTAPE 1: REMAPPER LES CAROUSEL_GROUP (4 → 3 univers)
-- Fusion: ALTITUDE_AVENTURE + OCEAN_FUN → AVENTURE_DECOUVERTE
-- Exception: aqua-fun (AZUR DIVE & JET) remonte dans ADRENALINE_SENSATIONS
-- ========================

-- aqua-fun est un séjour premium (plongée, jet-ski, St-Tropez) → ADRENALINE
UPDATE gd_stays SET
  carousel_group = 'ADRENALINE_SENSATIONS'
WHERE slug = 'aqua-fun';

-- Tous les ALTITUDE_AVENTURE → AVENTURE_DECOUVERTE
UPDATE gd_stays SET
  carousel_group = 'AVENTURE_DECOUVERTE'
WHERE carousel_group = 'ALTITUDE_AVENTURE';

-- Tous les OCEAN_FUN → AVENTURE_DECOUVERTE
UPDATE gd_stays SET
  carousel_group = 'AVENTURE_DECOUVERTE'
WHERE carousel_group = 'OCEAN_FUN';

-- ========================
-- ÉTAPE 2: CORRIGER LES EMOTION_TAG RÉSIDUELS
-- Certains séjours ont encore des tags géographiques ou génériques
-- ========================

-- DH EXPERIENCE: SPORT → trop générique pour l'univers Adrénaline
-- Contexte: VTT descente, jumps → l'émotion c'est l'ACTION
UPDATE gd_stays SET
  emotion_tag = 'ACTION'
WHERE slug = 'dh-experience-11-13-ans' AND emotion_tag = 'SPORT';

-- Sperienza: Déjà corrigé en AVENTURE dans 002 (OK)
-- Destination Soleil: Déjà corrigé en VITESSE dans 002 (OK)
-- Surf Bassin: Déjà corrigé en GLISSE dans 002 (OK)
-- Aqua Gliss: Déjà corrigé en EAU CALME dans 002 (OK)

-- ========================
-- ÉTAPE 3: VÉRIFICATION
-- ========================
SELECT
  carousel_group,
  slug,
  marketing_title,
  emotion_tag,
  spot_label
FROM gd_stays
WHERE published = true
ORDER BY
  CASE carousel_group
    WHEN 'ADRENALINE_SENSATIONS' THEN 1
    WHEN 'AVENTURE_DECOUVERTE' THEN 2
    WHEN 'MA_PREMIERE_COLO' THEN 3
    ELSE 4
  END,
  slug;
