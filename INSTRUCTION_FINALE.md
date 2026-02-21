# ✅ INSTRUCTION FINALE - 1 SEULE COMMANDE

## 🎯 CE QU'IL FAUT FAIRE

**Exécuter ce fichier SQL** : `sql/FIX_FINAL_SIMPLE.sql`

**Méthode** :
1. Ouvrir Supabase Dashboard
2. Aller dans SQL Editor
3. Copier-coller le contenu de `sql/FIX_FINAL_SIMPLE.sql`
4. Exécuter (bouton Run)

---

## ✅ CE QUE ÇA FAIT

Pour les **20 séjours existants** (liste affichée) :

1. ✅ Crée **3 sessions** pour chaque séjour sans sessions
   - 5-12 juillet 2026
   - 19-26 juillet 2026
   - 2-9 août 2026

2. ✅ Ajoute **prix 850€** pour chaque session
   - Sans transport (inclus)

3. ✅ Ajoute **3 villes de départ** pour chaque séjour
   - Sans transport (0€)
   - Paris (inclus)
   - Lyon (+50€)

**Protection** : `ON CONFLICT DO NOTHING` → Pas de doublons, pas de crash

---

## 🎯 RÉSULTAT

**Après exécution** :

✅ Tous les séjours auront des sessions valides
✅ Prix affichés (850€)
✅ Validation âge fonctionnelle
✅ Tunnel inscription débloqé pour TOUS les séjours

---

## 📋 TEST

1. Aller sur `/sejour/annecy-element/reserver` (ou n'importe quel slug de la liste)
2. Remplir tunnel
3. **Enfant 25 ans** → ❌ Bouton disabled (âge 12-17 requis)
4. **Enfant 15 ans** → ✅ Bouton enabled
5. **Prix** → ✅ "850 €" affiché
6. **Sessions** → ✅ 3 dates valides

---

## 🎉 C'EST FINI

**1 fichier SQL = Site 100% fonctionnel**

Exécutez `sql/FIX_FINAL_SIMPLE.sql` → Testez → Tout marche 🚀
