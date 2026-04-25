# Handover — Fixes hors-PDF (session 2026-04-25)

Audit terrain Thanh + captures écran (parcours inscription en ligne, dossier complétude, espace pro). Zone PDF traitée en parallèle dans une autre session — voir `HANDOVER_PDF_DIAGNOSTIC_2026-04-25-bis.md`.

## Bugs corrigés (4 zones, 8 fichiers)

| Zone | File:line | Bug | Fix |
|---|---|---|---|
| payment | `components/booking-flow.tsx:475-491` | Bouton "Payer maintenant" reste actif après réponse serveur `CAPTCHA_FAILED` (token Turnstile stale en state) | Reset `turnstileToken` + `turnstileReady` sur erreur captcha → bouton se re-désactive automatiquement, widget Cloudflare ré-émet un token |
| payment | `app/api/inscriptions/route.ts:109-119` | Fallback gracieux sur Turnstile timeout = `console.error` invisible en prod (volume bypass anti-bot non surveillé) | Ajout `captureServerException` Sentry niveau `warning` + tag `domain: auth, operation: turnstile_fallback_allow`. Trade-off explicit : disponibilité > sécurité parfaite (CF down ne doit pas bloquer les paiements) |
| dossier | `components/dossier-enfant/DocumentsJointsUpload.tsx:204` | Bouton "Envoyer" reste actif après erreur "Fichier trop volumineux (max 5 Mo)" | `disabled={uploading \|\| !!error}` + reset error sur changement fichier (`onChange` input) |
| dossier | `components/dossier-enfant/DocumentsJointsUpload.tsx:148` | `window.confirm()` natif pour suppression document, viole charte graphique CLAUDE.md | Remplacé par `<AlertDialog>` Radix existant (`components/ui/alert-dialog.tsx`). State `docToDelete` pilote ouverture |
| auth | `app/structure/activate/ActivateClient.tsx:120` | Bouton "Activer mon compte" reste actif après "Au moins 12 caractères" | `disabled={loading \|\| !token \|\| !!error}` + reset error sur changement password/confirm |
| auth | `components/structure/StructureTeamTab.tsx:50-72, 130` | Sur 429 invitation, formulaire reste rempli + bouton actif (UX confuse) | State `rateLimitedUntil` lit header `Retry-After` (fallback 5min). `useEffect` réactive auto à expiration. Inputs + bouton désactivés pendant cooldown, label "Patientez…" |
| ui | `components/ui/dialog.tsx:34-37` | Pas d'override possible du backdrop opacité par caller | Prop optionnel `overlayClassName` sur `DialogContent` (purement additif, default inchangé pour les ~50 callers existants) |
| ui | `components/pro-gate-modal.tsx:101, 152, 190` | Modal "Espace réservé aux pros" laisse contenu lisible derrière (backdrop `bg-black/80` insuffisant pour gating UX) | Override ciblé : `overlayClassName="bg-black/90 backdrop-blur-sm"` sur les 3 variants (kids-block, pro-verify, pro-auth). Aucun impact sur les autres dialogs du repo |
| ui | `app/api/structure/[code]/route.ts:29` | Message "Format de code invalide" générique, UX faible | Message différencié email vs oral sans révéler le format exact (sécurité — éviter de guider le brute-force) |

## Hors-fix code — comportement Stripe attendu

Capture 12 ("Votre carte a été refusée. Mode production avec carte de test connue") = **comportement Stripe correct**, pas un bug. Clé `sk_live_*` refuse 4242 par construction.

**Recommandation Thanh** :
- Tester via preview branch (`./scripts/preview/create-branch.sh`) avec env Vercel preview pointant sur `sk_test_*` / `pk_test_*`. Là, 4242 marchera.
- Sur prod réelle, tester par virement bancaire ou chèque (les 2 méthodes ne touchent pas Stripe).

À documenter dans un ADR séparé si ce process devient récurrent.

## Vérifications post-commit

- `npx tsc --noEmit` → 0 erreur sur le delta
- Pas de migration SQL, pas de table touchée, pas de RGPD/auth flow modifié sur le fond (juste UX gating)
- 4 commits atomiques par zone (payment / dossier / auth / ui) — facilite revert ciblé si régression

## Tests manuels recommandés (avant validation Thanh suivante)

1. **Turnstile** : ouvrir DevTools, supprimer le cookie Turnstile, click Payer → bouton doit se re-désactiver
2. **Upload >5Mo** : sélectionner gros fichier → bouton Envoyer disabled, opacity 50%, cursor not-allowed. Sélectionner fichier OK → réactivation
3. **Suppression doc** : click X → AlertDialog Radix s'ouvre (pas confirm natif). Click Annuler → ferme sans action. Click Supprimer (rouge) → suppression
4. **Activation** : password 4 chars → bouton disabled. Compléter à 12 chars valides → réactivation
5. **Invitation rate-limit** : envoyer 5 invitations rapides → 429 → form désactivé pendant 5 min, label "Patientez…", réactivation auto sans reload
6. **Modal pro** : depuis `/sejour/[slug]` en mode Kids, déclencher gating → contenu derrière flouté + sombre, illisible

## Risques résiduels identifiés (hors scope cette session)

- `revoke()` dans `StructureTeamTab.tsx:73` utilise toujours `confirm()` natif (non signalé par Thanh, hors scope, à traiter en passe ultérieure)
- Pas de tests E2E Playwright sur les 9 fix (cf. `docs/TECH_DEBT.md` E2E items)
- Rate-limit timer côté client = best effort, pas de re-sync si user navigue entre tabs (acceptable)
