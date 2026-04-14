# Remplacement Modals → Pages — Implementation Plan

> **For agentic workers:** Use executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer 2 modals complexes par des ecrans dedies + corriger le `prompt()` natif — zero regression graphique et fonctionnelle.

**Architecture:** Chaque modal est remplace par une page Next.js App Router dediee. Le state interne du modal devient des URL params + server fetch. Les composants shadcn de `docs/CHARTE_GRAPHIQUE.md` sont obligatoires.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS, shadcn/ui, Supabase

---

## Changements prevus

### Fichiers a creer

| Fichier | Responsabilite |
|---------|---------------|
| `app/sejour/[id]/souhait/page.tsx` | Page souhait kids (remplace WishlistModal) |
| `app/sejour/[id]/souhait/loading.tsx` | Skeleton loading |
| `app/sejour/[id]/souhait/error.tsx` | Error boundary |
| `app/admin/sejours/[id]/edit/page.tsx` | Page edition sejour (remplace SejourForm modal) |
| `app/admin/sejours/new/page.tsx` | Page creation sejour |

### Fichiers a modifier

| Fichier | Modification |
|---------|-------------|
| `app/sejour/[id]/stay-detail.tsx` | Bouton coeur → `<Link>` au lieu de toggle modal. Supprimer import WishlistModal |
| `app/admin/sejours/page.tsx` | Boutons edit/create → `router.push()` au lieu de toggle modal. Supprimer StayForm |
| `app/admin/structures/page.tsx` L137-151 | Remplacer `prompt()` par Dialog shadcn avec Select |

### Fichiers a supprimer (apres migration)

| Fichier | Raison |
|---------|--------|
| `components/wishlist-modal.tsx` | Remplace par page `/sejour/[id]/souhait` |

---

## Task 1 : Page souhait kids `/sejour/[id]/souhait`

**Files:**
- Create: `app/sejour/[id]/souhait/page.tsx`
- Create: `app/sejour/[id]/souhait/loading.tsx`
- Create: `app/sejour/[id]/souhait/error.tsx`

### Comportement identique au modal actuel

- Formulaire : prenom, prenom referent (optionnel), email educateur, choix_mode (pills), motivation (textarea 280 car.)
- Validation : prenom >= 2 car., email valide, motivation >= 20 car.
- Soumission : POST `/api/souhaits` avec kid_session_token (localStorage)
- Etat succes : boutons partager / voir envies / continuer
- RGPD : mention avant soumission + lien `/confidentialite`
- Sous-modal mailto warning : GARDER comme Dialog shadcn sur cette page

### Donnees via URL

La page recoit le slug via `params.id`. Elle fetch le sejour via `/api/stays/[slug]` pour obtenir `title` et `url`.

- [ ] **Step 1 : Creer `app/sejour/[id]/souhait/loading.tsx`**

```tsx
import { Skeleton } from '@/components/ui/skeleton';

export default function SouhaitLoading() {
  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="bg-card rounded-brand shadow-card w-full max-w-md p-6 space-y-4">
        <Skeleton className="h-16 w-16 rounded-full mx-auto" />
        <Skeleton className="h-6 w-48 mx-auto" />
        <Skeleton className="h-4 w-64 mx-auto" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Creer `app/sejour/[id]/souhait/error.tsx`**

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function SouhaitError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="bg-card rounded-brand shadow-card w-full max-w-md p-8 text-center">
        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-xl font-bold text-primary mb-2">Oups, quelque chose n&apos;a pas marche</h1>
        <p className="text-muted-foreground mb-6">Impossible de charger cette page. Reessaie ou retourne au sejour.</p>
        <div className="flex flex-col gap-2">
          <Button onClick={reset}>Reessayer</Button>
          <Button variant="secondary" asChild>
            <Link href="/sejours">Retour aux sejours</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : Creer `app/sejour/[id]/souhait/page.tsx`**

Port exact de `components/wishlist-modal.tsx` vers une page autonome :
- Le formulaire complet (prenom, prenom referent, email, choix_mode, motivation)
- La validation identique (prenom >= 2, email regex, motivation >= 20)
- Le POST `/api/souhaits` identique
- L'etat succes avec partage/navigation
- Le sous-dialog mailto warning via `<Dialog>` shadcn
- Tous les composants shadcn obligatoires : `<Button>`, `<Input>`, `<Textarea>`, `<Label>`
- `role="alert"` sur les blocs erreur
- Charte : `bg-muted` fond, `bg-card rounded-brand shadow-card` conteneur, `<Button>` default (terracotta) pour CTA

Donnees : fetch `/api/stays/${params.id}` cote serveur pour obtenir `title` et `slug`. Si 404 → redirect `/sejours`.

- [ ] **Step 4 : Verifier que la page fonctionne**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/sejour/annecy-element/souhait
# Expected: 200
```

Ouvrir dans le navigateur, tester :
- Formulaire complet avec validation
- Soumission + etat succes
- Bouton partager (Web Share API ou mailto fallback)
- Bouton "Voir mes souhaits" → `/envies`
- Bouton "Continuer" → `/sejour/[slug]`
- Navigation arriere (back) → retour au sejour

- [ ] **Step 5 : Commit**

```bash
git add app/sejour/\[id\]/souhait/
git commit -m "feat: add /sejour/[id]/souhait page (replaces WishlistModal)"
```

---

## Task 2 : Remplacer le bouton coeur dans stay-detail.tsx

**Files:**
- Modify: `app/sejour/[id]/stay-detail.tsx`

Le bouton coeur doit devenir un `<Link>` vers `/sejour/[slug]/souhait` au lieu de toggle `showWishlistModal`.

- [ ] **Step 1 : Modifier stay-detail.tsx**

Changements :
1. Supprimer `import { WishlistModal } from '@/components/wishlist-modal'`
2. Supprimer `const [showWishlistModal, setShowWishlistModal] = useState(false)`
3. Modifier `handleKidsCTA` : remplacer `setShowWishlistModal(true)` par `router.push(\`/sejour/${slug}/souhait\`)`
4. Supprimer le bloc JSX `{showWishlistModal && (<WishlistModal .../>)}`
5. Conserver `addToWishlist(slug)` et `refreshWishlist()` dans handleKidsCTA (le localStorage reste utile pour `/envies`)

- [ ] **Step 2 : Verifier non-regression**

Ouvrir http://localhost:3000/sejour/annecy-element en mode kids :
- Cliquer sur le coeur → navigue vers `/sejour/annecy-element/souhait`
- Back button → retour au sejour
- Le modal ProGateModal fonctionne toujours
- Le bouton "Inscrire un enfant" fonctionne toujours

- [ ] **Step 3 : Build check**

```bash
cd /Users/laidhamoudi/Dev/GED_APP && npx tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add app/sejour/\[id\]/stay-detail.tsx
git commit -m "refactor: replace WishlistModal trigger with Link to /souhait page"
```

---

## Task 3 : Supprimer wishlist-modal.tsx

**Files:**
- Delete: `components/wishlist-modal.tsx`

- [ ] **Step 1 : Verifier qu'aucun autre fichier n'importe WishlistModal**

```bash
grep -r "wishlist-modal" app/ components/ --include="*.tsx" --include="*.ts"
```

Expected: 0 resultats (apres Task 2).

- [ ] **Step 2 : Supprimer le fichier**

```bash
rm components/wishlist-modal.tsx
```

- [ ] **Step 3 : Build check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add components/wishlist-modal.tsx
git commit -m "chore: remove deprecated WishlistModal (replaced by /souhait page)"
```

---

## Task 4 : Page edition sejour `/admin/sejours/[id]/edit`

**Files:**
- Create: `app/admin/sejours/[id]/edit/page.tsx`
- Create: `app/admin/sejours/new/page.tsx`

### Comportement identique au StayForm modal actuel

- 12+ champs : title, descriptionShort, programme (textarea), geography, accommodation, supervision, priceFrom, durationDays, period, ageMin, ageMax, themes, imageCover, published
- POST (create) ou PUT (edit) vers `/api/admin/stays` / `/api/admin/stays/[id]`
- Redirect vers `/admin/sejours` apres sauvegarde
- Charte : composants `<Input>`, `<Textarea>`, `<Select>`, `<Label>`, `<Button>`, `<Card>`

- [ ] **Step 1 : Creer `app/admin/sejours/[id]/edit/page.tsx`**

Page qui :
1. Fetch le sejour via `/api/admin/stays/[id]` (params.id = UUID)
2. Affiche le formulaire pre-rempli dans un `<Card>` (`rounded-brand shadow-card`)
3. Utilise `<Input>`, `<Textarea>`, `<Select>`, `<Label>` shadcn
4. PUT vers `/api/admin/stays/[id]` au submit
5. Redirect vers `/admin/sejours` via `router.push()` apres succes
6. Bouton annuler → `router.push('/admin/sejours')`
7. Loading state : `<Skeleton>`
8. Error state : `role="alert"` + `text-destructive`

- [ ] **Step 2 : Creer `app/admin/sejours/new/page.tsx`**

Meme formulaire que edit mais :
- Champs vides (defaults : period='ete', ageMin=6, ageMax=12, durationDays=7)
- POST vers `/api/admin/stays`
- Redirect vers `/admin/sejours` apres succes

- [ ] **Step 3 : Verifier les deux pages**

```bash
# Edit (remplacer UUID par un vrai ID de sejour)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin/sejours/new
# Expected: 200 (si authentifie admin)
```

Ouvrir dans le navigateur :
- Creer un sejour → verifie apparition dans la liste
- Editer un sejour → verifie les champs pre-remplis
- Annuler → retour liste
- Back button → retour liste

- [ ] **Step 4 : Commit**

```bash
git add app/admin/sejours/\[id\]/edit/ app/admin/sejours/new/
git commit -m "feat: add /admin/sejours/new and /admin/sejours/[id]/edit pages (replaces StayForm modal)"
```

---

## Task 5 : Remplacer les declencheurs dans admin/sejours/page.tsx

**Files:**
- Modify: `app/admin/sejours/page.tsx`

- [ ] **Step 1 : Modifier admin/sejours/page.tsx**

Changements :
1. Supprimer `import * as DialogPrimitive from '@radix-ui/react-dialog'`
2. Supprimer `const [editingStay, setEditingStay]` et `const [isCreating, setIsCreating]`
3. Bouton "Nouveau sejour" : `router.push('/admin/sejours/new')` au lieu de `setIsCreating(true)`
4. Bouton edit (crayon) : `router.push(\`/admin/sejours/${stay.id}/edit\`)` au lieu de `setEditingStay(stay)`
5. Supprimer le bloc `{(isCreating || editingStay) && (<StayForm .../>)}`
6. Supprimer la function `StayForm` entiere (L136-218)
7. Ajouter `import { useRouter } from 'next/navigation'` + `const router = useRouter()`

- [ ] **Step 2 : Verifier non-regression**

- Liste sejours affichee
- Bouton "Nouveau sejour" → page `/admin/sejours/new`
- Bouton crayon → page `/admin/sejours/[id]/edit`
- Supprimer un sejour → confirmation + suppression (inchange)
- Publier/depublier → toggle direct (inchange)
- Notifier waitlist → confirmation + envoi (inchange)

- [ ] **Step 3 : Build check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add app/admin/sejours/page.tsx
git commit -m "refactor: replace StayForm modal triggers with page navigation"
```

---

## Task 6 : Remplacer prompt() dans admin/structures

**Files:**
- Modify: `app/admin/structures/page.tsx` (L137-151)

- [ ] **Step 1 : Ajouter un Dialog de selection structure**

Remplacer le `prompt()` natif (L139) par :
1. Un state `const [structurePicker, setStructurePicker] = useState<{orphan: OrphanInscription; structures: Structure[]} | null>(null)`
2. Un `<Dialog>` shadcn qui s'ouvre avec la liste des structures correspondantes
3. Un `<Select>` shadcn pour choisir la structure
4. Bouton "Rattacher" qui appelle le `confirm()` existant puis ferme le Dialog

- [ ] **Step 2 : Verifier**

- Cliquer "Rattacher" sur une inscription orpheline avec plusieurs structures sur le meme code postal
- Le Dialog s'ouvre avec un Select listant les structures
- Selectionner + confirmer → rattachement fonctionne
- Annuler → rien ne se passe

- [ ] **Step 3 : Build check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add app/admin/structures/page.tsx
git commit -m "fix: replace native prompt() with Dialog+Select for structure selection"
```

---

## Task 7 : Verification finale

- [ ] **Step 1 : Build complet**

```bash
cd /Users/laidhamoudi/Dev/GED_APP && npm run build
```

- [ ] **Step 2 : Test navigateur — parcours complet**

| Parcours | Etapes | Attendu |
|----------|--------|---------|
| Souhait kids | `/sejour/annecy-element` → coeur → formulaire → submit → succes → partager → envies | Identique au modal actuel |
| Souhait back | `/sejour/annecy-element/souhait` → back button | Retour au sejour |
| Admin create sejour | `/admin/sejours` → Nouveau → formulaire → save | Sejour cree, redirect liste |
| Admin edit sejour | `/admin/sejours` → crayon → formulaire pre-rempli → save | Sejour modifie, redirect liste |
| Admin delete sejour | `/admin/sejours` → poubelle → confirmer | Inchange (ConfirmDialog) |
| Admin rattacher inscription | `/admin/structures` → rattacher orpheline → Dialog select → confirmer | Rattachement OK |
| ProGateModal | `/sejour/annecy-element` → "Inscrire un enfant" | Inchange (modal gate) |
| FilterSheet | `/` → filtres mobile | Inchange (sheet) |

- [ ] **Step 3 : Commit final si corrections**

```bash
git add -A
git commit -m "fix: post-migration corrections"
```

---

## Risques et mitigations

| Risque | Mitigation |
|--------|-----------|
| `/sejour/[id]/souhait` conflicte avec `/sejour/[id]` route | Non — Next.js gere les routes imbriquees, `[id]/souhait/page.tsx` est un segment distinct |
| localStorage kid_session_token non disponible en SSR | La page souhait est `'use client'` — meme pattern que le modal actuel |
| Admin auth perdue sur navigation vers edit page | `app/admin/layout.tsx` protege toutes les sous-routes — edit page est sous `/admin/` |
| Build casse par imports morts | Task 3 verifie zero import residuel avant suppression |
