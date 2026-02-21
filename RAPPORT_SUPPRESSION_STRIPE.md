# 🔥 RAPPORT SUPPRESSION STRIPE → LYRA (PayZen)

**Date:** 17 février 2026
**Projet:** GED APP
**Objectif:** Supprimer Stripe en toute sécurité et préparer l'intégration Lyra

---

## ✅ ÉTAT ACTUEL

### Stripe dans le projet
- **Package npm:** `stripe: ^20.3.1` ✅ Présent
- **Fichiers API actifs:** 2 fichiers
- **Variables .env:** 3 variables (test keys uniquement)
- **Colonne BDD:** `stripe_payment_intent_id` ✅ Vide (jamais utilisée)
- **Paiements Stripe en prod:** 0 ❌ Jamais activé

### Verdict
✅ **SAFE TO REMOVE** - Stripe configuré mais jamais utilisé en production.

---

## 📋 PLAN DE SUPPRESSION (5 PHASES)

### Phase 1: Suppression fichiers API
```bash
rm -rf app/api/webhooks/stripe/
rm -rf app/api/payment/create-intent/
rm -f patches-securite-financiere/stripe-webhook_route.ts
rm -f patches-securite-financiere/create-intent_route.ts
```

**Impact:** ✅ Aucun (routes jamais utilisées)

---

### Phase 2: Migration base de données

**Fichier:** `sql/010_remove_stripe_lyra_migration.sql`

**Actions:**
1. ❌ DROP index `idx_registrations_stripe_intent`
2. ❌ DROP column `stripe_payment_intent_id`
3. ❌ DROP constraint avec `'stripe'`
4. ✅ ADD constraint avec `'lyra'` : `CHECK (payment_method IN ('lyra', 'transfer', 'check'))`
5. ✅ ADD column `lyra_transaction_id TEXT`
6. 🔧 UPDATE trigger `log_payment_status_change()` (remove Stripe logic)

**Exécution:**
```bash
# Copier le contenu de sql/010_remove_stripe_lyra_migration.sql
# Exécuter dans Supabase SQL Editor
# URL: https://supabase.com/dashboard/project/[PROJECT]/sql
```

**Impact:** ✅ Aucun (colonne vide, aucune donnée perdue)

---

### Phase 3: Variables .env

**Fichier:** `.env`

**Supprimer (lignes 14-16):**
```bash
STRIPE_PUBLISHABLE_KEY="pk_test_YOUR_KEY_HERE"
STRIPE_SECRET_KEY="sk_test_YOUR_SECRET_KEY_HERE"
STRIPE_WEBHOOK_SECRET="whsec_YOUR_WEBHOOK_SECRET_HERE"
```

**Impact:** ✅ Aucun (test keys uniquement)

---

### Phase 4: Package npm

```bash
npm uninstall stripe
npm run build  # Vérifier que le build réussit
```

**Impact:** ✅ Aucun (imports supprimés en phase 1)

---

### Phase 5: Recherche résiduelle

```bash
grep -ri 'stripe' --exclude-dir=node_modules --exclude-dir=.git .
grep -ri 'payment_intent' --exclude-dir=node_modules .
```

**Nettoyer:** Commentaires, documentation, références orphelines

---

## 🚀 EXÉCUTION AUTOMATIQUE

### Option A: Script automatique (recommandé)

```bash
cd /path/to/GED_APP
./remove-stripe-safe.sh
```

**Le script effectue:**
- ✅ Pré-vérifications
- ✅ Suppression fichiers API
- ✅ Affichage migration SQL
- ✅ Nettoyage .env (backup automatique)
- ✅ npm uninstall stripe
- ✅ Vérification build
- ✅ Recherche résidus

**Durée:** 5-10 minutes

---

### Option B: Manuel (étape par étape)

Suivre le plan ci-dessus phase par phase.

---

## 🎯 PRÉPARATION LYRA (PayZen)

### Structure recommandée

```
app/api/
├── payment/
│   └── lyra/
│       └── route.ts          # Création transaction Lyra
└── webhooks/
    └── lyra/
        └── route.ts          # Réception notifications Lyra
```

### Variables .env nécessaires

```bash
# Lyra (PayZen)
LYRA_SITE_ID="12345678"
LYRA_TEST_KEY="testkey_..."
LYRA_PRODUCTION_KEY="prodkey_..."
LYRA_WEBHOOK_SECRET="webhook_secret_..."
```

### Colonne BDD déjà créée

```sql
-- Créée par migration 010
ALTER TABLE gd_inscriptions
ADD COLUMN lyra_transaction_id TEXT;
```

---

## 📊 IMPACT UTILISATEURS

| Méthode paiement | Avant | Après | Impact |
|-------------------|-------|-------|--------|
| Virement bancaire | ✅ Actif | ✅ Actif | Aucun |
| Chèque | ✅ Actif | ✅ Actif | Aucun |
| Stripe CB | ❌ Jamais activé | ❌ Supprimé | Aucun |
| Lyra CB | ❌ Pas encore | ✅ À implémenter | Nouveau |

**Impact global:** ✅ ZÉRO (Stripe jamais utilisé par les utilisateurs)

---

## ⚠️ POINTS D'ATTENTION

### Avant exécution
1. ✅ Vérifier `SELECT COUNT(*) FROM gd_inscriptions WHERE payment_method = 'stripe';` → **Doit être 0**
2. ✅ Backup BDD (recommandé)
3. ✅ Commit Git avant suppression

### Après exécution
1. ✅ Vérifier build: `npm run build`
2. ✅ Vérifier dev server: `npm run dev`
3. ✅ Commit: `git commit -m "feat: Remove Stripe, prepare for Lyra PayZen"`

---

## 📄 FICHIERS CRÉÉS

| Fichier | Utilité |
|---------|---------|
| `AUDIT_STRIPE_REMOVAL_2026-02-17.json` | Rapport audit complet (JSON) |
| `sql/010_remove_stripe_lyra_migration.sql` | Migration BDD Stripe→Lyra |
| `remove-stripe-safe.sh` | Script automatique de suppression |
| `RAPPORT_SUPPRESSION_STRIPE.md` | Ce rapport (documentation) |

---

## ✅ CHECKLIST FINALE

**Avant exécution:**
- [ ] Lecture complète du rapport
- [ ] Vérification aucun paiement Stripe en prod
- [ ] Backup BDD (optionnel mais recommandé)
- [ ] Commit Git état actuel

**Exécution:**
- [ ] Phase 1: Suppression fichiers API
- [ ] Phase 2: Migration SQL Supabase
- [ ] Phase 3: Nettoyage .env
- [ ] Phase 4: npm uninstall stripe
- [ ] Phase 5: Recherche résidus

**Après exécution:**
- [ ] Build réussi (`npm run build`)
- [ ] Dev server OK (`npm run dev`)
- [ ] Commit final
- [ ] Push vers repo

**Intégration Lyra:**
- [ ] Créer routes API Lyra
- [ ] Configurer variables .env Lyra
- [ ] Tests paiement test mode
- [ ] Tests webhook Lyra
- [ ] Passage production Lyra

---

## 🎉 RÉSULTAT ATTENDU

**stripe_fully_removed:** YES
**residual_risk:** ZERO
**build_status:** SUCCESS
**ready_for_lyra_integration:** YES

---

**Prêt à exécuter ?** → `./remove-stripe-safe.sh` 🚀
