# ✅ INSTRUCTION SIMPLE - EXÉCUTER LE SQL

## 🎯 SITUATION

**Contenus CityCrunch** : ✅ Déjà en place (titres, descriptions reformulés)
**Données techniques** : ❌ Manquantes (sessions, prix, villes)

**Action** : Peupler uniquement les données techniques, **sans toucher aux contenus**.

---

## 📋 1 SEULE ACTION

**Exécuter** : `sql/FIX_FINAL_SIMPLE.sql` dans Supabase SQL Editor

**Ce qu'il fait** :
1. ✅ Crée 3 sessions (dates juillet/août 2026)
2. ✅ Ajoute prix 850€ par session
3. ✅ Ajoute villes de départ (Paris, Lyon, Sans transport)

**Ce qu'il NE fait PAS** :
- ❌ Ne modifie PAS les titres CityCrunch
- ❌ Ne modifie PAS les descriptions
- ❌ Ne touche PAS aux contenus marketing

**Protection** : `ON CONFLICT DO NOTHING` → Pas de doublons

---

## 🎉 RÉSULTAT

**Après exécution** :

✅ Tous les séjours gardent leurs titres CityCrunch
✅ Prix affichés (850€)
✅ Validation âge fonctionnelle
✅ Tunnel inscription débloqé

**Test** : `/sejour/annecy-element/reserver`
- Titre reste : "ALPINE SKY CAMP" (CityCrunch)
- Prix affiché : "850 €"
- Validation âge : 12-17 ans

---

## 🚀 C'EST TOUT

Exécutez `sql/FIX_FINAL_SIMPLE.sql` → Tunnel fonctionnel, contenus CityCrunch préservés ✅
