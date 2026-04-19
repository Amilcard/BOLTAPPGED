# Mapping écrans Claude Design ↔ Repo GED

Audit de l'UI Kit MonApp Colo (B2C public, kids+pro hors dashboards).
**21 écrans livrés** par Claude Design.
Brand validé : **MonApp Colo** (principal) + **Groupe & Découverte** (endorsement).

---

## Tableau de correspondance

### 🟢 Écrans alignés avec route repo existante (13)

| # | Écran Claude Design | Route repo | Fichier repo | Statut |
|---|---|---|---|---|
| 1 | Accueil | `/` | `app/page.tsx` | ✅ aligné |
| 2 | Explorer | `/recherche` | `app/recherche/page.tsx` | ✅ aligné |
| 3 | Filtres avancés | `/recherche` (état panneau) | `components/filter-sheet.tsx` | ✅ état spécifique |
| 4 | Détail séjour | `/sejour/[id]` | `app/sejour/[id]/page.tsx` + `stay-detail.tsx` | ✅ aligné |
| 5 | Ajouter à mes souhaits | `/sejour/[id]/souhait` | `app/sejour/[id]/souhait/page.tsx` | ✅ aligné |
| 6 | Mes souhaits | `/envies` | `app/envies/page.tsx` | ✅ aligné |
| 7 | Connexion | `/login` | `app/login/page.tsx` | ✅ aligné (toggle Jeune/Référent·e novateur) |
| 8 | Mot de passe oublié | `/login/reset` | `app/login/reset/page.tsx` | ✅ aligné |
| 9 | Créer accès pro | `/acceder-pro` | `app/acceder-pro/page.tsx` | ✅ aligné |
| 10 | Inscription urgente | `/inscription-urgence` | `app/inscription-urgence/page.tsx` | ✅ aligné |
| 11 | Inbox souhaits | `/educateur/souhaits/[token]` | `app/educateur/souhaits/[token]/page.tsx` | ✅ aligné |
| 12 | Souhait — détail | `/educateur/souhait/[token]` | `app/educateur/souhait/[token]/page.tsx` | ✅ aligné |
| 13 | Récapitulatif inscription + Paiement | `/sejour/[id]/reserver` | `components/booking-flow.tsx` | ✅ 2 étapes du flow |

### 🟡 Écrans novateurs — features non présentes dans le repo (5)

À valider : créer ces features ou retirer des maquettes ?

| # | Écran Claude Design | Repo actuel | Action produit |
|---|---|---|---|
| 14 | **Comparer les séjours** | ❌ aucune route | 🤔 Feature nouvelle. À scoper si on veut un comparateur côte-à-côte |
| 15 | **Inscrire un jeune** | Pattern différent du repo | ⚠️ Clarifier : remplace `/sejour/[id]/reserver` ou flow séparé ? |
| 16 | **Mon compte** (kids) | ❌ aucune route profil kids | 🤔 Feature nouvelle. Kids = localStorage only actuellement |
| 17 | **Notifications** (kids) | ❌ aucun système notifs UI | 🤔 Feature nouvelle. Si adoption → créer route + DB + backend |
| 18 | **Planning séjour** (J-42 + checklist) | ❌ aucune route | 🤔 Feature nouvelle engageante pour kids/parents |
| 19 | **Retour de séjour** (feedback post) | ❌ aucune route | 🤔 Feature nouvelle. Photos + partage opt-in + smiley ratings |

### 🟡 Écran pro non présent dans le repo actuel (1)

| # | Écran Claude Design | Repo actuel | Action |
|---|---|---|---|
| 20 | **Équipe & structure** | `/structure/[code]` existe mais différent | ⚠️ Clarifier périmètre vs dashboard structure complet |

### ⚠️ Écran redondant ou ambigu (1)

| # | Écran Claude Design | Commentaire |
|---|---|---|
| 21 | _Compte `Mon compte` apparaît en 2 variantes_ | Un kids + un à voir (à recompter dans l'image) |

---

## Manquants — ce que Claude Design n'a pas encore produit

### Routes B2C publiques manquantes (4)

| Route repo | Description | Priorité |
|---|---|---|
| `/cgu` | Conditions générales utilisation | Faible — page légale texte long |
| `/cgv` | Conditions générales vente | Faible — page légale texte long |
| `/confidentialite` | Politique RGPD (référencée par toutes notices) | **Moyenne** — importante RGPD |
| `/mentions-legales` | Mentions légales | Faible |

### Routes pro manquantes hors dashboards (2-3)

| Route repo | Description | Priorité |
|---|---|---|
| `/structure/login` | Login structure par code (différent de `/login` pro JWT) | **Haute** — parcours d'accès direct |
| `/structure/activate` | Activation invitation équipe (token email → set password) | **Haute** — parcours team invitation |

### Dashboards pas encore touchés (par choix)

| Écran | Composants | Priorité |
|---|---|---|
| Dashboard structure complet `/structure/[code]` | 14 composants (`StructureEduTab`, `StructureAdminTab`, `StructureTeamTab`, `StructureFacturesTab` + 10 panels) | Phase 2 |
| Dashboard référent `/suivi/[token]` | 7 composants (`DossierEnfantPanel`, 4 formulaires, `DocumentsJointsUpload`, `SignaturePad`) | Phase 2 |

### Surfaces complémentaires à couvrir (rappel)

| Catégorie | Nombre | À décider |
|---|---|---|
| Emails HTML | 23 templates | À harmoniser via design system email (action Claude Design future) |
| PDF dynamiques | 5 layouts | Factures, propositions, dossier, bulletin, sanitaire, liaison |
| États (error / 404 / loading) | 23 pages | Design cohérent à produire |
| Modals / Drawers | 7+ | `pro-gate-modal` (3 variants) + filters + payment |
| Footer | 1 | Présent dans `chrome.js`, à styliser |

---

## Synthèse numérique

| Périmètre | Claude Design | Repo | Delta |
|---|---|---|---|
| Routes B2C visibles (hors dashboards) | 20 écrans livrés | 22 routes + 1 dashboard `/structure/[code]` + 1 `/suivi/[token]` | -2 routes légales + 1-2 pro manquantes + 5 nouvelles features inventées |
| Dashboards | 0 (par choix) | 21 sous-écrans | Phase 2 |
| Email HTML | 0 | 23 templates | À faire |
| PDF layouts | 0 | 5 layouts | À faire |

---

## Actions produit à trancher

### Décisions à valider

| # | Question | Options |
|---|---|---|
| D1 | **Comparateur séjours** ? | A. Adopter → nouvelle feature à coder · B. Retirer des maquettes |
| D2 | **Mon compte kids** ? | A. Créer un vrai compte kid (JWT léger, préférences) · B. Rester localStorage only · C. Retirer |
| D3 | **Notifications kids** ? | A. Système complet (backend + UI + push) · B. Inbox simple in-app · C. Retirer |
| D4 | **Planning séjour J-42 + checklist** ? | A. Feature engageante à adopter · B. Retirer · C. Différer phase 2 |
| D5 | **Retour de séjour (photos + ratings)** ? | A. Adopter (valeur UX forte) · B. Retirer · C. Différer |
| D6 | **Équipe & structure** | A. Composant du dashboard structure existant · B. Nouvel écran indépendant |
| D7 | **Pages légales** (CGU/CGV/confidentialité/mentions) | A. Demander à Claude Design · B. Garder le style actuel du repo |
| D8 | **Structure login + activate** | A. Demander à Claude Design · B. Reprendre l'existant |

### À pousser à Claude Design maintenant

1. **7 corrections techniques** déjà listées dans `AUDIT_CLAUDE_DESIGN_2026-04-19.md`
2. **Décision sur les 5 features nouvelles** (Comparateur / Mon compte / Notifs / Planning / Retour) selon tes choix D1-D5
3. **Écrans manquants à produire si validés** : pages légales + structure login + activate invitation

---

## Verdict global final

**Couverture B2C kids+pro (hors dashboards) : 13/22 routes repo mappées + 5-6 features nouvelles proposées**.

Le kit est **solide et cohérent** — il couvre **65% des routes existantes** et **propose 6 features nouvelles** qui peuvent enrichir le produit (sous réserve de décision métier).

Il **manque principalement** :
- Les pages légales (4)
- Les parcours pro structure-login + activate (2)
- Les 23 emails HTML + 5 PDFs
- Les dashboards (21 sous-écrans, attendu Phase 2)

---

**Source** : image UI Kit fournie 2026-04-19 · 21 écrans visibles
**Réf repo** : 22 routes front · 21 sous-écrans dashboards · 50 composants UI shadcn
