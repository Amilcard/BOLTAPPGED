# Audit structurel GED App — Cartographie exhaustive
**Date : 10 avril 2026** | **Périmètre : app/, components/, app/api/**

---

## 1. Arborescence pages

| Route | Export | Layout | Auth | Rôle min. |
|-------|--------|--------|------|-----------|
| `/` | HomePage | root | Aucun | Public |
| `/sejours` | Redirect → `/` | root | Aucun | Public |
| `/sejour/[id]` | StayPage | root | Aucun | Public |
| `/sejour/[id]/reserver` | ReserverPage | root | JWT cookie `gd_session` | Admin (problème UX identifié) |
| `/recherche` | SearchPage | root | Aucun | Public |
| `/envies` | EnviesPage | root | Aucun (localStorage kid_session_token) | Public/Kid |
| `/educateur/souhaits/[token]` | EducateurSouhaitsPage | root | Token magique URL | Magic link |
| `/educateur/souhait/[token]` | EducateurSouhaitPage | root | Token magique URL | Magic link |
| `/suivi/[token]` | SuiviProPage | root | Token magique URL | Magic link |
| `/login` | LoginPage | root | Aucun (page de login) | Public |
| `/login/reset` | ResetPage | root | Supabase auth flow | Public |
| `/acceder-pro` | AccederProForm | root | Rate-limited | Public |
| `/structure/login` | StructureLoginPage | root | Code 6/10 chars | CDS/Directeur |
| `/structure/[code]` | StructureDashboard | root | Code validation API | CDS/Directeur |
| `/admin` | AdminDashboard | admin | middleware.ts JWT | Admin |
| `/admin/sejours` | AdminSejours | admin | middleware.ts | Admin |
| `/admin/sessions` | AdminSessions | admin | middleware.ts | Admin |
| `/admin/demandes` | AdminDemandes | admin | middleware.ts | Admin |
| `/admin/demandes/[id]` | AdminDemandeDetail | admin | middleware.ts | Admin |
| `/admin/propositions` | AdminPropositions | admin | middleware.ts | Admin |
| `/admin/structures` | AdminStructures | admin | middleware.ts | Admin |
| `/admin/users` | AdminUsers | admin | middleware.ts + ADMIN check | ADMIN only |
| `/cgu` | CGUPage | root | Aucun | Public |
| `/cgv` | CGVPage | root | Aucun | Public |
| `/confidentialite` | ConfidentialitePage | root | Aucun | Public |
| `/mentions-legales` | MentionsPage | root | Aucun | Public |
| `/infos` | InfosPage | root | Aucun | Public |

**Middleware matcher :** `/admin/:path*`, `/api/inscriptions`, `/api/souhaits`, `/api/payment/create-intent`

---

## 2. Parcours utilisateurs

### Kid (sans auth)
```
/ → /sejour/[id] → WishlistModal → /envies
```

### Éducateur (magic link)
```
Email → /educateur/souhaits/[token] → action valider → redirect /sejour/[id]/reserver
```

### Pro inscripteur
```
/sejour/[id] → ProGateModal (email) → /acceder-pro ou /sejour/[id]/reserver → BookingFlow
```
Problème identifié : `/reserver` exige JWT admin, le pro n'a pas de compte.

### Référent suivi (magic link)
```
Email → /suivi/[token] → DossierEnfantPanel → upload → submit
```

### Chef de service (code 6 chars)
```
/structure/login → /structure/[code] (dashboard inscriptions structure)
```

### Directeur (code 10 chars)
```
/structure/login → /structure/[code] (+ RGPD consent + délégation + settings)
```

### Admin GED (JWT + 2FA)
```
/login → /admin → sejours, sessions, demandes, propositions, structures, users
```

### Culs-de-sac détectés
- `/acceder-pro` success : lien retour séjour mais pas de `/login` direct
- `/suivi/[token]` après submit dossier : reste sur page avec message succès

---

## 3. API endpoints

### Routes publiques (pas d'auth)
| Méthode | Path | Rate-limit | Appelée par |
|---|---|---|---|
| POST | `/api/inscriptions` | 5/5min | BookingFlow |
| POST | `/api/souhaits` | 10/5min | WishlistModal |
| POST | `/api/payment/create-intent` | 5/5min | BookingFlow Stripe |
| POST | `/api/waitlist` | Non | WaitlistBlock |
| GET | `/api/pdf/[slug]` | Non | Liens PDF |

### Routes magic link (token URL)
| Méthode | Path | Appelée par |
|---|---|---|
| GET | `/api/educateur/souhaits/[token]` | EducateurSouhaitsPage |
| PATCH | `/api/educateur/souhait/[token]` | Actions souhait |
| GET | `/api/suivi/[token]` | SuiviProPage |
| PATCH | `/api/suivi/[token]` | PreferencesBlock |
| PATCH | `/api/suivi/[token]/structure` | Rattachement structure |
| POST | `/api/suivi/resend` | ResendLinkBlock |
| GET | `/api/souhaits/kid/[kidToken]` | EnviesPage |
| POST | `/api/souhaits/link-inscription` | Liaison souhait-inscription |

### Routes dossier enfant (token + ownership)
| Méthode | Path | Guard |
|---|---|---|
| GET | `/api/dossier-enfant/[inscriptionId]` | verifyOwnership |
| PATCH | `/api/dossier-enfant/[inscriptionId]` | verifyOwnership |
| POST | `/api/dossier-enfant/[inscriptionId]/upload` | verifyOwnership + MIME + magic bytes |
| DELETE | `/api/dossier-enfant/[inscriptionId]/upload` | verifyOwnership + IDOR guard |
| POST | `/api/dossier-enfant/[inscriptionId]/submit` | verifyOwnership + complétude |
| GET | `/api/dossier-enfant/[inscriptionId]/pdf` | verifyOwnership |
| POST | `/api/dossier-enfant/[inscriptionId]/pdf-email` | verifyOwnership |
| GET | `/api/inscriptions/[id]/recap-pdf` | suivi_token ownership |

### Routes structure (code-based)
| Méthode | Path | Rôle |
|---|---|---|
| GET | `/api/structure/[code]` | CDS/Directeur |
| POST | `/api/structure/[code]` | RGPD consent |
| PATCH | `/api/structure/[code]/delegation` | Directeur only |
| PATCH | `/api/structure/[code]/settings` | Directeur only |
| GET | `/api/structures/search` | Public |
| GET | `/api/structures/verify/[code]` | Public (BookingFlow onBlur) |

### Routes admin (JWT + middleware)
| Méthode | Path | Guard |
|---|---|---|
| GET | `/api/admin/stats` | verifyAuth |
| GET/POST | `/api/admin/stays` | requireEditor |
| GET/PUT/DELETE | `/api/admin/stays/[id]` | requireEditor |
| GET/POST | `/api/admin/stays/[id]/sessions` | requireEditor |
| GET/POST/PATCH | `/api/admin/stays/[id]/sessions/[sessionId]` | requireEditor |
| POST | `/api/admin/stays/[id]/notify-waitlist` | requireEditor |
| GET | `/api/admin/stays/slug/[slug]` | requireAdmin |
| GET/POST | `/api/admin/session-prices` | requireEditor |
| GET/POST/PATCH/DELETE | `/api/admin/propositions` | requireEditor |
| GET | `/api/admin/propositions/pdf` | requireEditor |
| GET | `/api/admin/inscriptions` | requireEditor |
| GET/PUT | `/api/admin/inscriptions/[id]` | requireEditor |
| DELETE | `/api/admin/inscriptions/[id]` | requireAdmin |
| POST | `/api/admin/inscriptions/[id]/relance` | requireEditor |
| POST | `/api/admin/inscriptions/manual` | requireEditor |
| GET/POST/PATCH/DELETE | `/api/admin/structures` | verifyAuth |
| POST | `/api/admin/structures/[id]/regenerate-code` | requireAdmin |
| POST | `/api/admin/structures/link` | requireEditor |
| POST | `/api/admin/structures/merge` | requireAdmin |
| GET/POST/PATCH/DELETE | `/api/admin/users` | requireAdmin |
| GET/PUT/DELETE | `/api/admin/users/[id]` | requireAdmin |
| GET | `/api/admin/dossier-enfant/[inscriptionId]` | requireEditor |

### Routes auth
| Méthode | Path | Guard |
|---|---|---|
| POST | `/api/auth/login` | Rate-limited (5/15min) |
| POST | `/api/auth/2fa/setup` | JWT |
| POST | `/api/auth/2fa/confirm` | JWT + TOTP |
| POST | `/api/auth/2fa/verify` | pendingToken |
| POST | `/api/auth/2fa/disable` | JWT |

### Routes cron
| Méthode | Path | Guard | Schedule |
|---|---|---|---|
| GET | `/api/cron/rgpd-purge` | CRON_SECRET Bearer | 0 3 1 * * |

### Routes webhook
| Méthode | Path | Guard |
|---|---|---|
| POST | `/api/webhooks/stripe` | Stripe signature |

---

## 4. Composants partagés

| Composant | Utilisations | Doublons |
|---|---|---|
| Header | 5+ pages | — |
| BottomNav | 3+ pages | — |
| Logo | admin layout, header, footer | — |
| StayCard | home, recherche | — |
| WishlistModal | StayDetail | — |
| ProGateModal | header (StayDetail) | — |
| BookingFlow | /reserver | — |
| DossierEnfantPanel | /suivi, /admin/demandes/[id] | 5 sous-composants |
| PaymentMethodSelector | BookingFlow | — |
| SearchFilterBar | /recherche | — |
| FilterSheet | SearchFilterBar | — |
| PeriodFilter | SearchFilterBar | — |
| ActiveFilterChips | SearchFilterBar | — |
| HomeCarousels | HomePage | — |
| Footer | global | — |
| CheckInstructions | BookingFlow | — |
| TransferInstructions | BookingFlow | — |
| AdminUI (Provider) | admin layout | — |
| DossierBadge | admin + **doublon local dans structure/[code]** | **À consolider** |
| Providers | root layout | — |
| ThemeProvider | Providers | — |

**Doublon détecté :** `DossierBadge` existe en composant admin ET en fonction locale dans `structure/[code]/page.tsx`.

---

## Chiffres clés

| Métrique | Valeur |
|---|---|
| Pages | 27 |
| Routes API | 49 |
| Composants | 27 (dont 5 sous-composants dossier) |
| Parcours utilisateurs | 7 profils |
| Culs-de-sac | 2 |
| Doublons composants | 1 (DossierBadge) |
