# ✅ VÉRIFICATION INSCRIPTION FINALE - Kids & Pro

**Date:** 15 février 2026
**Objectif:** Valider les parcours d'inscription côté Familles (Kids) et Professionnels (Pro)

---

## 🎯 CONTEXTE

Suite à la **Phase 3 Payment** (Virement/Chèque), validation des deux parcours d'inscription:
- **Côté Kids:** Familles inscrivant leurs enfants via `app.groupeetdecouverte.fr`
- **Côté Pro:** Professionnels (travailleurs sociaux) inscrivant via espace dédié

---

## 📊 ARCHITECTURE SYSTÈME

### 1. Routes API

#### `/api/inscriptions` (POST)
**Usage:** Inscription professionnelle (travailleurs sociaux)

**Payload requis:**
```typescript
{
  staySlug: string;          // Slug du séjour
  sessionDate: string;        // Date début session
  cityDeparture: string;      // Ville de départ
  organisation: string;       // Nom organisation
  socialWorkerName: string;   // Nom référent
  email: string;              // Email référent
  phone: string;              // Téléphone
  childFirstName: string;     // Prénom enfant
  childLastName?: string;     // Nom enfant (optionnel)
  childBirthDate: string;     // Date naissance
  optionsEducatives?: string; // Options éducatives
  remarques?: string;         // Remarques
  priceTotal: number;         // Prix total calculé
  consent: boolean;           // Consentement requis
}
```

**Table DB:** `gd_inscriptions`
**Status initial:** `en_attente`
**Payment status:** `pending_payment` (auto via trigger)

#### `/api/bookings` (si existante - à vérifier)
**Usage:** Réservation familiale (parents)

---

## 🔍 PARCOURS KIDS (Familles)

### Page d'entrée
- **URL:** `/sejour/[slug]`
- **CTA:** Bouton "Réserver" → redirect vers `/sejour/[slug]/reserver`

### Page de réservation
- **URL:** `/sejour/[slug]/reserver`
- **Composant:** `<BookingFlow />` (735 lignes)

### Étapes du flux

#### 1. Sélection session & départ
- Choix date/session disponible
- Choix ville de départ
- Calcul prix en temps réel

#### 2. Informations enfant
- Prénom/Nom
- Date de naissance
- **Validation âge:** Vérifie éligibilité selon min_age/max_age du séjour

#### 3. Informations parent/tuteur
- Nom/Prénom
- Email
- Téléphone

#### 4. Sélection mode de paiement
**Composant:** `<PaymentMethodSelector />`

**Options disponibles:**
- ✅ **Virement bancaire** → `<TransferInstructions />`
- ✅ **Chèque** → `<CheckInstructions />`
- ⏸️ **Carte Bancaire** (Phase 4 - Stripe à venir)

#### 5. Confirmation & instructions paiement
- Affichage récapitulatif
- Instructions selon méthode choisie
- Numéro de réservation généré

### Validation technique

**✅ Tests passés** (cf. `RAPPORT_TESTS_VALIDATION_PAIEMENTS_2026-02-15.md`):
- Flux complet Virement OK
- Flux complet Chèque OK
- Calcul prix correct
- Validation âge fonctionnelle
- Données enregistrées en DB

**⚠️ Points d'attention:**
- Phase 4 Stripe en attente (paiement CB)
- Migration SQL `009_payment_system.sql` doit être appliquée

---

## 🏢 PARCOURS PRO (Professionnels)

### Accès espace Pro
- **URL:** `/espace-pro` (à vérifier si existe)
- Ou via `/login` avec rôle professionnel

### Authentification
- **Table:** `users` (avec enum Role)
- **Rôles disponibles:**
  - `USER` (familles)
  - `ADMIN` (back-office)
  - `PARTNER` (professionnels ?) - à vérifier

### Formulaire inscription Pro

**Route API:** `/api/inscriptions` (POST)

**Champs spécifiques Pro:**
```
- organisation: Organisation du professionnel
- socialWorkerName: Nom du référent
- optionsEducatives: Options pédagogiques
- remarques: Remarques spécifiques
```

### Différences Kids vs Pro

| Critère | Kids (Familles) | Pro (Travailleurs sociaux) |
|---------|-----------------|----------------------------|
| **Champ organisation** | ❌ Non | ✅ Oui (requis) |
| **Champ référent** | Parent = référent | Travailleur social distinct |
| **Options éducatives** | ❌ Non | ✅ Oui |
| **Tarification** | Prix public | Tarif négocié possible |
| **Validation** | Instantanée | Validation manuelle potentielle |

---

## 🔒 VÉRIFICATION ANTI-RÉGRESSION CityCrunch

### Page de vérification créée
**URL:** `/verify-db`

**Fonctionnalités:**
- ✅ Lecture `gd_stays` depuis Supabase
- ✅ Vérification présence `marketing_title` (noms CityCrunch)
- ✅ Détection fallback vers `title_kids` ou `title` (legacy UFOVAL)
- ✅ Affichage tableau complet avec statuts

**Hiérarchie d'affichage:**
1. **Priority 1:** `marketing_title` (CityCrunch Premium) → ✅ OK
2. **Priority 2:** `title_kids` (CityCrunch Kids) → ⚠️ Fallback
3. **Priority 3:** `title` (Legacy UFOVAL) → 🔴 Régression

### Utilisation
```bash
# Accéder à la page
https://app.groupeetdecouverte.fr/verify-db

# Résultats attendus
- 24/24 séjours avec marketing_title ✅
- 0 régression legacy 🔴
```

---

## 📋 CHECKLIST DE VALIDATION

### Côté Kids (Familles)
- [x] Page `/sejour/[slug]` affiche noms CityCrunch
- [x] Page `/sejour/[slug]/reserver` accessible
- [x] Composant `<BookingFlow />` fonctionnel
- [x] Sélection session/départ OK
- [x] Validation âge enfant OK
- [x] Sélecteur paiement (Virement/Chèque) OK
- [x] Instructions paiement affichées
- [ ] Test end-to-end complet (depuis recherche jusqu'à confirmation)
- [ ] Migration SQL 009 appliquée en prod
- [ ] Variables d'env Stripe configurées (Phase 4)

### Côté Pro (Professionnels)
- [ ] Accès espace `/espace-pro` vérifié
- [ ] Authentification rôle PARTNER/PRO OK
- [ ] Formulaire inscription pro accessible
- [ ] Champs spécifiques Pro fonctionnels
- [ ] Route `/api/inscriptions` testée
- [ ] Données enregistrées dans `gd_inscriptions`
- [ ] Workflow validation manuelle (si applicable)

### Anti-régression
- [x] Page `/verify-db` créée
- [ ] Page `/verify-db` testée en prod
- [ ] 24/24 séjours avec `marketing_title`
- [ ] Aucun fallback legacy détecté
- [ ] Screenshots homepage vs mockup validés

---

## 🚨 BLOCAGES ACTUELS

### 1. Build Docker timeout
**Impact:** Impossible de déployer sur Hostinger
**Cause:** Imports Supabase au top-level
**Solution:** Build sur VPS avec accès Supabase

### 2. Git lock persistant
**Impact:** Impossible de commit corrections
**Solution:** Attendre expiration automatique

### 3. Migration SQL non confirmée
**Impact:** Tables payment peuvent manquer en prod
**Action requise:** Vérifier et appliquer `sql/009_payment_system.sql`

### 4. Phase 4 Stripe en attente
**Impact:** Paiement CB non fonctionnel
**Action requise:**
- Créer compte Stripe
- Configurer clés API
- Tester webhook

---

## 📊 TESTS REQUIS

### Test 1: Parcours Kids complet
```
1. Aller sur homepage
2. Cliquer sur un séjour (ex: ALPOO KIDS)
3. Vérifier nom CityCrunch affiché
4. Cliquer "Réserver"
5. Sélectionner session + ville départ
6. Remplir infos enfant (âge valide 6-8 ans)
7. Remplir infos parent
8. Choisir "Virement bancaire"
9. Valider
10. Vérifier instructions virement
11. Vérifier email confirmation
12. Vérifier données en DB gd_inscriptions
```

### Test 2: Parcours Pro complet
```
1. Connexion espace Pro
2. Accéder formulaire inscription
3. Remplir organisation
4. Remplir infos travailleur social
5. Remplir infos enfant
6. Ajouter remarques/options éducatives
7. Soumettre
8. Vérifier enregistrement DB
9. Vérifier email notification
10. Vérifier workflow validation
```

### Test 3: Vérification anti-régression
```
1. Accéder /verify-db
2. Vérifier tableau complet
3. Confirmer 24/24 OK ✅
4. Aucune ligne rouge 🔴
5. Screenshot résultats
```

---

## 🎯 PROCHAINES ÉTAPES

### Immédiat
1. ✅ Page `/verify-db` créée
2. ⏸️ Résolution Git lock
3. ⏸️ Commit corrections build
4. ⏸️ Push vers origin/work

### Court terme (deploy)
1. Build Docker sur VPS
2. Deploy production
3. Test `/verify-db` en ligne
4. Validation parcours Kids

### Moyen terme (Phase 4)
1. Configuration Stripe
2. Activation paiement CB
3. Tests webhook
4. Validation parcours Pro

---

## 📄 DOCUMENTATION LIÉE

- `RAPPORT_TESTS_VALIDATION_PAIEMENTS_2026-02-15.md` - Tests Phase 3
- `ETAT_DES_LIEUX_UFOVAL_CITYCRUNCH_2026-02-15.md` - Anti-régression
- `TESTS_REGRESSION_INSTRUCTIONS.json` - Instructions tests
- `sql/009_payment_system.sql` - Migration paiement

---

**Status:** 🟡 En cours de validation
**Dernière MAJ:** 15 février 2026 16:00
**Responsable:** Claude + LAID (GED)
