# État des lieux graphique — Dashboards + zones oubliées

> Compagnon de `docs/ETAT_DES_LIEUX_GRAPHIQUE.md`. Couvre dashboards
> + 16 catégories d'éléments visuels initialement omis.
> Compilé 2026-04-19 par 4 agents Claude Code spécialisés.

---

## Partie A — Dashboards en détail

### Dashboard structure `/structure/[code]`

**Audience** : Direction / CDS / CDS délégué / Secrétariat / Éducateur

**4 onglets** : Éducatif (défaut) · Équipe · Factures · Admin
+ Bandeau alertes séjour sticky + Box code accès (direction/cds)

**Onglet Éducatif** (`StructureEduTab.tsx`) — 6 sous-sections accordéon :
1. Enfants inscrits — KPI cards + liste cards → ChildTimeline
2. Incidents — 3 gravités × 3 statuts
3. Médical (Art.9) — compteur seul éducateur, détail direction/CDS
4. Appels — 5 types + sens + accord parents
5. Notes — non éditables après création
6. Bilan — lecture seule synthèse

**Modal staff-fill** (livré 2026-04-19) : bouton "Remplir en dépannage" → overlay `<DossierEnfantPanel mode='staff-fill'>` + bandeau bleu RGPD.

### Dashboard suivi `/suivi/[token]`

**Audience** : référent (éducateur via suivi_token sans JWT)

**Layout** : header minimal · bloc info inscription · notice RGPD bleue · barre progression · alerte docs manquants · 5 onglets formulaires · 3 PDF download · bouton submit GED.

**Composants critiques** :
- `DossierEnfantPanel` (conteneur tabs + save auto)
- 4 formulaires : Bulletin, Sanitaire (Art.9 obligatoire), Liaison, Renseignements
- `DocumentsJointsUpload` (PJ — pas de preview inline RGPD)
- `SignaturePad` (canvas + clear + état signé)
- `OfflineSignatureZone` (flow PDF physique)

### Patterns dashboards à respecter

| Pattern | Référence |
|---|---|
| KPI accordéon | `StructureEduTab.tsx:170-184` |
| Badge statut | `IncidentsPanel.tsx:190-198` |
| Timeline acteur visible | `ChildTimeline.tsx:128-157` |
| Bandeau RGPD Art.9 | `DossierEnfantPanel.tsx:511-526` |
| Notice médicale | `FicheSanitaireForm.tsx:100-105` |
| Mode dépannage | bandeau bleu permanent staff-fill |
| Save auto badge | "Enregistré HH:MM" 2.5s |

---

## Partie B — 16 catégories oubliées

### B.1 Templates emails HTML (23 fonctions `lib/email.ts`)

Chaque email = page visuelle utilisateur. HTML inline avec hex hardcodés (limite Resend SDK).

Exemples : `sendInscriptionConfirmation` · `sendPaymentConfirmedClient` · `sendDossierCompletEmail` · `sendIncidentNotification` · `sendTeamMemberInvite` · `sendPriceInquiryToEducateur` · `sendStructureCodeEmail` · `sendEducatorInviteEmail` · `sendChefDeServiceInvitation` · `sendPropositionEmail` · `sendRappelDossierIncomplet` · `sendStatusChangeEmail` · `sendAdminUrgenceNotification` · `sendPaymentFailedNotification` · `sendSouhaitNotificationEducateur` · `sendNewEducateurAlert` · `sendProAccessConfirmation` + 6 notifications admin GED internes.

**Action Claude Design** : design system email cohérent (header GED, footer RGPD, blocs info/success/warning/error standardisés).

### B.2 PDFs — 5 layouts distincts

| PDF | Source | Audience |
|---|---|---|
| Bulletin inscription | `public/templates/bulletin-inscription-template.pdf` | Référent (signe) |
| Fiche sanitaire | `public/templates/fiche-sanitaire-template.pdf` | Équipe + référent |
| Fiche liaison | `public/templates/fiche-liaison-template.pdf` | Équipe |
| Facture | `app/api/admin/factures/pdf/route.ts` | Structure |
| Proposition tarifaire | `lib/pdf-proposition.ts` | Demandeur (email) |

### B.3 Pages état (error / loading / not-found) — 23 instances

- `app/error.tsx` global + 7 par route
- `app/not-found.tsx` global 404
- 6 `loading.tsx` (skeleton patterns)

### B.4 Modals / Drawers / Sheets

| Composant | Variants |
|---|---|
| `pro-gate-modal.tsx` | 3 variants (kids-block, pro-verify, pro-auth) |
| `filter-sheet.tsx` | drawer mobile / side desktop |
| `payment-method-selector.tsx` | dialog confirm |
| `transfer-instructions.tsx` | dialog virement |
| `check-instructions.tsx` | dialog chèque |
| Modal staff-fill | overlay (livré 2026-04-19) |
| `<AlertDialog>` shadcn | confirmations destructives |

### B.5 Booking flow multi-step

`components/booking-flow.tsx` (1500+ lignes) = 5 étapes :
Référent → Enfant → Dossier → Paiement (Stripe CardElement custom hex hardcodé) → Confirmation.

### B.6 Composants vitrine

`stay-card` · `stay-detail` · `search-filter-bar` · `home-content` · `price-inquiry-block` · `pro-gate-modal`

### B.7 Signature & upload

- `SignaturePad` : canvas + Effacer + label "responsable légal" + état signé disabled
- `DocumentsJointsUpload` : drop zone + liste métadonnées (PAS de preview = RGPD)
- `OfflineSignatureZone` : flow PDF physique

### B.8 Onboarding sans compte (3 parcours)

- `/acceder-pro` (form + RGPD)
- `/inscription-urgence` (JWT 24h magic link)
- `/educateur/souhait[s]/[token]` (wishlist token-based)

### B.9 Header variants

`components/header.tsx` : prop `variant?: 'default'|'minimal'` (forcé minimal partout).

### B.10 Bottom nav (kids only)

`components/bottom-nav.tsx` : sticky z-40 · items Accueil/Recherche/Envies/Profil · badge count.

### B.11 Toasts (Sonner)

`components/ui/sonner.tsx` + `toaster.tsx` legacy.
Variants : success/error/warning/info · top-right · auto-dismiss 5s.

### B.12 Layout root

`app/layout.tsx` : font Rubik via next/font · metadata · providers (Supabase, Theme, Toaster) · `bg-brand-light` body.

### B.13 Pages légales

`/cgu` · `/cgv` · `/confidentialite` · `/mentions-legales` — table des matières ? Sections numérotées ?

### B.14 Composants admin (HORS scope mais existants)

`components/admin/admin-ui.tsx` + 14 pages admin. Claude Design **ne doit PAS y toucher**.

### B.15 Assets visuels

7 logos (`logo.svg`, `logo-ged.svg`, `logo-clean.svg`, `GLOGO GED NEW.svg`+png, favicon, og-image) + 3 templates PDF.
**Manquants probables** : illustrations vides, avatars placeholder, backgrounds décoratifs.

### B.16 Animations

`tailwind.config.ts` : 1 keyframe `pulse-subtle` seulement.
**Action Claude Design** : définir slide-in modals, fade transitions, skeleton shimmer, success checkmark.

---

## Récap inventaire augmenté

| Catégorie | Nombre |
|---|---|
| Routes front utilisateur | 22 |
| Sous-écrans dashboards | 21 (14 structure + 7 dossier-enfant) |
| **Templates emails HTML** | **23** |
| **PDFs distincts** | **5 layouts** |
| **Pages état (error/loading/404)** | **23** |
| **Modals/Drawers/Sheets** | **7+** |
| **Étapes booking flow** | **5** |
| **Composants vitrine** | **6** |
| **Signature/upload** | **3** |
| **Onboarding sans compte** | **3** |
| **Header/BottomNav variants** | **3** |
| **Pages légales** | **4** |
| **Composants UI shadcn** | **50** |
| **Logos/assets** | **7** |

**Total ≈ 200+ surfaces visuelles** (vs 50 initialement listées).

---

**4 agents Claude Code · État au 2026-04-19**
