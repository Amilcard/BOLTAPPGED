# Inventaire tests GED App — 10 avril 2026

## Compteurs

| Métrique | Valeur |
|---|---|
| Fichiers tests | 34 |
| Suites (describe) | 83 |
| Tests (it) | 318 |
| Tests skippés (it.skip) | 5 |
| Suites skippées (describe.skip) | 1 |

---

## Tests API (27 fichiers)

### admin-inscriptions-crud.test.ts
| Test | Description |
|---|---|
| GET /api/admin/inscriptions | retourne 401 sans auth |
| | retourne 401 si rôle VIEWER |
| | retourne 200 avec liste si EDITOR |
| | filtre ?status appliqué (ADMIN) |
| GET /api/admin/inscriptions/[id] | retourne 401 sans auth |
| | retourne 404 si inscription inexistante |
| | retourne 200 avec données inscription (ADMIN) |
| PUT /api/admin/inscriptions/[id] | retourne 400 si statut invalide |
| | retourne 400 si body vide |
| | retourne 200 si EDITOR met à jour statut |
| DELETE /api/admin/inscriptions/[id] | retourne 401 si EDITOR (réservé ADMIN) |
| | retourne 200 si ADMIN supprime |

### admin-routes-gap.test.ts
| Test | Description |
|---|---|
| GET /api/admin/stats | sans auth → 401 |
| | EDITOR → 200 + structure clés attendues |
| GET /api/admin/stays/[id]/sessions | sans auth → 401 |
| | EDITOR → 200 + mapping camelCase |
| GET /api/admin/session-prices | sans auth → 401 |
| | stay_slug absent → 400 |
| | stay_slug fourni + EDITOR → 200 |
| POST /api/admin/stays/[id]/notify-waitlist | sans auth → 403 |
| | VIEWER → 403 (EDITOR requis) |
| GET /api/admin/dossier-enfant/[inscriptionId] | sans auth → 401 |
| | EDITOR → 200 + exists:false si dossier absent |

### admin-stays.test.ts
| Test | Description |
|---|---|
| GET /api/admin/stays | 401 sans auth |
| | 200 avec auth valide |
| PUT /api/admin/stays/[id] | 401 sans auth |
| | 200 toggle published |
| | 400 si body vide |
| DELETE /api/admin/stays/[id] | 401 sans auth |
| | 200 avec auth EDITOR |
| GET /api/admin/stays/slug/[slug] | 401 sans auth |
| | 401 si EDITOR (ADMIN only) |
| | 200 si ADMIN |

### admin-users.test.ts
| Test | Description |
|---|---|
| GET /api/admin/users | 403 sans auth |
| | 403 si EDITOR (ADMIN only) |
| | 200 avec liste si ADMIN |
| POST /api/admin/users | 403 sans auth |
| | 403 si EDITOR |
| | 400 si champs manquants |
| | 400 si rôle invalide |
| | 201 si ADMIN crée utilisateur |

### auth-2fa.test.ts
| Test | Description |
|---|---|
| POST /api/auth/2fa/setup | sans JWT → 401 |
| | JWT valide → 200 + qrCodeUrl + secret |
| | sauvegarde en base enabled: false |
| POST /api/auth/2fa/confirm | sans JWT → 401 |
| | 2FA non configurée → 404 |
| | code TOTP invalide → 400 |
| | code TOTP valide → 200 + enabled: true |
| POST /api/auth/2fa/verify | pendingToken manquant → 400 |
| | pendingToken JWT invalide → 401 |
| | token sans pending2fa → 401 |
| | 2FA non activée → 400 |
| | code TOTP invalide → 400 |
| | code TOTP valide → 200 |

### auth-login.test.ts
| Test | Description |
|---|---|
| POST /api/auth/login | 400 si email manquant |
| | 400 si password manquant |
| | 429 si rate limit dépassé |
| | 401 si identifiants invalides (anti-énumération) |
| | 200 + { ok, token } |
| | cookie gd_session posé |
| | JWT contient role correct |
| | 500 si NEXTAUTH_SECRET absent |

### dossier-enfant.test.ts
| Test | Description |
|---|---|
| POST submit | 400 si dossier incomplet |
| | 409 si déjà envoyé |
| | 400 si token manquant |
| | 400 si token non-UUID |
| POST upload | 400 si MIME interdit (.exe) |
| | 400 si type document invalide |
| | 400 si fichier > 5 Mo |
| | 400 si token absent |
| DELETE upload | 403 si storage_path IDOR |
| | 400 si storage_path manquant |
| POST relance | 200 si dossier incomplet + admin |
| | 401 sans session admin |
| | 404 si inscription inexistante |
| | 409 si dossier déjà envoyé |

### dossier-get.test.ts
| Test | Description |
|---|---|
| GET /api/dossier-enfant/[id] | 400 si token manquant |
| | 404 si ownership invalide |
| | dossier inexistant → squelette + docs_optionnels |
| | séjour sans docs optionnels → manquants vide |
| | pass_nautique requis + non uploadé → dans manquants |
| | pass_nautique requis + uploadé → absent des manquants |
| | autorisation_parentale → mappé vers signature_parentale |
| | plusieurs docs partiellement couverts → seuls manquants listés |

### dossier-submit.test.ts
| Test | Description |
|---|---|
| POST submit | 400 si token manquant |
| | 400 si token non-UUID |
| | 404 si token inconnu |
| | 403 si email ne match pas |
| | 404 si dossier introuvable |
| | 409 anti-doublon |
| | 400 si dossier incomplet |
| | 200 dossier complet |
| | renseignements non-requis → OK |
| | doc optionnel requis manquant → 400 |
| | doc optionnel requis présent → 200 |

### dossier-upload.test.ts
| Test | Description |
|---|---|
| POST upload | 400 type document invalide |
| | 400 fichier manquant |
| | 400 fichier > 5 Mo |
| | 404 ownership invalide |
| | 201 upload vaccins |
| | 201 bulletin_signe → completed true |
| | 201 sanitaire_signe → completed true |
| | 201 liaison_signe → completed true |
| | upload signé dossier inexistant → crée + completed |
| DELETE upload | 403 IDOR |
| | DB réussit → storage supprimé |
| | DB échoue → storage NON supprimé |

### educateur-souhait.test.ts
| Test | Description |
|---|---|
| GET /api/educateur/souhait/[token] | 400 token invalide |
| | 404 token inexistant |
| | auto-transition emis → vu |
| | pas de re-transition si déjà vu |
| PATCH | 400 token invalide |
| | 400 statut invalide |
| | 409 déjà validé |
| | 409 déjà refusé |
| | 200 PATCH valide |
| | reponseEducateur vide → null |

### inscriptions-virement.test.ts
| Test | Description |
|---|---|
| POST /api/inscriptions | 400 email manquant |
| | 400 consent false |
| | 400 âge hors tranche |
| | bank_transfer → payment_method=transfer |
| | cheque → payment_method=check |
| | paymentMethod invalide → 400 |
| | structurePostalCode invalide → 400 |
| | structureName vide → 400 |
| | priceTotal négatif → 400 |

### inscriptions.test.ts
| Test | Description |
|---|---|
| POST /api/inscriptions | ~~crée inscription avec payment_reference~~ (SKIP) |
| | rejette sans consentement |
| | rejette email invalide |
| | rejette prix négatif |
| | rejette priceTotal à 0 |

### parcours-complet.test.ts
| Test | Description |
|---|---|
| P1 — Inscription | crée inscription → id + suivi_token + dossier_ref |
| | inscription visible en base |
| P2 — Dossier 4 blocs | valide bulletin → completed |
| | valide sanitaire → completed |
| | valide liaison → completed |
| | valide renseignements → completed |
| | 4 blocs à true en base |
| P3 — Soumission | soumet dossier complet → 200 |
| | 2ème soumission → 409 anti-doublon |
| | ged_sent_at non null |
| P4 — Upload | upload PDF valide → 200 |
| P5 — Statut admin | passe en validee |
| | passe en refusee |
| | statut persisté en base |
| P6b — Anti-doublon | annulée ne bloque pas nouvelle inscription |
| P6 — Badge retard | détecte inscriptions > 7j sans dossier |

### payment-create-intent.test.ts
| Test | Description |
|---|---|
| POST /api/payment/create-intent | 400 inscriptionId manquant |
| | 400 suivi_token manquant |
| | 404 ownership mauvais token |
| | 400 price_total = 0 |
| | 400 price_total négatif |
| | 200 création réussie |
| | idempotent si intent existe |
| | race condition → récupère intent concurrent |

### rls-security.test.ts
| Test | Description |
|---|---|
| RLS anon | ~~skippé si pas de Supabase réel~~ |
| | gd_souhaits lecture anon refusée |
| | gd_stays INSERT anon refusé |
| | gd_stays UPDATE anon refusé |

### security-admin-access.test.ts
| Test | Description |
|---|---|
| POST structures/merge | sans auth → 403 |
| | EDITOR → 403 (ADMIN only) |
| | VIEWER → 403 |
| | sourceId === targetId → 400 |
| | UUIDs invalides → 400 |
| PATCH structures/link | sans auth → 403 |
| | VIEWER → 403 |
| POST inscriptions/[id]/relance | sans auth → 401 |
| /api/admin/propositions | GET sans auth → 401 |
| | POST sans auth → 401 |
| | PATCH sans auth → 401 |
| | DELETE sans auth → 401 |

### security-ownership.test.ts
| Test | Description |
|---|---|
| GET dossier-enfant | token absent → 400 |
| | token non-UUID → 400 |
| | token inconnu → 404 |
| | IDOR référent B lit A → 403 |
| PATCH dossier-enfant | token absent → 400 |
| | bloc non whitelist → 403 |
| | IDOR référent B patch A → 403 |
| POST upload | type invalide → 400 |
| | MIME invalide → 400 |
| | IDOR upload → 403 |

### security-role-escalation.test.ts
| Test | Description |
|---|---|
| VIEWER propositions | POST → 401 |
| | PATCH → 401 |
| | DELETE → 401 |
| | GET → 200 (lecture OK) |
| | POST EDITOR → pas 401 |
| VIEWER relance | VIEWER → 401 |
| | sans auth → 401 |
| | EDITOR → pas 401 |

### souhaits-kid.test.ts
| Test | Description |
|---|---|
| GET /api/souhaits/kid/[kidToken] | token non-UUID → 400 |
| | token invalide court → 400 |
| | token valide, aucun souhait → vide |
| | token valide → bonnes colonnes |
| | triés par created_at DESC |
| POST /api/souhaits | kidSessionToken absent → 400 |
| | kidSessionToken non-UUID → 400 |
| | souhait complet → 201 + email |

### souhaits.test.ts
| Test | Description |
|---|---|
| POST /api/souhaits | 400 champs manquants |
| | 400 kidSessionToken non-UUID |
| | 400 email invalide |
| | 201 crée souhait |
| | email envoyé à l'éducateur |
| | extrait structure_domain pro |
| | pas de structure pour gmail |
| | doublon emis → mise à jour |
| | doublon validé → pas de MAJ |

### stays.test.ts (4 tests SKIP)
| Test | Description |
|---|---|
| | ~~retourne liste séjours~~ (SKIP — route non implémentée) |
| | ~~slug unique~~ (SKIP) |
| | ~~marketing_title ou title_kids~~ (SKIP) |
| | ~~séjour par slug~~ (SKIP) |

### structures.test.ts
| Test | Description |
|---|---|
| GET /api/structures/search | 400 CP manquant |
| | 400 CP invalide |
| | tableau vide si aucune structure |
| | structures avec email masqué |
| GET /api/structures/verify/[code] | valid:false si code court |
| | valid:true + infos si code valide |
| | valid:false si code inexistant |

### suivi-structure.test.ts
| Test | Description |
|---|---|
| PATCH /api/suivi/[token]/structure | 400 token invalide |
| | 400 body incomplet |
| | 400 code trop court |
| | 404 token inexistant |
| | 403 autre référent |
| | 409 déjà rattachée |
| | 404 code structure inexistant |
| | 200 rattachement OK |

### suivi-token.test.ts
| Test | Description |
|---|---|
| GET /api/suivi/[token] | 400 token non-UUID |
| | 404 token inconnu |
| | 200 dossiers du référent (isolation email) |
| PATCH /api/suivi/[token] | 400 token non-UUID |
| | 400 inscriptionId manquant |
| | 403 champ non whitelist |
| | 403 autre référent (isolation) |
| | 200 champ valide mis à jour |

### webhook-stripe.test.ts
| Test | Description |
|---|---|
| Webhook Stripe | 400 stripe-signature absent |
| | 400 signature invalide |
| | succeeded → paid |
| | montant différent → amount_mismatch |
| | event déjà traité → skip |
| | payment_failed → failed |
| | metadata sans inscriptionId → OK mais non enregistré |

---

## Tests unitaires (7 fichiers)

### auth-middleware.test.ts
| Test | Description |
|---|---|
| verifyAuth | null si aucun token |
| | null si token malformé |
| | null si token expiré |
| | null si secret absent |
| | payload si Bearer valide |
| | payload si cookie valide |
| | null si mauvais secret |
| requireAdmin | null si VIEWER |
| | null si EDITOR |
| | payload si ADMIN |
| requireEditor | null si VIEWER |
| | payload si EDITOR |
| | payload si ADMIN |

### env-config.test.ts
| Test | Description |
|---|---|
| getServerEnv() | SUPABASE_URL absente → throw |
| | SUPABASE_URL non-URL → throw |
| | STRIPE_SECRET sans sk_ → throw |
| | NEXTAUTH_SECRET trop court → throw |
| | toutes valides → retourne objet |

### metier-ged.test.ts
| Test | Description |
|---|---|
| calculateGedPrice | 7j sans ville avec promo |
| | 7j Paris avec promo |
| | casse insensible ville |
| | 14j, 21j, prorata 6j |
| | promo désactivée |
| | ville hors liste |
| | prix UFOVAL = 0 |
| isGedCity | ville connue → true |
| | hors liste → false |
| | sans_transport → false |
| calculateAgeAtDate | anniversaire passé |
| | anniversaire pas passé |
| | jour exact |
| | date invalide → null |
| validateChildAge | dans tranche → valid |
| | trop jeune → invalid |
| | trop vieux → invalid |
| | dates manquantes → invalid |
| | borne sup inclusive → valid |
| getDurationDays | même jour → 1 |
| | 7 jours, 14 jours |
| | dates invalides → 0 |

### middleware-config.test.ts
| Test | Description |
|---|---|
| middleware /admin | cookie absent → redirect /login |
| | cookie malformé → redirect |
| | JWT valide → accès accordé |
| | secret absent → redirect (fail-safe) |
| | JWT expiré → redirect |

### admin-ui.test.tsx
| Test | Description |
|---|---|
| AdminUIProvider | rend les children |
| ConfirmDialog | ouvre avec bon message |
| | Annuler ferme sans callback |
| | pendant async : disabled + label |
| Toast | error avec bon message |
| | success couleur différente |
| | useAdminUI hors contexte → throw |

### bottom-nav.test.tsx
| Test | Description |
|---|---|
| Mode Pro | Accueil, Recherche, Dossiers |
| | pas "Infos" |
| | pas "Mes souhaits" |
| | 3 boutons exactement |
| Mode Kids | Accueil, Recherche, Mes souhaits |
| | pas "Infos" |
| | pas "Dossiers" |
| | 3 boutons exactement |
| Masquage /admin | null sur /admin |
| | null sur /admin/stays/123 |
| | visible sur / |
| Skeleton | nav vide si mounted=false |
| isActive | Accueil actif sur / |
| | Accueil inactif sur /recherche |
| | Recherche actif sur /recherche |
| | Dossiers actif sur /suivi |
| | Mes souhaits actif sur /envies |
| Badge wishlist | pas de badge si vide |
| | badge = 3 |
| | badge 9+ |
| | pas de badge en Pro |
| Navigation | clic Accueil → push("/") |
| | clic Recherche → push("/recherche") |
| | clic Dossiers → push("/recherche") |
| | clic Mes souhaits → push("/envies") |

### dossier-badge.test.tsx
| Test | Description |
|---|---|
| DossierBadge | null → "Non commencé" |
| | 0/4 → "0/4 fiches" |
| | 2/4 → indicateurs B/S colorés |
| | 4/4 → "Complet" |
| | gedSentAt → "Envoyé" |
| | vaccins → indicateur V vert |
| | pj_count > 0 → indicateur PJ bleu |

### payment-method-selector.test.tsx
| Test | Description |
|---|---|
| PaymentMethodSelector | 3 options avec labels |
| | clic carte → onSelectStripe |
| | clic virement → onSelectTransfer |
| | clic chèque → onSelectCheck |

---

## Tests skippés (6)

| Fichier | Raison |
|---|---|
| inscriptions.test.ts:50 | `it.skip` — crée inscription avec payment_reference (serveur requis) |
| stays.test.ts:19,23,27,31 | `it.skip` × 4 — route /api/stays non implémentée |
| rls-security.test.ts:37 | `describe.skip` — pas de vraie instance Supabase (dynamique via env) |

---

## Couverture par domaine

| Domaine | Fichiers | Tests | Couverture |
|---|---|---|---|
| Auth (login, 2FA, middleware) | 4 | 38 | Forte |
| Admin CRUD (inscriptions, stays, users) | 4 | 33 | Forte |
| Sécurité (ownership, escalade, RLS, admin access) | 4 | 32 | Forte |
| Dossier enfant (CRUD, submit, upload) | 4 | 43 | Très forte |
| Souhaits (kids, éducateur) | 3 | 23 | Forte |
| Paiement (inscription, Stripe, intent) | 4 | 24 | Forte |
| Structures (search, verify, suivi) | 3 | 15 | Moyenne |
| Parcours complet (E2E mock) | 1 | 15 | Forte |
| UI (bottom-nav, badge, admin-ui, payment) | 4 | 34 | Forte |
| Métier (prix, âge, durée) | 1 | 18 | Forte |
| Env config | 1 | 5 | Suffisante |
| **TOTAL** | **34** | **318** | |
