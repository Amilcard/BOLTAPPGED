# 📘 GUIDE NORMALISATION DES DURÉES DE SÉJOURS

**Date:** 2026-02-17
**Projet:** GED APP
**Problématique:** Normaliser les durées de séjours stockées en `date_debut` / `date_fin`

---

## 🎯 DÉCISION : JOURS INCLUSIFS (Norme industrie séjours vacances)

### ✅ **FORMULE RECOMMANDÉE**
```sql
durée_jours = (date_fin - date_debut) + 1
```

**Raison :** Dans l'industrie des colonies/séjours vacances :
- Un séjour du **lundi 1er au vendredi 5** = **5 jours** (et 4 nuits)
- L'enfant est présent du jour d'arrivée AU jour de départ (inclusif)

---

## 📊 COMPARAISON DES MÉTHODES

### **Méthode 1 : Jours inclusifs** (RECOMMANDÉE ✅)
```sql
(end_date::date - start_date::date) + 1
```

**Exemple :**
- Début : 2026-07-01 (lundi)
- Fin : 2026-07-07 (dimanche)
- Calcul : `7 - 1 + 1 = 7 jours`
- **Marketing :** "Séjour 7 jours / 6 nuits"

**Avantages :**
- ✅ Norme industrie séjours vacances
- ✅ Cohérent avec attente client ("du 1er au 7 = 7 jours")
- ✅ Cohérent avec `duration_days` actuel dans `gd_stays`

---

### **Méthode 2 : Nuits** (❌ Non recommandée)
```sql
end_date::date - start_date::date
```

**Exemple :**
- Début : 2026-07-01
- Fin : 2026-07-07
- Calcul : `7 - 1 = 6 nuits`
- **Marketing :** "Séjour 6 nuits / 7 jours"

**Problème :**
- ❌ Confusion client (date_fin = 7 mais affiche "6")
- ❌ Incohérent avec `duration_days` (qui stocke 7)

---

## 🔧 PLAN DE NORMALISATION

### **Étape 1 : Audit des incohérences actuelles**

**Requête SQL :**
```sql
-- Détecter les incohérences entre duration_days (config) et sessions réelles
SELECT
  s.slug,
  s.marketing_title AS "Titre GED",
  s.duration_days AS "Durée config",

  -- Calcul JOURS INCLUSIFS (recommandé)
  (ss.end_date::date - ss.start_date::date) + 1 AS "Durée session (jours inclusifs)",

  -- Calcul NUITS (pour comparaison)
  (ss.end_date::date - ss.start_date::date) AS "Durée session (nuits)",

  CASE
    WHEN s.duration_days = ((ss.end_date::date - ss.start_date::date) + 1) THEN '✅ Cohérent (jours)'
    WHEN s.duration_days = (ss.end_date::date - ss.start_date::date) THEN '⚠️ Cohérent (nuits)'
    ELSE '❌ INCOHÉRENT'
  END AS "Statut",

  TO_CHAR(ss.start_date, 'DD/MM/YYYY') AS "Début",
  TO_CHAR(ss.end_date, 'DD/MM/YYYY') AS "Fin"

FROM gd_stays s
JOIN gd_stay_sessions ss ON ss.stay_slug = s.slug
WHERE s.published = true
  AND s.duration_days IS NOT NULL
ORDER BY "Statut", s.marketing_title;
```

---

### **Étape 2 : Détecter les séjours avec durées variables**

**Requête SQL :**
```sql
SELECT
  s.slug,
  s.marketing_title AS "Titre GED",
  s.duration_days AS "Durée config",

  -- Toutes les durées réelles (jours inclusifs)
  STRING_AGG(DISTINCT ((ss.end_date::date - ss.start_date::date) + 1)::text, ', '
    ORDER BY ((ss.end_date::date - ss.start_date::date) + 1)::text) AS "Durées sessions",

  -- Nombre de durées distinctes
  COUNT(DISTINCT ((ss.end_date::date - ss.start_date::date) + 1)) AS "Nb durées différentes",

  CASE
    WHEN COUNT(DISTINCT ((ss.end_date::date - ss.start_date::date) + 1)) > 1 THEN '⚠️ MULTI-DURÉES'
    WHEN COUNT(DISTINCT ((ss.end_date::date - ss.start_date::date) + 1)) = 1
      AND s.duration_days = MIN((ss.end_date::date - ss.start_date::date) + 1) THEN '✅ OK'
    ELSE '❌ INCOHÉRENT'
  END AS "Statut"

FROM gd_stays s
JOIN gd_stay_sessions ss ON ss.stay_slug = s.slug
WHERE s.published = true
GROUP BY s.slug, s.marketing_title, s.duration_days
HAVING COUNT(DISTINCT ((ss.end_date::date - ss.start_date::date) + 1)) > 1
ORDER BY "Nb durées différentes" DESC, s.marketing_title;
```

---

### **Étape 3 : Migration/Correction automatique**

**Option A : Recalculer `duration_days` basé sur sessions existantes**
```sql
-- Mise à jour automatique duration_days
UPDATE gd_stays s
SET duration_days = (
  SELECT MODE() WITHIN GROUP (ORDER BY ((ss.end_date::date - ss.start_date::date) + 1))
  FROM gd_stay_sessions ss
  WHERE ss.stay_slug = s.slug
)
WHERE EXISTS (
  SELECT 1 FROM gd_stay_sessions ss WHERE ss.stay_slug = s.slug
);
```

**Option B : Créer une vue calculée dynamiquement**
```sql
-- Vue avec durée calculée en temps réel
CREATE OR REPLACE VIEW v_stays_with_duration AS
SELECT
  s.*,
  MODE() WITHIN GROUP (
    ORDER BY ((ss.end_date::date - ss.start_date::date) + 1)
  ) AS calculated_duration_days
FROM gd_stays s
LEFT JOIN gd_stay_sessions ss ON ss.stay_slug = s.slug
GROUP BY s.slug;
```

---

## 🛡️ RÈGLES DE COHÉRENCE (À IMPLÉMENTER)

### **Règle 1 : Interdire les incohérences**
```sql
-- Trigger de validation
CREATE OR REPLACE FUNCTION validate_session_duration()
RETURNS TRIGGER AS $$
DECLARE
  expected_duration INTEGER;
BEGIN
  SELECT duration_days INTO expected_duration
  FROM gd_stays WHERE slug = NEW.stay_slug;

  IF expected_duration IS NOT NULL THEN
    IF ((NEW.end_date::date - NEW.start_date::date) + 1) != expected_duration THEN
      RAISE EXCEPTION 'Session duration (% jours) ne correspond pas à duration_days (% jours)',
        ((NEW.end_date::date - NEW.start_date::date) + 1), expected_duration;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_session_duration
  BEFORE INSERT OR UPDATE ON gd_stay_sessions
  FOR EACH ROW
  EXECUTE FUNCTION validate_session_duration();
```

**⚠️ Attention :** Trigger bloquant → À activer uniquement après normalisation complète

---

### **Règle 2 : Durée unique par séjour (recommandé)**

**Décision métier :**
- Un séjour = UNE durée fixe (ex: "ALPOO KIDS" = 7 jours)
- Si besoin de 2 durées → Créer 2 séjours distincts (ex: "ALPOO KIDS 7J" + "ALPOO KIDS 14J")

**Avantages :**
- ✅ Simplifie la fiche produit
- ✅ Évite confusion client
- ✅ Prix unique par produit
- ✅ SEO optimisé (1 page = 1 produit clair)

---

## 📋 PLAN D'ACTION COMPLET

### **Phase 1 : Audit (1h)**
1. Exécuter requêtes Étape 1 et 2
2. Lister tous les séjours avec multi-durées
3. Lister toutes les incohérences `duration_days` vs sessions

### **Phase 2 : Décision métier (30min)**
4. Pour chaque séjour multi-durées, décider :
   - **Option A :** Garder durée la plus fréquente, supprimer sessions minoritaires
   - **Option B :** Créer séjours distincts (ex: ALPOO 7J / ALPOO 14J)

### **Phase 3 : Correction données (1h)**
5. Mettre à jour `duration_days` avec formule jours inclusifs
6. Nettoyer sessions incohérentes
7. Créer nouveaux séjours si nécessaire (Option B)

### **Phase 4 : Protection (30min)**
8. Créer vue de contrôle (alerte si incohérence)
9. Documenter règle métier dans Wiki/README
10. *(Optionnel)* Activer trigger de validation

---

## 🎯 RECOMMANDATION FINALE

### ✅ **ADOPTER JOURS INCLUSIFS**
```sql
durée_séjour = (date_fin - date_debut) + 1
```

### ✅ **RÈGLE MÉTIER : 1 SÉJOUR = 1 DURÉE**
- Séjour multi-durées → Créer 2 fiches produits distinctes

### ✅ **AFFICHAGE CLIENT**
```
"Séjour 7 jours / 6 nuits"
Du lundi 1er juillet au dimanche 7 juillet
```

---

## 📊 EXEMPLE CONCRET

**Cas : ALPOO KIDS**

**État actuel (problème) :**
- Session 1 : 01/07 → 07/07 (7 jours) ✅
- Session 2 : 08/07 → 13/07 (6 jours) ⚠️
- Session 3 : 15/07 → 20/07 (6 jours) ⚠️

**Analyse :**
```sql
-- Résultat : "6, 7" (multi-durées)
```

**Solution :**
1. Vérifier si erreur de saisie (fin 13/07 → 14/07 ?)
2. Si intentionnel → Créer "ALPOO KIDS 6J" et "ALPOO KIDS 7J"
3. Sinon → Standardiser tout à 7 jours

---

## 📄 FICHIERS CRÉÉS

- `GUIDE_NORMALISATION_DUREES.md` (ce fichier)
- `AUDIT_DUREES_SEJOURS.sql` (requêtes d'audit)
- `MIGRATION_NORMALISATION_DUREES.sql` (correction automatique)

Voulez-vous que je génère les 2 fichiers SQL manquants ?
