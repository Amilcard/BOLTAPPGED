# Questions à poser à Claude Design — audit mockups kids + pro

> Compagnon de `docs/ETAT_DES_LIEUX_GRAPHIQUE.md`. À utiliser après que
> Claude Design a livré ses premiers écrans, pour vérifier alignement
> au repo réel.
>
> **Compilé 2026-04-19** — 3 agents Claude Code spécialisés (UX, Charte tokens, Métier RGPD).

---

## A. Charte & tokens (15 questions de conformité visuelle)

### Palette couleurs

**A1.** Confirmes-tu **`#de7356`** (terracotta `secondary`) sur TOUS les boutons CTA, et **PAS** un orange Tailwind par défaut (`#f97316`, `#ef4444`, `#e07a5f`) ? *Vérif : pipette sur 1 CTA kids + 1 CTA pro.*

**A2.** Confirmes-tu **`#2a383f`** (`primary`) sur titres/texte principal, et JAMAIS `#1a1a1a`, `#000`, `slate-900`, `gray-900` ? *Vérif : pipette sur H1.*

**A3.** L'accent est-il **`#3d5260`** (`brand-teal`) et non `violet-600` / `purple-500` / `indigo` ?

**A4.** Fonds de section utilisent-ils **`bg-muted`** (`#f1f1f1`) et JAMAIS `bg-gray-50` / `bg-gray-100` ?

**A5.** Aucune couleur inventée hors palette n'apparaît dans tes écrans (tout passe par tokens) ?

**A6.** Focus visible = **`ring-2 ring-secondary ring-offset-2`** (terracotta) partout ? Pas de focus bleu navigateur par défaut.

### Radius + shadows

**A7.** Cards = **`rounded-brand`** (16px) ? Pas `rounded-xl` (12px), `rounded-2xl`, `rounded-3xl`, `rounded-lg`.

**A8.** Boutons = **`rounded-full`** (pill via composant `<Button>`) ? Pas `rounded-lg`, `rounded-md`, `rounded-xl`.

**A9.** Composants shadcn héritent bien de **`--radius: 24px`** (pas la valeur 0.5rem par défaut) ?

**A10.** Cards au repos = **`shadow-card`** (`0 4px 12px rgba(0,0,0,0.08)`), hover = `shadow-card-hover` ? Pas `shadow-lg` Tailwind générique.

### Typographie

**A11.** Font-family partout = **Rubik** (`var(--font-rubik)`) ? JAMAIS Inter, SF Pro, Roboto, Poppins.

**A12.** Écrans pro utilisent l'**échelle back-office** (`text-2xl md:text-3xl` max pour titre page) et NON l'échelle vitrine (`text-5xl` / `text-6xl`) ?

**A13.** Weight max = **`font-bold`** (700) ? Pas de `extrabold` (800) ni `black` (900).

### Icônes + composants

**A14.** Toutes les icônes viennent de **`lucide-react`** ? Pas Heroicons, Feather, Material, Tabler, Phosphor, ni SVG custom.

**A15.** Tu utilises les **50+ composants shadcn** de `components/ui/` (`Button`, `Input`, `Card`, `Badge`, `Tabs`, `Dialog`, etc.) plutôt que des `<button>` / `<input>` / `<div className="card">` inline ?

---

## B. UX & accessibilité (5 questions d'ergonomie)

**B1.** Bottom nav mobile : zones tactiles individuelles **≥ 44px** (pas seulement l'icône 20px) ?

**B2.** Champs de formulaire : `<label>` explicitement associé à chaque `<input>` (pas un placeholder seul comme label) ? État d'erreur avec `role="alert"` visible sans dépendre de la couleur seule ?

**B3.** Fiche séjour `/sejour/[id]` : titre du séjour en `h1` unique par page ? Bloc prix pro positionné sans saut visuel entre chargement UFOVAL et fallback "Tarif communiqué aux professionnels" ?

**B4.** Images de séjours dans les carousels home kids : `alt` descriptif visible (ex. "Colonie voile — Bretagne, juillet 2025") ou `alt=""` ? Images purement décoratives marquées `aria-hidden="true"`.

**B5.** Pour chaque liste de séjours/inscriptions : as-tu prévu **3 états** — vide (illustration + CTA), chargement (skeleton), erreur ?

---

## C. Distinction kids vs pro (3 questions d'audience)

**C1.** Mode kids — vocabulaire évite-t-il les termes métier pro ("session", "tarif", "dossier d'inscription") au profit de formulations accessibles ("ce séjour", "s'inscrire", "mes envies") ? La hiérarchie visuelle est-elle lisible par un enfant de 10 ans sans accompagnement ?

**C2.** Densité d'information différenciée :
- Mode pro = densité élevée (tableaux, filtres, badges statut)
- Mode kids = aérée, **1 action primaire par écran**

As-tu appliqué cette distinction ou produit une interface uniforme ?

**C3.** Switch kids → pro via **`ProGateModal`** (header, bouton "Espace pro") visible mais non intrusif pour utilisateurs kids ? Retour pro → kids accessible depuis le header ?

---

## D. Métier — vrais noms et rôles (6 questions de réalité)

**D1.** Catalogue séjours : utilises-tu exclusivement les **27 `marketing_title` réels** (`MX RIDER ACADEMY`, `SURVIVOR CAMP 74`, `BRETAGNE OCEAN RIDE`, `HUSKY ADVENTURE`, `CORSICA WILD TRIP`, `GAMING HOUSE 1850`, `MY LITTLE FOREST`, `ALPOO KIDS`, `ADRENALINE & CHILL`, `AZUR DIVE & JET`, `PARKOUR`, etc.) ou as-tu inventé "Séjour Été 1", "Camping Alpha" ?

**D2.** Tranches d'âge **réelles** : `3-7` / `8-11` / `11-14` / `14-17` (public ASE 3-17) — pas les standards colonies génériques (6-12 / 13-17) ?

**D3.** Dashboard structure : 5 rôles **réels** (Direction, CDS, CDS délégué, Secrétariat, Éducateur) avec leur matrice de droits — pas "Admin", "Manager", "User" ?

**D4.** 3 parcours d'accès distincts visibles :
- Éducateur via magic link `suivi_token` (sans compte)
- CDS via code 6 chars
- Directeur via code 10 chars

— PAS un login unique générique.

**D5.** Vocabulaire secteur : **référent, éducateur spécialisé, MECS, foyer, ASE, dossier enfant, fiche sanitaire, fiche de liaison** — pas "client", "utilisateur", "profil", "réservation".

**D6.** Mode kids différencie-t-il bien **parent** vs **enfant ASE** (parcours public sans compte, wishlist localStorage, envoi souhait à éducateur référent) — sans demander de création de compte enfant ?

---

## E. Ton éditorial (3 questions de tonalité)

**E1.** Mode kids : ton **chaleureux mais digne** (ces enfants sont suivis par l'ASE, en souffrance sociale) ? Pas de marketing colonie joyeux genre "Vis l'aventure de ta vie !", "Fun garanti", émojis fête, gradients flashy ?

**E2.** Mode pro : sobre et efficace (dense, orienté tâche : inscriptions, dossier, paiement, incidents) ? Pas un SaaS B2B startup générique avec illustrations 3D, onboarding gamifié, confettis ?

**E3.** Photos / illustrations : utilises-tu des **photos réelles** UFOVAL des centres (Les Myrtes, Les Colombes, La Métralière, Castel Landou, Plozévet, etc.) ou des photos stock génériques de colonies ?

---

## F. RGPD — éléments visuels obligatoires (3 questions de conformité)

**F1.** Sur les 4 blocs **dossier enfant** (bulletin, sanitaire, liaison, renseignements) : as-tu reproduit la **notice RGPD Art. 9** obligatoire (icône `LockKeyhole`, bandeau "Données médicales sensibles — tracées" + lien `/confidentialite`) ? Pattern existant dans `DossierEnfantPanel.tsx` à respecter.

**F2.** Écrans de collecte (souhait kid, inscription, formulaire) : bloc **mention RGPD AVANT soumission** (qui voit, pourquoi, durée de conservation) — règle sécurité #4 du repo ?

**F3.** Données fictives utilisées :
- Prénoms enfants **anonymisés neutres** (Léa M., Sami K., Kevin, Mehdi) — pas de noms réels connus, pas de "Emma Dupont-Martin" trop bourgeois
- Pas de **visages d'enfants identifiables** dans les photos (utiliser silhouettes, dos, illustrations abstraites)
- Structures : "MECS Les Tilleuls", "Foyer ASE Test" anonymisés
- Référents : "Marie (référente)", "Alice Dupont"

---

## Red flags instantanés

Si OUI à l'un de ces 6 → Claude Design a inventé sa propre charte et il faut tout revoir :

- ☐ Orange CTA différent de `#de7356`
- ☐ Cards en `rounded-xl` ou `rounded-2xl`
- ☐ `shadow-lg` Tailwind générique sur cards
- ☐ Font Inter / SF Pro au lieu de Rubik
- ☐ Icônes Heroicons / Feather
- ☐ `<button>` inline avec classes Tailwind sans composant `<Button>`

---

## Checklist rapide (5 min) à exécuter sur chaque livraison Claude Design

1. **Pipette CTA** → `#de7356` ?
2. **Pipette H1** → `#2a383f` ?
3. **Inspect border-radius card** → `16px` ?
4. **DevTools font-family** → Rubik ?
5. **Inspect markup** → présence classes shadcn (variants `default`, `outline`, `ghost`) ?
6. **Search hex hardcode** → seulement palette (`#de7356`, `#2a383f`, `#3d5260`, `#f1f1f1`) ?
7. **Vrais noms séjours** présents (au moins 5 reconnaissables) ?
8. **Vrais rôles** présents (Direction, CDS, Éducateur) ?
9. **Bandeau RGPD** sur écran sensible ?
10. **2 modes** kids/pro visuellement différenciés ?

→ Si moins de 8/10 OK : retour à Claude Design avec questions ciblées.

---

**Document préparé en parallèle par 3 agents spécialisés Claude Code**
**Référence repo `/Users/laidhamoudi/Dev/GED_APP` · État au 2026-04-19 · 524/524 tests verts**
