# Questions audit Claude Design — Dashboards GED_APP

> Compagnon de `docs/QUESTIONS_CLAUDE_DESIGN.md` (kids+pro). À utiliser
> quand Claude Design livrera ses futurs designs des dashboards
> `/structure/[code]` et `/suivi/[token]`.
>
> **39 questions** consolidées par 3 agents Claude Code spécialisés (UX, Charte, Métier RGPD).

---

## A. Navigation dashboards (4 questions UX)

**A1.** Les 4 onglets dashboard structure (Éducatif, Équipe, Factures, Admin) utilisent-ils `<Tabs>` shadcn natif avec `role="tablist"` + `aria-selected`, ou un custom ? Sur mobile labels tronqués, comment l'onglet actif est-il communiqué ?

**A2.** L'onglet Éducatif contient 6 sous-sections accordéon. Sur mobile 375px, comment l'utilisateur sait-il que 5 autres sections existent sous le fold ? Maintien accordéon ou bascule vers tabs internes / sidebar ?

**A3.** Mode dépannage staff (`staffFillOpen`) ouvert via state local sans URL dédiée. Modale overlay, drawer latéral, ou expansion inline ? Comment retrouver l'onglet structure d'origine après fermeture ?

**A4.** `/suivi/[token]` est mono-scroll long avec 5 onglets formulaire. Sur mobile, onglets disparaissent en scroll. Sticky tab bar, bottom sheet fixe, ou autre ? Comment savoir sur quel onglet on est en bas de page ?

## B. Densité info & clarté (4 questions UX)

**B1.** KPI cards Éducatif (Enfants en séjour, Incidents actifs, Départs 7j, Taux présence) sont actuellement `<button>` accordéon sans indicateur état ouvert. Comment distinguer visuellement KPI cliquable vs compteur décoratif ? Chevron, fond différencié, autre ?

**B2.** `ChildTimeline` agrège 5 types événements (note/appel/incident/médical/souhait). Pour 20+ entrées : scroll infini, pagination, filtre par type actif, ou groupement par date ? Comment l'événement "urgent" se distingue sans alarme visuelle permanente ?

**B3.** Onglet Admin a filtre quadruple (search + séjour + statut + ged_sent). Comment voir filtres actifs après scroll ? Bandeau persistant "3 filtres actifs — Réinitialiser" ou badge sur CTA filtre ?

**B4.** `IncidentsPanel` : 3 gravités × 3 statuts. Sépares-tu physiquement incidents ouverts/urgents vs résolus (deux zones) ou filtre par défaut masque les résolus ? La direction doit scanner les urgents en moins de 3 sec.

## C. Feedback utilisateur (4 questions UX)

**C1.** Chaque bloc `DossierEnfantPanel` a son bouton "Enregistrer" + "Valider". Save auto badge "Enregistré 14h23" pendant 2.5s. Comment persiste l'état "validé" entre sessions visuellement ? Badge permanent en-tête bloc, timestamp footer, autre ? Solution mobile espace contraint ?

**C2.** Upload PJ + génération PDF = actions longues 2-8s. Pattern feedback : progress bar inline, skeleton du futur élément, ou spinner overlay ? Que se passe-t-il si upload OK mais connexion coupe pendant retour serveur ?

**C3.** Empty states actuellement absents/minimaux dans Incidents/Appels/Notes. Pour chacun, message différencié selon contexte : "Aucun incident — la saison se passe bien" vs "Aucun incident visible pour votre rôle" vs "Chargement en erreur, réessayez" ? Implications d'action très différentes.

**C4.** `SejourAlertsBanner` affiche alertes urgentes en bandeau sticky. Si plusieurs (départ 2j + incident urgent + dossier incomplet) : stack bandeaux, accordéon, ou bandeau unique avec compteur "3 alertes" ? Mobile = max 15% écran.

## D. Gestion rôles dans UI (3 questions UX)

**D1.** Éducateur voit Éducatif uniquement — onglets Admin/Équipe/Factures masqués. Cache complètement (DOM absent) ou désactive avec cadenas + tooltip "Accès réservé direction" ? La 2ᵉ option informe sans frustrer.

**D2.** Bouton "Remplir dossier en dépannage" (`canFillDossier`) masqué pour éducateur. Pour rôles autorisés, affordance forte signalant action exceptionnelle ? Style distinct (outline vs filled, ambré vs terracotta) ou libellé encodant exceptionnalité ("Remplir à la place du référent") ?

**D3.** Sur `/suivi/[token]`, bandeau RGPD Art.9 actuellement en bas page. À quel moment + endroit dans ton design : ouverture onglet Fiche sanitaire seul, en haut page suivi global, ou gate avant accès formulaires ? L'emplacement change la perception sérieux RGPD.

## E. Charte tokens dashboards (12 questions Charte)

### E.1 Typographie back-office vs vitrine

**E1.** H1 dashboard `/structure/[code]` en `text-2xl md:text-3xl font-bold` (back-office 24-30px) ou `text-5xl md:text-6xl` (vitrine kids) ? *Vérif : ≤30px.*

**E2.** Titres section ("Enfants inscrits", "Faits marquants", "Médical") en `text-sm font-semibold text-gray-700` (cf `StructureEduTab.tsx:287`) ou `<h3>` brut héritant `text-2xl` global ? *Vérif : titres internes ≤18px.*

**E3.** Corps cards/lignes tableau/descriptifs en `text-sm` (14px) voire `text-xs` (12px) métadonnées, ou `text-base md:text-lg` vitrine ? *Vérif : tableau ≤14px, métadonnées ≤12px.*

### E.2 Cards & tableaux

**E4.** Cards KPI + panels en `rounded-brand` (16px token custom) ou `rounded-xl` (12px) / `rounded-2xl` ? *Vérif : border-radius = 16px partout.*

**E5.** `shadow-card` + `hover:shadow-card-hover` (tokens custom) ou shadow shadcn générique (`shadow-sm`/`md`) ? *Vérif : élévation cohérente, une seule définition.*

**E6.** Composant `<Table>` shadcn avec `<TableRow>` et bordures natives, ou `<table>` HTML inline `border-gray-200` ? *Vérif : DOM contient `data-slot="table"`.*

**E7.** Lignes tableaux ont `hover:bg-muted/50` (état hover obligatoire) sans zebra striping inventé ? *Vérif : hover OK, repos uniforme.*

**E8.** Cards en `border border-gray-100` (back-office discret) ou `border-2` épais / `border-gray-300` ? *Vérif : bordure 1px très clair.*

### E.3 Status & badges

**E9.** Statuts (`validee`, `en_attente`, `urgent`, `ouvert`, `resolu`) via `<Badge variant="...">` shadcn ou `<span className="px-2 py-0.5 rounded-full">` inline (pattern actuellement présent dans `IncidentsPanel.tsx:190-198` + `ChildCard.tsx:113`) ? *Vérif : DOM contient `data-slot="badge"`, zéro span stylé.*

**E10.** Mapping couleurs statut respecté : vert=OK, ambre=attention, rouge=urgent, gris=inactif, terracotta=CTA uniquement ? Pas de bleu/violet/purple aléatoire. *Vérif : aucune `bg-blue-*`/`text-violet-*`/`bg-purple-*` sur badges statut.*

**E11.** Toutes icônes Lucide (`AlertTriangle`, `Shield`, `Users`, `Phone`, `FileText`, `Heart`, `Lock`...), style outline, taille `w-4 h-4` (inline) ou `w-5 h-5` (card) ? *Vérif : grep imports `from 'lucide-react'` exclusif.*

**E12.** Sections dashboard avec `space-y-4`/`space-y-6` + padding cards `p-4`/`p-5` (densité back-office), pas `py-24` / `section:120px` (token vitrine `tailwind.config.ts:120`) ? *Vérif : padding vertical section ≤32px, grilles `gap-4`.*

## F. Métier & RGPD dashboards (12 questions)

### F.1 Différenciation rôles

**F1.** Bouton "Remplir en dépannage" masqué pour `role==='educateur'`, visible pour `direction|cds|cds_delegated|secretariat` ? Pattern `StructureEduTab.tsx:340-349`. *Red flag : visible éducateur = cassure matrice CLAUDE.md.*

**F2.** Mode staff-fill affiche bandeau `role="status"` bleu rappelant : qui est remplacé · actions tracées RGPD Art.9 · envoi final = éducateur ? Pattern `DossierEnfantPanel.tsx:511-526`. *Red flag : indistinguable mode référent = perte traçabilité psychologique.*

**F3.** Dashboard filtre visuellement liste inscriptions à `referent_email = email_éducateur` quand `role==='educateur'` ? Backend filtre déjà `app/api/structure/[code]/{incidents,medical,calls,notes}/route.ts`. Front : `app/structure/[code]/page.tsx:136`. *Red flag : liste globale = exposition PII hors scope.*

### F.2 Notices RGPD Art.9

**F4.** Chaque écran données Art.9 (santé, allergies) porte bloc `LockKeyhole` + texte "accessibles aux personnes habilitées, supprimées 3 mois post-séjour" ? Pattern `FicheSanitaireForm.tsx:100-105` + `MedicalSummary.tsx:92,100-102`. *Red flag : fiche sanitaire sans bandeau = règle #16 violée.*

**F5.** Durée conservation 3 mois mentionnée AVANT soumission, pas en footer/modale ? Pattern `DossierEnfantPanel.tsx:542-548`. *Red flag : durée cachée = non-conformité info préalable CNIL.*

**F6.** Lien `/confidentialite` (`<Link target="_blank">`) en fin de chaque notice ? Pattern `DossierEnfantPanel.tsx:545-547`. *Red flag : règle #4 CLAUDE.md violée.*

### F.3 Signature & documents sensibles

**F7.** SignaturePad : "Signature responsable légal" en label, bouton Effacer accessible, feedback vert "Signature enregistrée", mode disabled retire Effacer après validation ? Pattern `SignaturePad.tsx:106-121` + `FicheSanitaireForm.tsx:300`. *Red flag : sans mention "responsable légal" = responsabilité diluée.*

**F8.** Liste PJ : type + filename + taille + date + delete, **SANS thumbnail/preview inline** ? Pattern `DocumentsJointsUpload.tsx:47-57` + DOC_TYPES `:37-45`. *Red flag : preview certificat médical exposé dans DOM = screenshot social engineering.*

**F9.** Bouton PDF download : état loading, fallback "Recevoir par email" après 2 échecs (rate-limité), succès "Document envoyé" ? Pattern `DossierEnfantPanel.tsx:126-156`. *Red flag : click direct sans feedback = utilisateur relance 10× = DoS route PDF.*

### F.4 Auditlog visibilité

**F10.** Timeline enfant affiche pour CHAQUE ligne (note/appel/incident/médical/souhait) : auteur (`created_by`) + date/heure + type + statut ? Pattern `ChildTimeline.tsx:128-157,154,149`. *Red flag : actions anonymes = règle #3 invisible utilisateur.*

**F11.** Vue multi-inscriptions direction/CDS expose colonne "dernière modif par" identifiant staff mandataire vs référent ? Pattern `MedicalSummary.tsx:149` + `IncidentsPanel.tsx:186`. *Red flag : pas de distinction = directeur ne peut auditer.*

**F12.** Première interaction staff-fill (ouverture panel) déclenche bandeau persistant "Vos actions sont tracées (RGPD Art.9), envoi final reste à [referent_nom]" ? Pattern `DossierEnfantPanel.tsx:511-526`. *Red flag : traçabilité noyée footer/tooltip = staff peut contester en cas d'incident.*

---

## Red flags instantanés dashboards

Si OUI à l'un de ces 8 → Claude Design n'a pas respecté la spécificité dashboards :

- ☐ H1 dashboard en `text-5xl` (échelle vitrine au lieu de back-office)
- ☐ Cards en `rounded-xl` au lieu de `rounded-brand`
- ☐ Badge statut inline `<span>` au lieu de `<Badge>` shadcn
- ☐ Couleurs statut bleu/violet/purple hors mapping verrouillé
- ☐ Bandeau RGPD Art.9 absent sur fiche sanitaire / médical
- ☐ Bouton staff-fill visible pour rôle éducateur
- ☐ Mode staff-fill indistinguable visuellement du mode référent
- ☐ Timeline événements sans acteur visible (`created_by`)

---

## Checklist 5 min audit dashboards

1. **Pipette H1 dashboard** → font-size ≤30px ?
2. **Inspect KPI card** → `rounded-brand` (16px) + `shadow-card` ?
3. **Inspect badge statut** → `data-slot="badge"` présent ?
4. **Filter rôle** → masquage Admin/Équipe/Factures pour éducateur ?
5. **Fiche sanitaire** → bandeau Lock + 3 mois + lien `/confidentialite` ?
6. **Mode dépannage** → bandeau bleu permanent visible ?
7. **Timeline** → acteur (`created_by`) visible chaque ligne ?
8. **PJ liste** → métadonnées seules (PAS de preview inline) ?
9. **Onglets mobile** → sticky ou nav alternative en scroll ?
10. **Empty state** → message contextualisé (pas générique "Aucune donnée") ?

→ Si moins de 8/10 OK : retour ciblé Claude Design.

---

**3 agents Claude Code · État 2026-04-19**
