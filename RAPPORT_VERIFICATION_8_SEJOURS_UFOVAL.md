# 📋 RAPPORT VÉRIFICATION 8 SÉJOURS UFOVAL

**Date:** 2026-02-17
**Projet:** GED APP
**Objectif:** Vérifier et corriger les durées des 8 séjours UFOVAL spécifiés

---

## 📊 SÉJOURS À VÉRIFIER

| Nom UFOVAL | Lieu | Durées attendues (jours inclusifs) |
|------------|------|-----------------------------------|
| DH Experience 11-13 ans | Les Carroz d'Arâches | 6, 7, 14, 21 |
| Aqua' Gliss | Les Issambres | 7, 14 |
| Aqua' Fun | Les Issambres | 7, 14 |
| Destination Bassin d'Arcachon | Taussat | 7, 12, 14, 19 |
| Natation et sensation | Saint-Raphaël | 7, 14 |
| L'aventure verticale | St Raphaël | 7, 14 |
| Aqua' Mix | Les Issambres | 7, 14 |
| Les P'tits Puisotins | Annecy | 7, 14, 21 |

**Règle UFOVAL :**
> "La durée indiquée en jours comptabilise chaque journée de présence, incluant le jour d'arrivée et le jour de départ. Par exemple, un séjour de 7 jours correspond à 7 journées complètes et 6 nuits."

**Formule :**
```
Durée (jours inclusifs) = (date_fin - date_debut) + 1
```

---

## 🎯 3 ÉTAPES D'EXÉCUTION

### **ÉTAPE 1 : VÉRIFICATION (obligatoire)**

**Fichier :** `VERIFICATION_DUREES_UFOVAL_8_SEJOURS.sql`

**Action :** Exécuter dans Supabase SQL Editor

**Résultats attendus :**

| Statut | Signification | Action |
|--------|---------------|--------|
| ✅ OK (jours inclusifs) | Durées correctes | Rien à faire |
| ⚠️ ERREUR NUITS (à corriger) | Sessions comptées en NUITS | Exécuter ÉTAPE 2 |
| ❌ AUCUNE SESSION | Pas de sessions en BDD | Créer sessions manuellement |
| ❌ INCOHÉRENT | Durées ne matchent pas | Vérifier données sources |

**Exemple de résultat :**
```
Nom UFOVAL              | Config | Durées attendues | Durées réelles | Statut
------------------------|--------|------------------|----------------|------------------
DH Experience 11-13 ans | 7      | 6, 7, 14, 21    | 6, 7, 13, 20   | ⚠️ ERREUR NUITS
Aqua' Gliss             | 7      | 7, 14           | 7, 14          | ✅ OK
Destination Bassin      | NULL   | 7, 12, 14, 19   | ❌ AUCUNE SESSION | ❌ AUCUNE SESSION
```

---

### **ÉTAPE 2 : CORRECTION (si nécessaire)**

**Fichier :** `CORRECTION_SESSIONS_8_SEJOURS_UFOVAL.sql`

**⚠️ ATTENTION :** Ce script **modifie** la base de données

**Pré-requis :**
1. ✅ Avoir exécuté ÉTAPE 1
2. ✅ Avoir identifié des sessions avec statut "⚠️ ERREUR NUITS"
3. ✅ Avoir backup de la base (automatique dans le script)

**Ce que fait le script :**
1. **Backup automatique** → `gd_stay_sessions_backup_20260217`
2. **Correction end_date** → Ajoute +1 jour si erreur NUITS détectée
3. **Mise à jour duration_days** → Recalcule la durée config basée sur sessions
4. **Vérification post-correction** → Affiche le résultat final

**Exemple de correction :**
```
Avant : start_date = 2026-07-01, end_date = 2026-07-07
        Durée = 6 jours (ERREUR: compté en nuits)

Après : start_date = 2026-07-01, end_date = 2026-07-08
        Durée = 7 jours (CORRECT: jours inclusifs)
```

---

### **ÉTAPE 3 : RAPPORT FINAL**

**Requête :**
```sql
-- À exécuter après ÉTAPE 2
SELECT
  s.slug,
  s.marketing_title AS "Titre GED",
  s.duration_days AS "Config",
  COUNT(ss.id) AS "Nb sessions",
  STRING_AGG(DISTINCT ((ss.end_date::date - ss.start_date::date) + 1)::text, ', ') AS "Durées",
  CASE
    WHEN COUNT(ss.id) = 0 THEN '❌ AUCUNE SESSION'
    ELSE '✅ OK'
  END AS "Statut"
FROM gd_stays s
LEFT JOIN gd_stay_sessions ss ON ss.stay_slug = s.slug
WHERE s.slug IN (
  'dh-experience-11-13-ans', 'aqua-gliss', 'aqua-fun',
  'destination-bassin-darcachon-1', 'natation-et-sensation',
  'laventure-verticale', 'aqua-mix', 'les-ptits-puisotins-1'
)
GROUP BY s.slug, s.marketing_title, s.duration_days
ORDER BY s.marketing_title;
```

**Résultat attendu :**
```
Titre GED                | Config | Nb sessions | Durées      | Statut
-------------------------|--------|-------------|-------------|--------
AZUR DIVE & JET          | 7      | 8           | 7, 14       | ✅ OK
BABY RIDERS              | 7      | 6           | 7, 14       | ✅ OK
BLUE EXPERIENCE          | 7      | 10          | 7, 14       | ✅ OK
DUNE & OCEAN KIDS        | 7      | 0           | -           | ❌ AUCUNE SESSION
GRAVITY BIKE PARK        | 7      | 12          | 6, 7, 14, 21 | ✅ OK
...
```

---

## 📋 CAS SPÉCIAUX

### **Cas 1 : Séjour sans sessions (❌ AUCUNE SESSION)**

**Problème :** Le séjour existe dans `gd_stays` mais aucune session dans `gd_stay_sessions`

**Solution manuelle :**
```sql
-- Créer des sessions manuellement
INSERT INTO gd_stay_sessions (stay_slug, start_date, end_date, seats_left)
VALUES
  ('destination-bassin-darcachon-1', '2026-07-01', '2026-07-07', 20),  -- 7 jours
  ('destination-bassin-darcachon-1', '2026-07-08', '2026-07-19', 20),  -- 12 jours
  ('destination-bassin-darcachon-1', '2026-07-20', '2026-08-02', 20),  -- 14 jours
  ('destination-bassin-darcachon-1', '2026-08-03', '2026-08-21', 20);  -- 19 jours
```

---

### **Cas 2 : Durées incohérentes (❌ INCOHÉRENT)**

**Problème :** Les durées réelles ne correspondent ni à JOURS ni à NUITS

**Exemple :**
- Durées attendues : 7, 14
- Durées réelles : 5, 8, 13

**Solution :**
1. Vérifier les dates sources (Excel UFOVAL)
2. Corriger manuellement les sessions incorrectes
3. OU supprimer et recréer les sessions

---

### **Cas 3 : Multi-durées sur un même produit**

**Problème :** Un séjour propose 7j ET 14j

**Décision métier :**
- ✅ **Recommandé :** Accepter multi-durées (normal pour colos)
- ⚠️ **Alternative :** Créer 2 fiches produits distinctes

**Si multi-durées accepté :**
```sql
-- Config duration_days = durée la plus fréquente
UPDATE gd_stays
SET duration_days = 7  -- Durée majoritaire
WHERE slug = 'aqua-gliss';
```

---

## 🛡️ SÉCURITÉ & ROLLBACK

### **Backup automatique**
Le script ÉTAPE 2 crée automatiquement :
```sql
gd_stay_sessions_backup_20260217
```

### **Restauration (si erreur)**
```sql
-- Supprimer les sessions modifiées
DELETE FROM gd_stay_sessions
WHERE stay_slug IN ('dh-experience-11-13-ans', 'aqua-gliss', ...);

-- Restaurer depuis backup
INSERT INTO gd_stay_sessions
SELECT * FROM gd_stay_sessions_backup_20260217;
```

---

## 📊 STATISTIQUES ATTENDUES

Après correction complète :

| Métrique | Valeur attendue |
|----------|----------------|
| Séjours vérifiés | 8 |
| Séjours avec sessions OK | 7-8 |
| Séjours sans sessions | 0-1 |
| Sessions corrigées (NUITS→JOURS) | Variable |
| Incohérences restantes | 0 |

---

## 📄 FICHIERS CRÉÉS

1. **[VERIFICATION_DUREES_UFOVAL_8_SEJOURS.sql](computer:///sessions/dreamy-peaceful-einstein/mnt/GED_APP/sql/VERIFICATION_DUREES_UFOVAL_8_SEJOURS.sql)** - Requête de vérification
2. **[CORRECTION_SESSIONS_8_SEJOURS_UFOVAL.sql](computer:///sessions/dreamy-peaceful-einstein/mnt/GED_APP/sql/CORRECTION_SESSIONS_8_SEJOURS_UFOVAL.sql)** - Script de correction automatique
3. **[RAPPORT_VERIFICATION_8_SEJOURS_UFOVAL.md](computer:///sessions/dreamy-peaceful-einstein/mnt/GED_APP/RAPPORT_VERIFICATION_8_SEJOURS_UFOVAL.md)** - Ce rapport

---

## ✅ CHECKLIST EXÉCUTION

- [ ] **1. Vérification**
  - [ ] Exécuter `VERIFICATION_DUREES_UFOVAL_8_SEJOURS.sql`
  - [ ] Noter les séjours avec statut "⚠️ ERREUR NUITS"
  - [ ] Noter les séjours avec statut "❌ AUCUNE SESSION"

- [ ] **2. Correction (si nécessaire)**
  - [ ] Backup base de données (Supabase auto-backup)
  - [ ] Exécuter `CORRECTION_SESSIONS_8_SEJOURS_UFOVAL.sql`
  - [ ] Vérifier les logs de correction

- [ ] **3. Vérification finale**
  - [ ] Exécuter requête ÉTAPE 3
  - [ ] Vérifier 0 erreur restante
  - [ ] Traiter manuellement les "❌ AUCUNE SESSION"

- [ ] **4. Validation métier**
  - [ ] Tester 1 séjour en frontend
  - [ ] Vérifier affichage durées
  - [ ] Valider prix cohérents

---

**✅ Prêt à exécuter ÉTAPE 1 dans Supabase SQL Editor !**
