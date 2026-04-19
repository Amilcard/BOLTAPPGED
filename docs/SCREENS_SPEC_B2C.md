# Spec détaillé des écrans B2C — GED App

> Spec formelle par écran pour les 22 routes front utilisateur (hors dashboards).
> Format pour partage avec Claude Design ou tout designer externe.
> 2026-04-19

---

## Conventions

- **Audience** : `kids` (public sans compte) / `référent` (pro JWT ou token) / `partagé`
- **Auth** : aucune / JWT pro / suivi_token / structure_code / invitation_token
- **Priorité spec** : 🔴 critique (parcours inscription/paiement) / 🟡 important / 🟢 légal-support

---

## Mode KIDS (public, sans compte)

### 1. 🔴 `/` — Accueil catalogue

**Audience** : kids (parents + enfants 3-17 ans)
**Objectif** : accueillir + convertir vers découverte séjour.

**User stories** :
- Parent : "Je découvre les séjours disponibles par âge et centre d'intérêt"
- Enfant : "Je trouve un séjour qui me plaît visuellement"

**Structure** :
- Header minimal + logo
- Hero ou bandeau saisonnier (optional)
- 3 carousels par `carousel_group` : MA PREMIÈRE COLO / AVENTURE & DÉCOUVERTE / SENSATIONS & ADRÉNALINE
- Compteurs par catégorie (dérivés auto, pas hardcodés)
- Bottom nav sticky (mode kids only)

**CTA principal** : clic carte séjour → fiche `/sejour/[id]`
**CTA secondaire** : barre recherche → `/recherche`

**États** :
- Vide : "Séjours bientôt disponibles" + image apaisante
- Loading : skeleton 3 carousels
- Error : message + bouton retry

**Composants** : `Header`, `HomeContent`, `stay-card`, `BottomNav`
**Données** : 27 séjours publiés via `getStaysData()`
**Pas de RGPD requis** (public, pas de collecte)

---

### 2. 🔴 `/sejour/[id]` — Fiche séjour détail

**Audience** : partagé (kids + pro)
**Objectif** : convertir vers inscription (pro) ou wishlist (kids).

**Structure** :
- Hero gallery (5 images : action, paysage, groupe, ambiance, detail)
- Titre + promesse + baseline
- Bloc essentiel : âge, durée, lieu
- Sessions disponibles avec dates + seatsLeft
- Prix (pro JWT) OU "Tarif communiqué aux pros" (kids)
- Programme, inclusions, logistique
- Villes départ + supplément transport
- CTA différencié selon mode

**CTA principal kids** : "Ajouter à mes souhaits" → `/sejour/[id]/souhait`
**CTA principal pro** : "Réserver" → `/sejour/[id]/reserver`
**CTA secondaire** : "Comparer" (feature nouvelle à valider) / "Télécharger brochure PDF"

**États** :
- Séjour complet : badge "Complet" sur sessions + CTA "Être prévenu" si liste d'attente
- Loading : skeleton hero + sections
- Not found : 404 avec suggestion 3 séjours similaires

**Composants** : `StayDetail`, `stay-card`, `PriceInquiryBlock` (kids)
**Données** : `gd_stays` complet + `gd_stay_sessions` + `gd_session_prices`

---

### 3. 🟡 `/sejour/[id]/souhait` — Formulaire wishlist kid

**Audience** : kids uniquement
**Objectif** : collecte motivation + envoi à éducateur référent.

**Structure** :
- Rappel séjour (mini-card)
- Bloc motivation texte libre (max 500 chars)
- Choix d'origine : seul·e / avec un·e ami·e / choix de l'équipe / découvert sur l'app
- Champ prénom kid (éventuellement anonymisable)
- Champ email référent OU sélection dans liste si link éducateur
- **Bloc RGPD obligatoire** avant soumission (qui voit, pourquoi, durée conservation)

**CTA principal** : "Envoyer à mon·ma référent·e"
**États** : success = confirmation + retour `/envies`

**Composants** : formulaire custom + `<Button>`, `<Textarea>`, `<Label>`, `<Checkbox>` RGPD
**RGPD** : ✅ consentement + traçabilité

---

### 4. 🟡 `/envies` — Liste wishlist kids

**Audience** : kids
**Objectif** : suivre l'état des souhaits envoyés.

**Structure** :
- Liste items wishlist (localStorage)
- Pour chaque : mini-card séjour + statut (emis/vu/en_discussion/valide/refuse) + réponse référent si dispo
- Filtres statut en chips
- Badge count dans bottom nav

**États** :
- Vide : illustration + "Tu n'as pas encore de souhait. Explore les séjours !" + CTA `/`
- Loading : skeleton 3 items
- Error : retry

**Composants** : `<Card>`, `<Badge>` par statut, `<Chip>` filtres
**Données** : localStorage + sync optional avec `gd_souhaits` si email référent connu

---

### 5. 🟢 `/recherche` — Recherche / filtres

**Audience** : partagé
**Objectif** : trouver un séjour par critères.

**Structure** :
- Barre recherche (texte libre)
- Bouton "Filtres" → ouvre `FilterSheet`
- Liste résultats : grid 2 cols mobile / 3-4 cols desktop
- Chips filtres actifs + "Réinitialiser"

**États** :
- Vide (aucun résultat) : "Aucun séjour ne correspond. Essaie d'autres filtres." + reset
- Loading : skeleton grid
- Error : retry

**Composants** : `SearchFilterBar`, `FilterSheet`, `stay-card` grid

---

## Authentification & parcours accès

### 6. 🔴 `/login` — Login pro

**Audience** : référent (pros structures sociales)
**Objectif** : se connecter avec email + mot de passe (JWT pro).

**Structure** :
- Toggle contexte : "Référent·e" / "Jeune" (novateur Claude Design — si adopté, /login devient point d'entrée unique)
- Champ email + mot de passe
- Lien "Mot de passe oublié" → `/login/reset`
- Lien "Pas encore de compte ?" → `/acceder-pro`
- État erreur visible (role="alert")

**CTA principal** : "Se connecter"
**États** : erreur identifiants (générique pour sécurité), succès → redirection selon rôle

**RGPD** : mot de passe jamais logué, rate-limit anti brute-force

---

### 7. 🟢 `/login/reset` — Mot de passe oublié

**Audience** : référent
**Structure** :
- Champ email
- Message "Indique ton email, si un compte existe, on t'envoie un lien"
- État succès même si email inconnu (pas de énumération)

**CTA principal** : "Envoyer le lien"
**Rate-limit** obligatoire

---

### 8. 🟡 `/acceder-pro` — Demande accès pro

**Audience** : nouveau pro sans compte
**Objectif** : demander un accès en fournissant structure + justificatif.

**Structure** :
- Champs : nom, prénom, email pro, nom structure, code postal, fonction
- Bloc RGPD obligatoire
- Zone upload optionnelle (justificatif)

**CTA principal** : "Envoyer ma demande"
**États** : success = "Demande reçue. On te répond sous 48h."
**Rate-limit** : 2 req/60min par email

---

### 9. 🟡 `/inscription-urgence` — Inscription magic link 24h

**Audience** : éducateur invité par admin GED via JWT magic link
**Objectif** : créer une inscription urgence enfant sans compte.

**Structure** :
- Bandeau "Demande urgente" (orange `bg-amber-50`)
- Rappel JWT info : séjour, session, ville de départ pré-remplis
- Formulaire enfant + référent
- Bloc RGPD
- Mention "Lien expiré dans 24h"

**CTA principal** : "Valider l'inscription"
**États** : JWT expiré → 410 + lien demande renvoi

---

## Parcours référent (suivi enfant)

### 10. 🟡 `/educateur/souhaits/[token]` — Inbox souhaits éducateur

**Audience** : éducateur référent via suivi_token
**Objectif** : voir tous les souhaits des kids qu'il encadre.

**Structure** :
- Tableau ou liste cards
- Filtres statut : Nouveau / Lu / En discussion / Validé / Refusé
- KPI en haut : nb total + nb nouveaux
- Clic item → `/educateur/souhait/[token]` détail

**États** : Empty = "Aucun souhait pour le moment"

---

### 11. 🟡 `/educateur/souhait/[token]` — Détail souhait

**Audience** : éducateur référent
**Structure** :
- Info kid (prénom anonymisé)
- Séjour désiré (mini-card)
- Motivation texte libre
- Mode de choix
- Timeline réponses
- Zone réponse (textarea)
- Boutons : "Valider" / "Pas cette fois" / "En discussion"

**CTA principal** : "Répondre"
**États** : envoi en cours, succès, erreur

---

### 12. 🔴 `/sejour/[id]/reserver` — Inscription pro + paiement

**Audience** : référent pro authentifié JWT
**Objectif** : inscrire un enfant + payer.

**Structure multi-step** :
1. **Récapitulatif** : séjour, session, ville départ, prix
2. **Référent** : coordonnées pré-remplies si JWT
3. **Enfant** : nom, prénom, date naissance, genre
4. **Dossier** : lien génération `/suivi/[token]`
5. **Paiement** : choix méthode (CB Stripe / virement / chèque / prise en charge structure)
6. **Confirmation** : référence inscription + emails envoyés

**CTA par étape** : "Suivant"
**État dernier** : redirection confirmation + email

**Composants** : `BookingFlow` (1500+ lignes)
**RGPD** : ✅ consentement explicite données enfant avant création

---

## Pages légales (support)

### 13. 🟢 `/cgu` — Conditions générales utilisation

**Audience** : partagé
**Structure** : page texte long avec table des matières latérale (optionnel)
**Accessible** : sans JWT

### 14. 🟢 `/cgv` — Conditions générales vente

**Audience** : partagé
**Structure** : identique CGU

### 15. 🟢 `/confidentialite` — Politique RGPD

**Audience** : partagé (référencée par toutes les notices)
**Structure** : sections numérotées : finalité / base légale / destinataires / durée / droits / DPO
**Lien depuis** : toutes les notices RGPD dans formulaires

### 16. 🟢 `/mentions-legales` — Mentions légales

**Audience** : partagé
**Structure** : éditeur, hébergeur, responsable publication, SIREN

---

## Accès structure (pro staff)

### 17. 🟡 `/structure/login` — Login par code structure

**Audience** : staff structure
**Objectif** : accéder au dashboard structure via code (pas JWT pro classique).

**Structure** :
- Champ code (6 chars CDS OU 10 chars Directeur)
- Champ email (obligatoire si activation invitation)
- Champ mot de passe si compte activé
- Lien "Activer mon invitation" → `/structure/activate`

**CTA** : "Accéder"
**Différence vs `/login`** : auth par code structure + session JWT structure spécifique, scope limité à la structure

---

### 18. 🟡 `/structure/activate` — Activation invitation équipe

**Audience** : nouveau membre équipe (secrétariat, éducateur, direction invité)
**Objectif** : activer compte via token email + définir mot de passe.

**Structure** :
- Token URL `/structure/activate?token=xxx`
- Rappel : "Bienvenue {prénom} — structure {nom}"
- Champ mot de passe + confirmation
- Indicateur force password
- Bloc RGPD
- CTA : "Activer mon compte"

**États** :
- Token expiré (>48h) → message + demander nouveau lien
- Token invalide → 404

---

### 19. 🔴 `/structure/[code]` — Dashboard structure (HORS scope Claude Design phase 1)

**Audience** : direction/CDS/cds_delegated/secretariat/éducateur
**À designer en Phase 2** — 21 sous-écrans composants.

---

### 20. 🔴 `/suivi/[token]` — Dashboard référent enfant (HORS scope Phase 1)

**Audience** : référent via suivi_token
**À designer en Phase 2** — 7 composants (formulaires dossier + upload + signature + RGPD Art.9).

---

## États & erreurs globaux

### 21. `app/error.tsx` — Erreur globale
Message apaisé + bouton "Réessayer" + lien accueil

### 22. `app/not-found.tsx` — 404
Illustration + "Cette page n'existe pas ou plus" + CTA accueil + barre recherche

---

## Synthèse

- **22 routes B2C spec** (hors dashboards)
- **Parcours critiques (🔴) : 4** (home, fiche séjour, reserver, login)
- **Parcours importants (🟡) : 10**
- **Pages légales/utilitaires (🟢) : 8**
- **Composants réutilisés** : 50+ (tous shadcn dans `components/ui/`)

**Pour Claude Design** : utilise ce spec comme brief par écran. Chaque section t'indique audience, objectif, structure, CTA, états, RGPD, composants repo.

---

**Préparé 2026-04-19 · Réf repo `/Users/laidhamoudi/Dev/GED_APP`**
