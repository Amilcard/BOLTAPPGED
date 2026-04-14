# Charte graphique — Groupe & Découverte

> **OBLIGATOIRE.** Ce document est la reference absolue pour toute modification UI/UX sur GED App.
> Toute PR touchant l'interface DOIT respecter chaque regle ci-dessous.
> Source de verite : `tailwind.config.ts`, `app/globals.css`, `components/ui/button.tsx`, `config/premium-themes.ts`.
> Derniere mise a jour : 14 avril 2026 (post-audit UI complet)

---

## 0. Regles fondamentales

1. **Zero hex hardcode** — toute couleur doit venir des tokens Tailwind definis dans `tailwind.config.ts`
2. **Composants shadcn obligatoires** — `<Button>`, `<Input>`, `<Select>`, `<Badge>`, `<Tabs>`, `<Skeleton>` remplacent tout inline
3. **Secondary = CTA** — le terracotta (`#de7356`) est la couleur des boutons d'action sur toute l'app (pro ET kids)
4. **Primary = titres/texte** — le dark (`#2a383f`) est reserve aux titres, textes, fonds sombres. Pas aux boutons CTA principaux
5. **Accessibilite non negociable** — `role="alert"`, labels, tap targets 44px, clavier, `aria-hidden` sur decoratif
6. **Mobile-first** — styles de base = mobile, enrichis via `sm:`, `md:`, `lg:`

---

## 1. Palette de couleurs

### Couleurs principales (extraites du logo)

| Token | Hex | HSL (CSS var) | Usage |
|---|---|---|---|
| `primary` | `#2a383f` | `200 20% 20%` | Titres, texte principal, sidebar admin, header sombre |
| `secondary` | `#de7356` | `13 65% 60%` | CTA, boutons d'action, focus ring, ::selection |
| `accent` | `#3d5260` | `200 22% 30%` | Hover, variantes secondaires |
| `muted` | `#f1f1f1` | — | Fond de sections, arrière-plans neutres |
| `white` | `#ffffff` | — | Cards, fond principal, body |
| `border` | `#e5e7eb` | `210 17% 93%` | Séparateurs, contours cards |

### Déclinaisons primary (50-900)

| Shade | Hex |
|---|---|
| 50 | `#f4f7f8` |
| 100 | `#e0e7ea` |
| 200 | `#c4d1d7` |
| 300 | `#9bb0ba` |
| 400 | `#6b8a97` |
| **500** | **`#2a383f`** |
| 600 | `#233038` |
| 700 | `#1c272e` |
| 800 | `#151e24` |
| 900 | `#0e151a` |

### Déclinaisons secondary / terracotta (50-900)

| Shade | Hex |
|---|---|
| 50 | `#fdf8f6` |
| 100 | `#fbeee9` |
| 200 | `#f6dcd3` |
| 300 | `#f0c2b4` |
| 400 | `#e9a08d` |
| **500** | **`#de7356`** |
| 600 | `#c5583b` |
| 700 | `#a34831` |
| 800 | `#843d2d` |
| 900 | `#6d3529` |

### Aliases legacy (`brand.*`)

| Alias | Hex | Mappe vers |
|---|---|---|
| `brand-dark` | `#2a383f` | primary |
| `brand-gold` | `#de7356` | secondary (terracotta) |
| `brand-teal` | `#3d5260` | accent |
| `brand-white` | `#ffffff` | white |
| `brand-light` | `#f1f1f1` | muted |
| `brand-border` | `#e5e7eb` | border |

### Couleurs sémantiques (Tailwind par défaut)

| Rôle | Classe | Contexte |
|---|---|---|
| Destructive | `hsl(var(--destructive))` | Suppressions, alertes critiques |
| Popover | `#ffffff` / `#1a1a1a` | Menus contextuels |
| Card | `#ffffff` / `#1a1a1a` | Cards standard |

### INTERDIT — Couleurs

- Tout hex hardcode hors palette : `#145587`, `#1A2B4B`, `#0e3d63`, `#e07a5f`, `#1d4ed8`, `#166534`, `#c2410c`...
- `style={{ color: '...', backgroundColor: '...' }}` inline — utiliser classes Tailwind
- `bg-gray-50` / `bg-gray-100` pour fonds de section — utiliser `bg-muted`
- `text-gray-400/500/600/700/900` ad hoc — utiliser `text-primary`, `text-muted-foreground`, ou les sous-nuances primary

### Mapping texte obligatoire

| Usage | Classe |
|---|---|
| Texte principal | `text-primary` |
| Texte secondaire/aide | `text-muted-foreground` |
| Texte sur fond sombre | `text-white` |
| Labels formulaire | `text-primary font-medium` |
| Erreur | `text-destructive` |

---

## 2. Typographie

### Police

| Propriété | Valeur |
|---|---|
| Font family | **Rubik** (Google Fonts) |
| Variable CSS | `--font-rubik` |
| Heading | `font-heading` = Rubik |
| Body | `font-sans` = Rubik |

### Echelle typographique — Pages VITRINE (home, sejours, sejour/[id], infos, legales)

| Element | Mobile | Desktop | Weight | Line height | Max width |
|---|---|---|---|---|---|
| `h1` | `text-5xl` (3rem) | `text-6xl` (3.75rem) | `bold` (700) | `leading-tight` | 70ch |
| `h2` | `text-4xl` (2.25rem) | `text-5xl` (3rem) | `bold` (700) | `leading-tight` | 65ch |
| `h3` | `text-2xl` (1.5rem) | `text-3xl` (1.875rem) | `semibold` (600) | `leading-snug` | 60ch |
| `p` | `text-base` (1rem) | `text-lg` (1.125rem) | `normal` (400) | `leading-relaxed` | 65ch |
| `small` | `text-sm` (0.875rem) | — | `normal` | `leading-normal` | — |

### Echelle typographique — Pages BACK-OFFICE (admin, structure, educateur)

| Element | Classes | Weight |
|---|---|---|
| Titre page | `text-2xl md:text-3xl` | `font-bold` |
| Titre section | `text-lg md:text-xl` | `font-semibold` |
| Titre carte/panel | `text-base md:text-lg` | `font-semibold` |
| Corps | `text-sm md:text-base` | normal |
| Labels | `text-sm` | `font-medium` |

> Les regles globales h1-h3 dans `globals.css` s'appliquent aux pages vitrine. Les pages back-office doivent utiliser l'echelle ci-dessus explicitement.

### INTERDIT — Typographie

- `font-extrabold` (800) — max autorise = `font-bold` (700)
- Melanger les poids pour un meme niveau hierarchique sur une meme page
- Utiliser les tailles vitrine (text-4xl+) dans le back-office
- Texte sans accents francais : "sejour" → "séjour", "Medical" → "Médical", "Evenement" → "Événement", "Methode" → "Méthode", "Prenom" → "Prénom"

---

## 3. Formes et dimensions

### Border radius

| Token | Valeur | Usage |
|---|---|---|
| `--radius` | `24px` | Radius global (composants shadcn) |
| `rounded-brand` | `16px` | Cards |
| `rounded-pill` | `50px` | Boutons CTA |
| `rounded-lg` | `var(--radius)` | Composants larges |
| `rounded-md` | `calc(var(--radius) - 2px)` | Composants moyens |
| `rounded-sm` | `calc(var(--radius) - 4px)` | Composants petits |

### Shadows

| Token | Usage |
|---|---|
| `shadow-card` | `0 4px 12px rgba(0,0,0,0.08)` — cards au repos |
| `shadow-card-hover` | `0 8px 24px rgba(0,0,0,0.12)` — cards au survol |
| `shadow-brand` | Ombre bleutée subtile — composants brand |
| `shadow-brand-lg` | Ombre bleutée moyenne |
| `shadow-brand-xl` | Ombre bleutée forte |

### Spacing dédié

| Token | Valeur | Usage |
|---|---|---|
| `spacing-section` | `120px` | Espacement entre sections |
| `spacing-card` | `80px` | Espacement interne cartes |

---

## 4. Boutons

### Composant OBLIGATOIRE : `<Button>` (`components/ui/button.tsx`)

Tout bouton visible DOIT utiliser ce composant. Zero `<button className="bg-...">` inline.

### Variants

| Variant | Apparence | Usage |
|---|---|---|
| `default` | **Terracotta plein** (`bg-secondary text-white`) | CTA principal : reserver, valider, envoyer, soumettre |
| `primary` | Dark plein (`bg-primary text-white`) | Actions secondaires, navigation, admin |
| `secondary` | Outline dark (`border-primary text-primary`) | Actions tertiaires, annuler, retour |
| `destructive` | Rouge plein | Supprimer, revoquer |
| `outline` | Bordure subtile | Filtres, options |
| `ghost` | Transparent | Navigation, actions mineures |
| `link` | Texte souligne | Liens inline |

### Tailles

| Size | Classes | Usage |
|---|---|---|
| `default` | `h-12 px-8 py-3` | Standard |
| `sm` | `h-9 px-4` | Tableaux, inline |
| `lg` | `h-14 px-10 py-4` | Hero CTA |
| `icon` | `h-10 w-10` | Boutons icone |

### Forme : `rounded-full` (pill) — tous les boutons, toutes les tailles.

### Hover et micro-animations

| Etat | Effet |
|---|---|
| Hover default/primary | `hover:scale-105` + `hover:bg-[variant]/90` |
| Shadow | `shadow-brand-lg` sur default et primary |
| Focus | `ring-2 ring-secondary ring-offset-2` (terracotta) |
| Active | `active:scale-95` |

### Tap target mobile

Tout bouton d'action : **minimum 44px de hauteur** (`min-h-[44px]`).

### INTERDIT — Boutons

- `<button className="bg-primary text-white rounded-lg ...">` — utiliser `<Button variant="primary">`
- `<button className="bg-secondary ...">` inline — utiliser `<Button>` (default)
- `rounded-lg`, `rounded-xl`, `rounded-md` sur des boutons — toujours `rounded-full` via le composant
- Boutons sans hover state
- Boutons d'action < 44px de hauteur sur mobile
- `hover:bg-primary-600` — utiliser `hover:bg-primary/90`

---

### INTERDIT — Formes

- `shadow` (default Tailwind) sur des cartes — utiliser `shadow-card`
- `shadow-sm`, `shadow-lg` generiques sur des cartes — utiliser les tokens brand
- `rounded-xl`, `rounded-2xl`, `rounded-3xl` sur des cartes — utiliser `rounded-brand`
- Cartes cliquables sans `shadow-card-hover` au hover

---

## 5. Interactions et accessibilite

| Propriete | Valeur |
|---|---|
| Focus ring | `ring-2 ring-secondary ring-offset-2` (terracotta) — **unique pour toute l'app** |
| ::selection | `background: #de7356`, `color: white` |
| Scrollbar track | `#F8F9FA` |
| Scrollbar thumb | `#CBD5E1` → hover `#94A3B8` |
| Smooth scroll | `scroll-behavior: smooth` |

### Accessibilite OBLIGATOIRE

| Regle | Implementation |
|---|---|
| Alertes dynamiques | `role="alert"` sur tout bloc erreur/alerte rendu conditionnellement |
| Banniere urgence | `aria-live="assertive"` sur SejourAlertsBanner et composants critiques |
| Labels formulaire | `<Label htmlFor>` ou `aria-label` sur **chaque** input/select |
| Navigation clavier | `tabIndex={0}` + `onKeyDown` sur tout element cliquable non-natif (`<tr>`, `<div>`, `<span>`) |
| Tap target mobile | minimum **44x44px** sur tout bouton/lien d'action |
| Icones decoratives | `aria-hidden={true}` sur toute icone Lucide adjacente a du texte |
| Emoji | `<span aria-hidden="true">emoji</span>` |
| Animations | Deja gerees par `prefers-reduced-motion` dans `globals.css` |
| Telephones | `<a href="tel:XXXXXXXXXX">` — **jamais** en texte brut |
| Mot de passe | `autoComplete="new-password"` sur les champs reset/creation |

### INTERDIT — Accessibilite

- Focus ring en `ring-primary`, `ring-accent`, ou `ring-primary/30` — toujours `ring-secondary`
- Blocs erreur sans `role="alert"`
- Inputs sans label associe
- Emoji ou icones decoratives sans `aria-hidden`
- Numeros de telephone en texte brut

---

## 6. Breakpoints

| Token | Largeur |
|---|---|
| `xs` | 375px |
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |
| `2xl` | 1536px |

---

## 7. Themes de sejours

Les séjours utilisent des couleurs Tailwind par catégorie (défini dans `config/premium-themes.ts`) :

| Catégorie | Couleur Tailwind | Exemples |
|---|---|---|
| Ocean / Nautique | `cyan-500` à `sky-500` | Littoral, Horizon, Glisse, Piscine |
| Montagne / Adrénaline | `orange-500` à `orange-600` | Altitude, Aventure, Sport, Action |
| Urbain / Gaming | `violet-600` | Urbain, Gaming |
| Nature / Découverte | `emerald-500` à `teal-600` | Nature, Exploration, Découverte |
| Douceur / Première colo | `pink-400` à `pink-500` | Douceur, Cocooning |
| Spéciaux | `indigo-600`, `red-600`, `amber-600/700` | Aérien, Mécanique, Animaux, Survie |

---

## 8. Logo

| Fichier | Usage |
|---|---|
| `public/logo-ged.svg` | Logo principal (header, footer, emails) |
| `public/favicon.svg` | Favicon navigateur |
| `public/logo.svg` | Logo simple fallback |
| Logo compact | Fond `primary`, texte `secondary`, initiales "gd", radius 10px |

### Règles d'usage

- Fond blanc : logo standard
- Fond sombre (`primary`) : logo standard (SVG supporte les deux)
- Mobile : logo compact (40x40px)

---

## 9. Emails

| Zone | Couleur |
|---|---|
| Header email | `bg-primary` (`#2a383f`), texte blanc |
| Body email | Fond blanc, bordure `border` |
| Bouton email | `bg-primary`, texte blanc, radius `6px` |
| Texte secondaire | `#6b7280` |

---

## 10. Admin panel

| Zone | Couleur |
|---|---|
| Sidebar | `bg-primary` (`#2a383f`), texte blanc |
| Item actif | `bg-secondary/20`, texte `secondary` |
| Item hover | `bg-white/10` |
| Contenu | `bg-muted` (`#f1f1f1`) — **pas** `bg-gray-100` |
| Stats chiffres | `text-secondary` (terracotta) |

### Tables admin — style standard unique

```
<th> : px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider
<td> : px-4 py-3 text-sm text-primary
```

Utiliser le composant `<Table>` (`components/ui/table.tsx`) quand possible.

### INTERDIT — Admin

- Varier padding/taille/couleur entre les tables admin
- `<tr onClick>` sans `tabIndex={0}` + `onKeyDown`
- Inputs raw (`<input className="border rounded-lg">`) — utiliser `<Input>`
- Badges inline — utiliser `<Badge>`
- Tabs custom `<button>` — utiliser `<Tabs>`

---

## 11. Composants shadcn obligatoires

Tout element UI standard DOIT utiliser le composant shadcn correspondant :

| Element | Composant | Chemin |
|---------|-----------|--------|
| Bouton | `<Button>` | `components/ui/button.tsx` |
| Champ texte | `<Input>` | `components/ui/input.tsx` |
| Zone texte | `<Textarea>` | `components/ui/textarea.tsx` |
| Select | `<Select>` | `components/ui/select.tsx` |
| Checkbox | `<Checkbox>` | `components/ui/checkbox.tsx` |
| Label | `<Label>` | `components/ui/label.tsx` |
| Badge | `<Badge>` | `components/ui/badge.tsx` |
| Onglets | `<Tabs>` | `components/ui/tabs.tsx` |
| Carte | `<Card>` | `components/ui/card.tsx` |
| Table | `<Table>` | `components/ui/table.tsx` |
| Skeleton | `<Skeleton>` | `components/ui/skeleton.tsx` |
| Dialog | `<Dialog>` | `components/ui/dialog.tsx` |

---

## 12. Etats visuels obligatoires

Tout composant interactif DOIT definir :

| Etat | Implementation |
|------|----------------|
| Default | Style de base |
| Hover | Changement visuel (scale, bg, shadow) |
| Focus | `ring-2 ring-secondary ring-offset-2` |
| Active | `active:scale-95` |
| Disabled | `opacity-50 pointer-events-none` |
| Loading | `<Skeleton>` (pages) ou `<Loader2 className="animate-spin">` (inline) |
| Error | `role="alert"` + message visible + `text-destructive` |
| Empty | Message informatif centre |

### INTERDIT

- Loading en texte brut "Chargement..." — utiliser `<Skeleton>`
- Erreur sans feedback visuel (echec silencieux)
- Carte cliquable sans hover state

---

## 13. Navigation et z-index

### Surfaces requises

| Surface | Composant | Present sur |
|---------|-----------|-------------|
| Header | `components/header.tsx` | Pages publiques + structure |
| BottomNav | `components/bottom-nav.tsx` | Pages publiques mobile |
| Admin sidebar | `app/admin/layout.tsx` | Pages admin |
| Footer | `components/footer.tsx` | Toutes les pages publiques |

### z-index standard

| Element | z-index |
|---------|---------|
| Header | `z-50` |
| BottomNav | `z-50` |
| Filter sheet backdrop | `z-40` |
| SearchFilterBar | `z-30` |
| SejourAlertsBanner | `z-30` |
| Contenu sticky | `z-20` |

### INTERDIT

- CTA sticky au meme z-index que BottomNav
- z-index > 50 (reserve systeme)
- Pages sans navigation (sauf login/reset)

---

## 14. Responsive

Mobile-first : styles de base = mobile, enrichis via breakpoints.

### INTERDIT

- Largeurs hardcodees en pixels (`w-[300px]`) — utiliser classes responsive
- Carousel sans scroll tactile natif (`overflow-x-auto` + `scroll-snap`)
- Logo mobile en texte ("G & D") — toujours SVG

---

## 15. Checklist avant merge

Avant tout commit touchant l'UI :

- [ ] **Couleurs** : uniquement des tokens de la palette (zero hex hardcode)
- [ ] **Boutons** : composant `<Button>` avec le bon variant
- [ ] **Cartes** : `rounded-brand` + `shadow-card` + `shadow-card-hover` si cliquable
- [ ] **Inputs** : composants shadcn (`<Input>`, `<Select>`, `<Badge>`, `<Tabs>`)
- [ ] **Focus** : `ring-secondary` partout
- [ ] **Accessibilite** : `role="alert"`, labels, `aria-hidden`, tap targets 44px, clavier
- [ ] **Responsive** : pas de largeurs hardcodees, mobile-first
- [ ] **Texte** : accents corrects, pas d'abbreviations obscures
- [ ] **Hover** : defini sur tout element interactif
- [ ] **Loading** : `<Skeleton>` — pas de texte brut
- [ ] **Typo back-office** : echelle reduite (pas les tailles vitrine)

---

## Fichiers source

| Fichier | Chemin |
|---|---|
| Tailwind config | `tailwind.config.ts` |
| Variables CSS | `app/globals.css` |
| Button component | `components/ui/button.tsx` |
| Thèmes séjours | `config/premium-themes.ts` |
| Theme provider | `components/theme-provider.tsx` |
| Preview branding | `preview-branding.html` (ouvrir dans un navigateur) |
