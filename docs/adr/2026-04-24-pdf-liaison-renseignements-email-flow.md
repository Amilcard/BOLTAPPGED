# ADR 2026-04-24 — Fiche liaison + renseignements : passage au flux email

## Contexte

4 PDF dossier enfant (bulletin, sanitaire, liaison, renseignements) sont
aujourd'hui remplissables en ligne. Remplissage par coordonnées en dur dans
`app/api/dossier-enfant/[inscriptionId]/pdf/route.ts` → bugs alignement
récurrents (Thanh 2026-04-21 et 2026-04-24).

Migration AcroForm planifiée (cf. `docs/ACROFORM_FIELDS.md`, `TODO.md`) = 135
champs à créer sur 3 templates, ~2-3h de dépôt LibreOffice.

## Décision

Réduire le scope de saisie en ligne :

- **Bulletin + sanitaire** → migrés en AcroForm (107 champs au total), remplis
  en ligne comme aujourd'hui, PDF générés par le code.
- **Liaison + renseignements** → plus remplissables en ligne. Les 2 PDF
  (partiellement pré-remplis avec les données bulletin) sont envoyés à la
  structure par mail à la soumission du dossier. La structure imprime, fait
  signer, scanne, upload le PDF signé via `/suivi/[token]` (parcours upload
  existant).

UI côté référent : onglets liaison + renseignements passent en mode **preview
lecture-seule** (option B de la décision arch-impact-reviewer 2026-04-24) +
checkbox consentement RGPD obligatoire avant soumission (option C light, sans
migration DB).

## Alternatives envisagées

| Option | Rejetée pour |
|---|---|
| A — Suppression onglets + bandeau info | Bandeau ignoré à 70%+ sur mobile (ux-ui-reviewer) + orphelinage JSONB des 11+11 dossiers existants avec data (arch-impact-reviewer) |
| C seule — Suppression + checkbox + colonne DB | Migration + backfill + couplage submit + RGPD Art. 7 = 3 points de casse (arch-impact-reviewer) |
| B seule — Preview sans checkbox | Pas de traçabilité consentement mail (ux-ui-reviewer) |
| Statu quo avec migration AcroForm 3 templates | 135 champs vs 107 = +30 min de dépôt LibreOffice pour un parcours dont l'utilisation réelle est marginale (mesures MCP Supabase 2026-04-24 : 11/42 dossiers ont vraie data liaison, 11/42 ont vraie data renseignements) |

## Mesures MCP Supabase (2026-04-24, ground truth)

- 42 dossiers total
- 13 soumis (ged_sent_at NOT NULL) — flags déjà true, intouchables
- 29 drafts — 27 avec `liaison_completed=false`, 28 avec `renseignements_completed=false`
- 11 dossiers avec vraie data liaison (JSONB non vide) ; 10 soumis + 1 draft
- 11 dossiers avec vraie data renseignements ; 10 soumis + 1 draft
- 0/42 utilisent SES eIDAS liaison (`liaison_signed_at`, `liaison_signed_ip`,
  `liaison_signature_hash`) → aucune régression signature réelle
- `renseignements_required=false` partout en DB déjà

## Conséquences

### Positif
- Bugs alignement liaison + renseignements supprimés à la source (plus de
  coord en dur côté liaison/renseignements)
- Scope migration AcroForm : 2 PDF au lieu de 3 (107 champs au lieu de 135)
- Parent zéro saisie sur 2 documents → friction réduite
- Structure devient destinataire unique (cohérent avec son rôle d'archivage)

### Négatif / coûts acceptés
- 22 dossiers existants avec data : leurs saisies restent visibles en
  preview readonly, non re-éditables → data figée en DB (audit log historique)
- SES eIDAS sur liaison retiré : 0 usage réel mesuré → non régressif
- Dette data cachée : les 11 dossiers draft/soumis avec data liaison
  continuent d'exister en DB mais ne sont plus actualisables via parcours
  parent. Si besoin correction : intervention admin manuelle via SQL.

## Pattern backward-compat appliqué

- UI saisie retirée
- JSONB columns `fiche_liaison_jeune` + `fiche_renseignements` **conservées**
- API routes PATCH sur ces blocs **conservées** (admin peut encore patcher
  via outillage interne)
- PDF generation `type=liaison` **conservée** (accès admin historique +
  génération PDF vierge pour envoi mail structure)
- `liaison_completed` + `renseignements_completed` pré-settés à `true` à
  l'INSERT du dossier (le gate `isComplete` passe à true automatiquement,
  bouton envoi actif)
- Backfill one-shot : 28 dossiers drafts existants → `_completed=true`

## Plan d'exécution

1. FichePreview component (lecture-seule)
2. DossierEnfantPanel : remplacement rendu onglets liaison + renseignements
3. Checkbox consentement + log audit
4. Pré-set `_completed=true` à l'INSERT dossier
5. Backfill 28 dossiers
6. Enrichissement email structure (2 signed URLs PDF vierges en plus de
   l'archivage bulletin)
7. MAJ TODO.md + ACROFORM_FIELDS.md + ACROFORM_GUIDE.md (scope 2 PDF)
8. Tests Jest + test manuel Thanh preview branch

## Rollback

Chaque étape est réversible en 1 commit revert. Le pattern backward-compat
garantit zéro perte de données : les JSONB et colonnes `_completed` restent
en place, seule la surface UI est masquée.

## Backfill exécuté (2026-04-24)

Commande exécutée via MCP Supabase :

```sql
UPDATE gd_dossier_enfant 
SET liaison_completed = true, renseignements_completed = true, updated_at = NOW()
WHERE ged_sent_at IS NULL 
  AND (liaison_completed = false OR renseignements_completed = false);
```

Résultat : **28 lignes mises à jour**, 0 dossier soumis touché, 42/42 dossiers
avec flags à true post-UPDATE. Les 2 drafts avec data réelle (1 liaison,
1 renseignements) voient leur data dans la preview readonly + badge « Déjà
complété » après déploiement UI.

## Références

- `docs/TODO.md` (scope chantier)
- `docs/ACROFORM_FIELDS.md` (champs AcroForm migrés, scope réduit post-ADR)
- `components/dossier-enfant/FichePreview.tsx` (composant preview)
- `components/dossier-enfant/DossierEnfantPanel.tsx` (rendu onglets)
- `app/api/dossier-enfant/[inscriptionId]/route.ts` (PATCH/INSERT flags)
- `app/api/dossier-enfant/[inscriptionId]/submit/route.ts` (email + checkbox)
