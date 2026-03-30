---
name: GED_APP Project Context
description: Contexte produit, publics, conventions de design et tokens observés dans GED_APP (BOLTAPPGED) — mis à jour après audit complet messages d'erreur et parcours (2026-03-27)
type: project
---

Application GED — guichet unique séjours éducatifs 3-17 ans (Groupe & Découverte).

**Deux modes :**
- Mode kids : jeunes/enfants, vocabulaire tutoyer, CTA "Ajouter à mes souhaits"
- Mode pro : travailleurs sociaux / référents, vocabulaire vouvoyement, CTA "Inscrire un enfant"

**Stack visible :** Next.js App Router, Tailwind CSS, Stripe, Supabase.

**Tokens de couleur observés :**
- `primary` : couleur principale (bleu-vert foncé, #1a1a2e approx)
- `secondary` : couleur action principale (orange/terracotta, #e07a5f approx)
- `primary-50/100/200/300/400/500/600` : nuances du primary
- `secondary-600` : hover du secondary

**Spacing rhythm observé :** base 4px, valeurs fréquentes 8, 12, 16, 20, 24, 32px (p-3=12, p-4=16, p-6=24, p-8=32, gap-2=8, gap-3=12, gap-4=16)

**Boutons :** `rounded-full`, taille standard `py-3`, icône + texte, disabled via `opacity-50 cursor-not-allowed`

**Breakpoints utilisés :** md (768px), lg (1024-1280px), sm (640px)

**Termes métier observés :**
- "demande" = terme umbrella pour le processus
- "inscription" = terme technique DB / admin
- "souhait" = terme kids (wishlist)
- "dossier" = ensemble documentaire lié à une inscription
- "référent" / "travailleur social" = professionnel

**Architecture du parcours dossier enfant (audit 2026-03-25) :**
- Entrée : page /suivi/[token] (magic link envoyé au référent)
- Panel DossierEnfantPanel avec 5 onglets : Bulletin, Fiche sanitaire, Fiche de liaison, Renseignements, Pièces jointes
- 4 blocs obligatoires (bulletin, sanitaire, liaison, renseignements) + PJ optionnelles
- Chaque bloc : bouton "Enregistrer" (brouillon) + bouton "Valider" (marked completed)
- Bouton "Envoyer mon dossier" débloqué uniquement quand les 4 blocs sont validés
- Barre de progression (%) visible dans le panel ouvert
- Badges de statut (B/S/L/R/PJ) visibles sur le bouton d'en-tête (toggle fermé)
- AdminUI : confirm() et toast() via contexte React (plus de window.alert/confirm) — RÉSOLU vs audit précédent

**Problèmes récurrents identifiés lors du premier audit (2026-03-19) :**
- Incohérence terminologique demande/inscription/réservation entre les 5 fichiers
- Champs enfants sans `<label>` explicite (placeholder = seul identifiant) dans booking-flow step 3
- Libellé "Date de naissance" pointe vers le prix dans suivi/[token]/page.tsx ligne 265 (bug de copier-coller) — CORRIGÉ en audit 2026-03-27 (ligne 265 affiche bien la session date)
- Erreurs de validation inline en orange (#orange-600) alors que les bannières d'erreur sont en rouge — couleur erreur non uniforme
- Admin demandes : window.alert() et window.confirm() natifs pour les actions destructrices — RÉSOLU (AdminUIProvider)
- Admin demandes : aucun état de chargement pendant handleStatusChange — TOUJOURS PRÉSENT
- PreferencesBlock suivi : sauvegarde onBlur sans confirmation visuelle persistante (2s seulement)
- Sticky action bar mobile stay-detail masquée par la nav bottom (pb calc insuffisant possible)
- "Total estimé" dans booking-flow : wording "estimé" alors que c'est un prix ferme — trompeur (ligne 476 et 995)
- WishlistModal : bouton "Voir Mes souhaits" présent AVANT et APRES la sauvegarde → doublon

**Nouveaux problèmes identifiés audit pré-déploiement (2026-03-25) :**
- handleStatusChange dans admin/demandes/page.tsx : pas d'état loading, pas de confirmation avant changement de statut vers "Refusée"/"Annulée"
- Onglets dossier enfant : couleur active dynamique via template Tailwind (border-${tab.color}-500) — RÉSOLU : TAB_ACTIVE_STYLES statique confirmé dans DossierEnfantPanel.tsx lignes 34-40
- FicheSanitaireForm : champs requis marqués * mais aucune validation côté client avant "Valider"
- DocumentsJointsUpload : handleDelete utilise window.confirm() natif (pas le AdminUIContext)
- Tableau vaccinations : radio buttons sans name unique par ligne en contexte React — potentiel conflit si plusieurs dossiers ouverts simultanément (edge case)
- Admin detail [id] : "Enregistre" (faute d'accent) visible dans bandeau de confirmation
- Admin detail [id] : grille 2 colonnes fixes (grid-cols-2) sans adaptation mobile
- FicheRenseignementsForm : wording "Situation particulière / Handicap" — titre potentiellement stigmatisant pour certaines familles
- Alerte documents manquants visible AVANT ouverture du panel — bonne pratique, à conserver
- Bouton "Valider" de chaque bloc : disabled si case à cocher d'autorisation non cochée — mais aucun message expliquant pourquoi le bouton est grisé

**Rapport complet 20 problèmes UX — audit messages d'erreur (2026-03-27) :**

BLOQUANTS (5) :
1. suivi/[token] ligne 132 : "Accès impossible" sans contact ni explication de cause
2. suivi/[token] ligne 418 : PATCH préférences silencieux en cas d'erreur réseau (catch → console.error seulement)
3. DossierEnfantPanel.tsx ligne 68-70 : téléchargement PDF silencieux si erreur (catch → console.error seulement)
4. booking-flow.tsx step 0 (lignes 483-566) : si sessionsUnique.length === 0, aucun message affiché — liste vide sans explication
5. app/global-error.tsx : ABSENT — crash Next.js serveur = page blanche ou message anglais navigateur

MOYENS (9) :
6. suivi/[token] ligne 50 : badge "Refusée" rouge vif sans contexte ni action de contact
7. suivi/[token] ligne 57 : badge "Échoué" (paiement) rouge sans alternative ni instruction
8. booking-flow.tsx lignes 936-958 : bannière rouge "Âge incompatible" sans lien vers séjours alternatifs
9. booking-flow.tsx ligne 624 : "Villes de départ non disponibles." sans CTA ni contact
10. booking-flow.tsx ligne 946 : bannières erreurs étapes 3+4 rouge brut sans numéro contact
11. app/error.tsx ligne 16 : icône AlertCircle rouge + fond rouge — alarmant, pas de contact
12. booking-flow.tsx lignes 1117-1130 : "Paiement par carte non disponible" — message ambigu, pas de contact
13. DossierEnfantPanel.tsx lignes 221-224 : erreur chargement dossier "Erreur : {error}" brut sans contact
14. booking-flow.tsx step 5 (ligne 1143) : virement/chèque — "Elle sera confirmée dès réception" — délai non précisé, anxiogène

BAS (6) :
15. booking-flow.tsx ligne 999 : "Prix indisponible" en rouge dans récapitulatif — alarmant mais doublon du bloc amber dessous
16. booking-flow.tsx lignes 476 et 995 : "Total estimé" alors que le prix est ferme — wording trompeur
17. app/not-found.tsx : aucune information de contact ni lien utile
18. app/login/page.tsx ligne 80 : erreur "Identifiants incorrects" brut sans aide ni lien mot de passe oublié
19. DossierEnfantPanel.tsx lignes 415-418 : "N documents restants avant envoi" — neutre mais pas de lien rapide vers le premier document manquant
20. suivi/[token] : bloc "Contacts utiles" en bas de page — bon pattern mais non référencé depuis les états d'erreur

**Pages d'erreur personnalisées (inventaire complet 2026-03-27) :**
Présentes :
- app/not-found.tsx (404) — existe, neutre, pas de contact
- app/error.tsx — existe mais alarmant (rouge + pas de contact)
- app/login/error.tsx — existe (non inspecté en détail)
- app/login/loading.tsx — présent
- app/admin/error.tsx — présent (non inspecté)
- app/admin/loading.tsx — présent
- app/recherche/error.tsx — présent
- app/recherche/loading.tsx — présent
- app/sejour/[id]/error.tsx — présent
- app/sejour/[id]/loading.tsx — présent
- app/sejour/[id]/reserver/error.tsx — présent
- app/sejour/[id]/reserver/loading.tsx — présent
- app/sejours/error.tsx — présent
- app/sejours/loading.tsx — présent
Absentes (gaps critiques) :
- app/global-error.tsx — ABSENT (crash serveur Next.js = page blanche)
- app/suivi/[token]/error.tsx — ABSENT (couvert partiellement par état d'erreur inline)
- app/suivi/[token]/loading.tsx — ABSENT (couvert partiellement par spinner inline)

**Patterns UX à conserver (confirmés audit 2026-03-27) :**
- Bloc "Contacts utiles" en bas de suivi/[token] — à enrichir et relier aux erreurs
- Alerte documents manquants orange avec CTA (DossierEnfantPanel ligne 194) — pattern de référence
- Badge "Enregistré avec succès" 2s dans DossierEnfantPanel ligne 255 — correct
- Barre progression dossier — neutre et non anxiogène
- Bouton submit avec Loader2 + disabled pendant envoi — double soumission bloquée
- Encart amber "structure déjà enregistrée" (booking-flow ligne 770) — pattern d'aide proactif bien fait
- Step 5 (confirmation) : bloc récapitulatif complet + instructions paiement par mode — très bon pattern
- Spinner loading page suivi/[token] ligne 117 avec texte "Chargement de votre suivi..." — correct
