# État des lieux graphique — GED App (2026-04-19)

> Document de référence à partager avec Claude Design (ou tout outil externe
> travaillant sur l'identité visuelle). Extrait directement du repo — vérité terrain.

---

## 1. Palette complète

### Couleurs principales (tokens Tailwind)

| Token | Hex | Usage |
|---|---|---|
| `primary` / `brand-dark` | **#2a383f** | Titres, texte principal, bordures foncées |
| `secondary` / `brand-gold` | **#de7356** | **CTA, actions, focus ring, sélection** |
| `accent` / `brand-teal` | **#3d5260** | Accents hover, variantes |
| `muted` / `brand-light` | **#f1f1f1** | Fonds de section |
| `brand-white` | `#FFFFFF` | Cartes, pop-ins |
| `brand-border` | `#e5e7eb` | Bordures neutres |

### Échelles 50→900 disponibles

`primary-50` à `primary-900` (du `#f4f7f8` très clair au `#0e151a` très foncé)
`secondary-50` à `secondary-900` (du `#fdf8f6` très clair au `#6d3529` brun foncé)

### Règles strictes (jamais déviées)

- Primary = **titres et texte uniquement** — JAMAIS sur un CTA
- Secondary = **CTA et actions uniquement** — JAMAIS sur du texte courant
- Focus ring = `ring-secondary` partout (uniformité)
- Sélection texte = `secondary` (background orange sur selection)

---

## 2. Typographie

### Police unique

**Rubik** (Google Fonts) via `next/font/google` dans `app/layout.tsx`.

- `font-heading` = Rubik
- `font-sans` = Rubik

Variable CSS : `var(--font-rubik)`.

### Hiérarchie (définie dans `app/globals.css`)

**Échelle vitrine** (pages kids, home, sejour detail) :
- `h1` = `text-5xl md:text-6xl font-bold` (48→60px)
- `h2` = `text-4xl md:text-5xl font-bold` (36→48px)
- `h3` = `text-2xl md:text-3xl font-semibold` (24→30px)
- `p` = `text-base md:text-lg leading-relaxed` (16→18px)

**Échelle back-office** (pages pro, admin, dashboards) :
- Titres page = `text-2xl` max (24px)
- Titres section = `text-lg` (18px)
- Corps = `text-sm` (14px) pour densité

**Weight max** = `font-bold` (700). Pas de `extrabold` ni `black`.

**Max-width** : `h1`=70ch, `h2`=65ch, `h3`=60ch, `p`=65ch (lisibilité).

---

## 3. Radius

| Token | Valeur | Usage |
|---|---|---|
| `--radius` (CSS var) | **24px** | Composants shadcn par défaut |
| `rounded-brand` | **16px** | **Toutes les cartes** |
| `rounded-pill` | **50px** | Boutons CTA (forme pilule) |
| `rounded-lg` | `var(--radius)` = 24px | Dialogs, sheets |
| `rounded-md` | 22px | Dropdowns |
| `rounded-sm` | 20px | Petits éléments |

Règle : **pas de `rounded-xl` ni `rounded-2xl`** dans le design cible (tokens dédiés obligatoires).

---

## 4. Shadows

| Token | Valeur | Usage |
|---|---|---|
| `shadow-card` | `0 4px 12px rgba(0,0,0,0.08)` | **Cartes au repos** |
| `shadow-card-hover` | `0 8px 24px rgba(0,0,0,0.12)` | Cartes au survol |
| `shadow-brand` | variante bleu-gris teintée | Éléments brand |
| `shadow-brand-lg` | plus grande | Modals, pop-ins |
| `shadow-brand-xl` | maximum | Hero sections |

Règle : **pas de `shadow-md` / `shadow-lg` Tailwind par défaut** sur les cartes.

---

## 5. Spacings custom

- `spacing-section` = **120px** (espacement entre sections majeures)
- `spacing-card` = **80px** (espacement entre cartes)

---

## 6. Breakpoints

| Nom | Valeur |
|---|---|
| `xs` | 375px |
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |
| `2xl` | 1536px |

---

## 7. Iconographie

**Une seule librairie** : `lucide-react`.

Style : outline lignes fines, stroke cohérent.

Exemples utilisés partout : `ChevronRight`, `Check`, `X`, `Loader2`, `UserPlus`, `Trash2`, `Send`, `Clock`, `CheckCircle2`, `XCircle`, `FileText`, `ClipboardList`, `Stethoscope`, `Handshake`, `Paperclip`, `LockKeyhole`.

**Règle** : aucune icône d'une autre famille (Heroicons, Feather, Material, Tabler, Phosphor, SVG custom).

---

## 8. Composants UI disponibles (shadcn)

**50 composants** dans `components/ui/` — à utiliser systématiquement. Jamais de réinvention inline.

```
accordion, alert, alert-dialog, aspect-ratio, avatar, badge,
breadcrumb, button, calendar, card, carousel, checkbox,
collapsible, command, context-menu, date-range-picker, dialog,
drawer, dropdown-menu, form, hover-card, input-otp, input, label,
menubar, navigation-menu, pagination, popover, progress,
radio-group, resizable, scroll-area, select, separator, sheet,
skeleton, slider, sonner, switch, table, tabs, task-card,
textarea, toast, toaster, toggle, toggle-group, tooltip
+ AdminPagination (custom)
```

**Règle absolue** : remplacer tout `<button>` / `<input>` / `<div className="card">` inline par le composant shadcn correspondant.

---

## 9. Assets visuels

### Logos (dans `/public/`)

- `logo-ged.svg` — logo principal SVG
- `GLOGO GED NEW.svg` / `.png` — variante récente
- `logo-clean.svg` — version épurée
- `logo.svg` — legacy
- `favicon.svg` — icône onglet navigateur
- `og-image.png` — image Open Graph réseaux sociaux

### Templates PDF

`public/templates/` :
- `bulletin-inscription-template.pdf`
- `fiche-sanitaire-template.pdf`
- `fiche-liaison-template.pdf`

---

## 10. Composants d'app réutilisables (à NE PAS recréer)

| Composant | Fichier | Rôle |
|---|---|---|
| Header | `components/header.tsx` | Top nav responsive, logo + actions |
| Bottom Nav | `components/bottom-nav.tsx` | Nav mobile sticky (kids + pro) |
| Home Content | `app/home-content.tsx` | Carousels séjours par catégorie |
| Stay Card | `components/stay-card.tsx` | Carte séjour réutilisable |
| Stay Detail | `app/sejour/[id]/stay-detail.tsx` | Fiche séjour complète |
| Booking Flow | `components/booking-flow.tsx` | Parcours réservation + Stripe |
| Price Inquiry Block | `components/price-inquiry-block.tsx` | Formulaire tarif pro sans compte |
| Pro Gate Modal | `components/pro-gate-modal.tsx` | Switch kids → pro |
| Filter Sheet | `components/filter-sheet.tsx` | Filtres séjours drawer mobile |
| Search Filter Bar | `components/search-filter-bar.tsx` | Barre recherche |
| Payment Method Selector | `components/payment-method-selector.tsx` | Choix CB/virement/chèque |

---

## 11. 2 modes utilisateur — différenciation stricte

### Mode KIDS (public, sans compte JWT)

- **Cible** : parents + enfants 3-17 ans
- **Ton** : accueillant, visuel, émotionnel, chaleureux
- **Densité** : aérée, 1 action primaire par écran
- **Vocabulaire** : "je découvre", "mes envies", "mon séjour", "s'inscrire"
- **Typo** : échelle vitrine (`text-5xl`+ sur titres)
- **Images** : photos grand format séjours (montagne, océan, activités)

### Mode PRO (JWT structure requis)

- **Cible** : éducateurs, CDS, CDS délégué, direction, secrétariat (MECS/foyers ASE)
- **Ton** : efficace, dense, orienté action, professionnel
- **Densité** : élevée, filtres, tableaux, badges statut
- **Vocabulaire** : "inscription", "référent", "dossier", "bilan séjour", "structure"
- **Typo** : échelle back-office (`text-2xl` max)
- **Densité info** : haute — tableaux, badges, timelines

---

## 12. Vrais noms de séjours (27 publiés)

À utiliser dans les mockups — pas d'invention :

### Catégorie MONTAGNE (14)
ADRENALINE & CHILL · ALPINE SKY CAMP · ALPINE TREK JUNIOR · ALPOO KIDS · DUAL CAMP LAC MONT · GAMING HOUSE 1850 · GRAVITY BIKE PARK · HUSKY ADVENTURE · INTO THE WILD · MX RIDER ACADEMY · MY LITTLE FOREST · PARKOUR · SURVIVOR CAMP 74 · WILDLIFE REPORTER

### Catégorie MER / OCÉAN (11)
ATLANTIC SURF SESSIONS · AZUR DIVE & JET · BABY RIDERS · BLUE EXPERIENCE · BRETAGNE OCEAN RIDE · CORSICA WILD TRIP · DUNE OCEAN KIDS · LAKE & SKY EXTREME · RIVIERA SPEED CLUB · ROCKS & PADDLE · SWIM ACADEMY · WEST COAST SURF CAMP

### Catégorie NATURE & ÉQUITATION (1)
HIGH RANCH EXPERIENCE

---

## 13. Rôles utilisateurs réels (5 structure + 2 transverses)

| Rôle | Scope |
|---|---|
| **Direction** | Gestion complète structure — codes, délégation, équipe, factures |
| **CDS** (Chef de service) | Vision globale structure, suivi pédagogique |
| **CDS délégué** | Remplaçant CDS en cas d'absence |
| **Secrétariat** | Admin + dépannage dossiers inscription |
| **Éducateur** | Suivi nominatif des enfants dont il est référent (scope restreint) |
| **Admin GED** | Équipe interne GED (backoffice — hors scope Claude Design) |
| **Parents / enfants** | Mode kids public, sans compte |

---

## 14. Contraintes RGPD — visuel

### Écrans sensibles (dossier enfant, signatures, PDF Art.9)

- **Bandeau confidentialité** obligatoire en tête de formulaire (`bg-muted` + icône `LockKeyhole`)
- **Texte** : "Les informations saisies (fiche sanitaire, documents médicaux) sont transmises uniquement à l'équipe GED dans le cadre du séjour et conservées 3 mois après. Elles ne sont jamais communiquées à des tiers."
- **Lien** vers `/confidentialite` en fin de texte
- **Palette apaisée** : pas de couleurs vives sur les écrans dossier enfant (préférer `bg-muted` + `text-primary`)

### Écrans staff "mode dépannage" (secrétariat/direction dépanne éducateur absent)

- **Bandeau bleu clair** `bg-blue-50 border-blue-200 rounded-brand`
- **Texte** : "Mode dépannage — absence de [nom éducateur]. Chaque modification est tracée (RGPD Art. 9)."

### Données fictives dans les mockups

- **Prénoms enfants** : utiliser exclusivement "Kevin", "Mehdi", "Enfant A", "Jeune X" — **JAMAIS** de vrais prénoms connus
- **Structures** : utiliser "MECS Les Tilleuls", "Foyer ASE Test", "Service Protection Enfance 75" — anonymisées
- **Référents** : "Marie (référente)", "Alice Dupont", prénoms simples

---

## 15. Inconsistances actuelles connues (à NE PAS reproduire dans les mockups)

Ces écarts existent dans le code actuel et doivent être corrigés, pas perpétués :

| Inconsistance | Occurrences | Fichier |
|---|---|---|
| `rounded-xl` / `rounded-2xl` hardcodé | 161 | 40 fichiers `components/` + `app/` |
| Hex `#2a383f` hardcodé | 1 | `app/admin/page.tsx:169` (Recharts — lib-limité) |
| Hex `#de7356` hardcodé | 1 | `components/booking-flow.tsx:82` (Stripe Elements — lib-limité) |

Claude Design **ne doit pas** reproduire `rounded-xl` — utiliser `rounded-brand` sur cartes, `rounded-full` (via composant `Button`) sur CTAs.

---

## 16. Inventaire 22 routes front utilisateur

**Mode kids (public)** :
- `/` (home avec carousels)
- `/sejour/[id]` (fiche séjour partagée public + pro)
- `/sejour/[id]/souhait` (formulaire envie kids)
- `/envies` (liste wishlist kids)
- `/recherche` (recherche + filtres)
- `/cgu`, `/cgv`, `/confidentialite`, `/mentions-legales` (légal)

**Mode pro (JWT requis)** :
- `/login`, `/login/reset` (auth pro)
- `/acceder-pro` (demande accès pro sans compte)
- `/sejour/[id]/reserver` (réservation pro)
- `/structure/login`, `/structure/activate` (auth structure)
- `/structure/[code]` (dashboard structure — HORS scope Claude Design actuellement)
- `/suivi/[token]` (dashboard référent enfant — HORS scope Claude Design actuellement)
- `/educateur/souhait/[token]`, `/educateur/souhaits/[token]` (envies kids côté éducateur)
- `/inscription-urgence` (inscription JWT 24h sans compte)

---

## 17. Inventaire 21 sous-écrans dashboards (composants)

### Dashboard structure `/structure/[code]` — **PAS encore touché par Claude Design**

4 onglets + 10 panneaux (voir `components/structure/` pour la liste complète).

### Dashboard suivi `/suivi/[token]` — **PAS encore touché par Claude Design**

Panel dossier enfant (`DossierEnfantPanel`) + 4 formulaires (bulletin, sanitaire, liaison, renseignements) + upload PJ + signature pad.

Ces écrans sont **livrés et fonctionnels au 2026-04-19** — Claude Design peut les redesigner prochainement, mais en respectant la logique métier existante.

---

## 18. Documentation associée

- `docs/CHARTE_GRAPHIQUE.md` — 471 lignes de règles détaillées
- `docs/NAMING_RULES.md` — conventions de nommage
- `docs/CAROUSEL_RULES.md` — règles spécifiques carousels home
- `CLAUDE.md` — section "Charte graphique" + "Rôles structure — matrice d'accès routes"

---

**Fin du document — utilisable tel quel en input pour Claude Design.**
