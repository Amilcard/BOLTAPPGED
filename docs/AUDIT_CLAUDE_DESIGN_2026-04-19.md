# Audit Claude Design — livraison 2026-04-19

Analyse des 4 fichiers livrés : `chrome.js` + `data.js` + `icons.js` + `kit.css`.
Manquants pour audit exhaustif : `tokens.css` (implicitly referenced) + 1 page HTML type.

---

## Score global : **82 / 100**

| Dimension | Note | Commentaire |
|---|---|---|
| **Design system visuel** | 92/100 | Tokens, radius, shadows, font Rubik exacts. 3 écarts mineurs. |
| **Branding / naming** | 30/100 | 🔴 Critique — "MonApp Colo" au lieu de GED App |
| **Données métier** | 95/100 | 27 séjours réels + prénoms sobres + catégories auto-calculées |
| **Iconographie** | 85/100 | 45 icônes Lucide-compatibles. 9 à ajouter + Bug Bell. |
| **Accessibilité** | 95/100 | Tap targets 44px, focus ring, reduced-motion, sr-only, aria-current |
| **Vocabulaire ASE** | 90/100 | Inclusif ("seul·e", "un·e ami·e"). Quelques zones marketing à surveiller. |
| **Stack compatibilité** | 60/100 | Vanilla JS — pas portable tel quel en Next.js React. Maquette seulement. |

---

## 🔴 Items CRITIQUES à pousser à Claude Design avant adoption

### C1. Rebrand "MonApp Colo" → "GED" / "Groupe & Découverte"

**Fichiers concernés** :
- `chrome.js:16-17` (buildHeader — gd-header__brand-text)
- `data.js:2` (commentaire top — "MonApp Colo UI Kit")

**Impact** : le produit change de nom dans les maquettes. Pas acceptable sans décision produit explicite.

**Action** : demander à Claude Design de :
- Remplacer "MonApp" par "GED" (ou autre nom validé)
- Garder "Groupe & Découverte" en endorsement (déjà présent)
- Confirmer si c'est volontaire (rebrand) ou accidentel (placeholder)

### C2. Mode-pill kids = rouge hors charte

**Fichier** : `kit.css:60-62`

```css
.mode-pill[data-active="kids"] {
  background: #fef2f2;  /* red-50 Tailwind — hors palette GED */
  color: #b91c1c;       /* red-700 Tailwind — hors palette GED */
  border-color: #fecaca;
}
```

**Action** : remplacer par un token existant. Options :
- A. `--color-secondary` (terracotta) — cohérent "mode kids = warmth"
- B. `--color-accent` (teal) — distinction visuelle claire kids vs pro
- C. Créer un token dédié dans `tokens.css` et le documenter

---

## 🟡 Items MAJEURS — à clarifier

### M1. Échelle typographique décalée de Tailwind standard

**Fichier** : `kit.css:322-327`

| Classe | Claude Design | Tailwind | Écart |
|---|---|---|---|
| `text-xs` | 11px | 12px | -1px |
| `text-sm` | 13px | 14px | -1px |
| `text-lg` | 17px | 18px | -1px |
| `text-2xl` | 22px | 24px | -2px |
| `text-3xl` | 28px | 30px | -2px |

**Impact migration React** : les polices seront 1-2px plus grandes que les maquettes si on utilise Tailwind tel quel.

**Décision produit** :
- A. Aligner Claude Design sur Tailwind standard (plus simple migration)
- B. Override Tailwind config avec ces tailles custom (respect exact maquette)

### M2. Navigation "Notifs" sans feature équivalente

**Fichier** : `chrome.js:10`

```js
{ key: 'notif', href: 'notifications.html', label: 'Notifs', icon: 'Bell' }
```

**Problèmes** :
- Aucune route `/notifications` dans le repo
- Aucun système de notifications UI côté kids
- Icon `Bell` référencée mais **absente de icons.js** (bug — rendra icône vide)

**Actions au choix** :
- A. Retirer l'item de la nav (plus simple)
- B. Créer la feature notifications kids (scope produit à valider)

### M3. Incohérence géographique HUSKY ADVENTURE

**Fichier** : `data.js:67-68`

```js
location: 'Haute-Savoie — Massif des Glières',  // ❌ faux
confort: "Centre « Creil'Alpes »..."
```

Le centre Creil'Alpes est en **Savoie (73) Aillon-le-Jeune**, **pas Haute-Savoie**.

Même type d'erreur que le bug `location_city='annecy'` corrigé ce matin par migration 079.

**Action** : corriger le field `location` du séjour Husky.

### M4. Champs redondants `location` / `environment`

**Fichier** : `data.js:72-73` (et autres séjours)

```js
location: "Île d'Oléron",
environment: "Île d'Oléron",  // ← redondant
```

Le schéma DB GED a `location_city`, `location_region`, `centre_name` — pas de `environment`. À unifier.

---

## 🟢 Items MINEURS — à surveiller

### m1. Inconsistance radius `.reassurance`

`kit.css:225` → `border-radius: 12px` hardcodé au lieu de `var(--radius-brand)` (16px).

### m2. Palette statut mixte tokens/Tailwind direct

`kit.css:178-184` — certains badges utilisent tokens, d'autres hex Tailwind direct (`#fed7aa`, `#fef3c7`, `#fee2e2`). Safelist Tailwind autorise mais inconsistance interne.

### m3. HUSKY ADVENTURE `ageRange: '7-9'` vs catalogue `ageMin:7, ageMax:10`

`data.js:62 vs 14` — incohérence 1 an (max 9 ou 10).

### m4. 9 icônes dashboards manquantes

Si Claude Design va maquetter les dashboards structure/suivi, il faudra ajouter à `icons.js` :
`UserPlus`, `Trash2`, `Send`, `XCircle`, `ClipboardList`, `Stethoscope`, `Handshake`, `Paperclip`, `Bell`

### m5. 3 icônes "émotion" (Smile/Meh/Frown) sans usage repo

Prévues pour une feature rating kid ? À valider si feature scope.

---

## ✅ Patterns remarquables (à intégrer au repo comme référence)

Ces choix de Claude Design sont **meilleurs que le repo actuel** — à adopter :

### B1. `sticky-action-bar` mobile
`kit.css:360-370` — bandeau sticky au-dessus de la bottom-nav pour CTA sur fiche séjour détail. Pattern mobile pro, absent du repo actuel.

### B2. Focus-within sur search-bar
`kit.css:277` — `box-shadow: 0 0 0 3px rgba(222,115,86,0.15)` glow terracotta au focus. Pattern élégant.

### B3. Bottom-nav safe-area-inset-bottom
`kit.css:88` — support iPhone notch. Le repo actuel n'a pas ce détail.

### B4. Micro-interaction boutons
`kit.css:107-108` — `transform: scale(1.02)` au hover, `scale(0.97)` au active. Subtil, accessible.

### B5. Reduced-motion universel
`kit.css:381-383` — animations désactivées si user préfère. Accessibilité exemplaire.

---

## Compatibilité migration React/Next.js

### Ce qui migre en 1-pour-1

- Tokens CSS → CSS vars existantes dans `app/globals.css` (quelques renommages)
- Icônes → `lucide-react` direct (les 45 icônes existent)
- Classes utilitaires `.btn--primary`, `.card`, `.badge--*` → variants shadcn
- Animations `prefers-reduced-motion` → déjà en place

### Ce qui nécessite adaptation

- `chrome.js` (injection DOM) → Next.js `<Header>` + `<BottomNav>` React composants (DÉJÀ dans repo !)
- `data.js` (hardcoded) → Supabase queries via `lib/get-stays-data.ts`
- `icons.js` (hydrate system) → imports directs `import { Heart } from 'lucide-react'`
- `mode toggle localStorage` → context React `useApp()` existant dans repo

### Ce qui est inutilisable

- Pages HTML statiques standalone → à refaire en composants React Server + Client

---

## Actions immédiates (ordre de priorité)

| # | Action | Responsable | Effort |
|---|---|---|---|
| 1 | Décision produit MonApp vs GED branding | Toi | 5 min |
| 2 | Demander à Claude Design de re-générer avec GED | Claude Design | 30 min |
| 3 | Corriger mode-pill rouge | Claude Design | 5 min |
| 4 | Valider échelle typo custom ou Tailwind standard | Toi | 10 min |
| 5 | Retirer/créer feature Notifs | Décision produit | 10 min |
| 6 | Corriger Husky Haute-Savoie → Savoie | Claude Design | 2 min |
| 7 | Unifier location/environment | Claude Design | 5 min |
| 8 | Ajouter 9 icônes manquantes si maquette dashboards | Claude Design | 15 min |
| 9 | Envoyer tokens.css + 1 page HTML type pour audit final | Claude Design | 5 min |

---

## Verdict final

Le kit **vaut la peine d'être intégré** comme source de vérité visuelle **après correction des 2 items critiques** (branding + mode-pill rouge). Le design system sous-jacent est solide, les choix d'accessibilité et micro-interactions sont pros.

**Ne pas adopter tel quel** tant que :
- Le nom "MonApp Colo" n'est pas remplacé par GED
- Le mode-pill rouge n'est pas aligné charte

Une fois ces 2 corrections faites, on peut commencer une **PR d'alignement du repo** sur les meilleurs patterns Claude Design (sticky-action-bar, focus-within glow, safe-area-insets, reduced-motion).

---

**Fichiers audités** : `chrome.js`, `data.js`, `icons.js`, `kit.css` · **4/6 reçus**
**Fichiers attendus pour audit complet** : `tokens.css`, 1 page HTML (home ou fiche séjour)
**Audit préparé 2026-04-19 — 524/524 tests repo verts**
