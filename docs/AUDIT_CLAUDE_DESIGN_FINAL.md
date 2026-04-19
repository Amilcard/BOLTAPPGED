# Audit final Claude Design — UI Kit MonApp Colo

Synthèse de l'audit complet 2026-04-19 sur les 28 fichiers livrés par Claude Design.

## Livrables Claude Design

| Type | Nombre | Fichiers |
|---|---|---|
| **Shared (design system)** | 5 | `tokens.css`, `kit.css`, `chrome.js`, `data.js`, `icons.js` |
| **Écrans HTML B2C** | 21 | screens/*.html |
| **Index / présentation** | 2 | `index.html` (gallery) + `index-print.html` (PDF export) |

**Total : 28 fichiers**

## Score global : **90/100**

| Bloc | Score | Commentaire |
|---|---|---|
| Design system (tokens+kit) | 98 | Alignement parfait avec repo + bonus |
| Composants shared | 85 | 3 icônes manquantes |
| 21 écrans HTML | 92 | Excellente qualité UX |
| Présentation (index) | 85 | PDF incomplet |

## Scores par écran (21)

| Écran | Score | Note |
|---|---|---|
| home.html | 96 | Hero impact + 3 catégories + reassurance pro |
| recherche.html | 95 | Baseline kids/pro séparation + chips multi |
| filtres.html | 93 | `:has(input:checked)` + sticky apply |
| detail.html | 95 | Hero gallery 5 images + sidebar kids/pro |
| souhait.html | 85 | ⚠️ RGPD incomplet |
| envies.html | 92 | Empty state pro |
| login.html | 94 | Toggle Jeune/Référent·e novateur |
| reset.html | 95 | Anti-enumeration + fallback humain |
| acceder-pro.html | 92 | Types structure secteur ASE |
| inscription-urgence.html | 92 | Motifs réels + rappel horaire |
| reserver.html | 80 | ⚠️ RGPD "chiffrées" faux |
| recap.html | 94 | Checklist + alerte constructive |
| paiement.html | 93 | Aide JPA/CAF ligne verte + simul échec |
| educateur-inbox.html | 94 | KPI + dots statut + row--new |
| educateur-souhait.html | 93 | Timeline sidebar + 3 actions |
| admin-structure.html | 95 | KPI + 3 tabs + rôles ASE |
| comparer.html | 88 | 8 critères alignés |
| profil-kid.html | 90 | Transparence RGPD + export données |
| notifications.html | 92 | Gradient unread + types différenciés |
| planning.html | 96 | Countdown + timeline + alerte tâche |
| retour-sejour.html | 94 | Mood grid + toggle anonymisation |

## 🔴 12 corrections à pousser à Claude Design

### RGPD (5)
| # | Fichier | Ligne | Correction |
|---|---|---|---|
| 1 | reserver.html | 102-105 | "chiffrées" → "accessibles aux personnes habilitées" + durée + lien `/confidentialite` |
| 2 | souhait.html | 69-74 | Ajouter durée conservation + lien |
| 3 | home.html | 112-118 | Ajouter lien `/confidentialite` |
| 4 | acceder-pro.html | 96-99 | Retirer "chiffrées" + ajouter lien |
| 5 | login.html | 67-70 | Ajouter lien |

**Référence exemplaire** : `retour-sejour.html:85-87` et `profil-kid.html:79-88`.

### Bugs (4)
| # | Fichier | Correction |
|---|---|---|
| 6 | icons.js | Ajouter `Bell`, `Edit`, `Download` (3 icônes manquantes) |
| 7 | data.js:67 | Husky "Haute-Savoie — Massif des Glières" → Savoie (centre Creil'Alpes = Aillon-le-Jeune 73) |
| 8 | index.html | Compteur "20 écrans" → "21 écrans" |
| 9 | index-print.html | Étendre le `SCREENS` array de 12 à 21 écrans |

### Décoration (3)
| # | Fichier | Correction |
|---|---|---|
| 10 | kit.css:322-327 | Aligner typo `.text-*` sur tokens `var(--fs-*)` |
| 11 | kit.css:60-62 | mode-pill rouge → token charte (secondary ou accent) |
| 12 | kit.css:225 | `.reassurance` radius 12px hardcodé → `var(--radius-brand)` |

## 🌟 25 patterns supérieurs à l'existant — à adopter dans le repo

### Kids
1. Countdown "Dans 42 jours" + "Ajouter au calendrier" (planning)
2. Mood grid 4 emojis avec aria-pressed (retour-sejour)
3. Toggle anonymisation publication (retour-sejour)
4. Dichotomie "bon souvenir" / "moins bon moment" (retour-sejour)
5. Page Mon compte avec export données RGPD (profil-kid)
6. Transparence "peut voir 3 souhaits" (profil-kid)
7. Gradient unread notif + unread-bullet 8px (notifications)
8. Empty state avec CTA action (envies, notifications)

### Pro
9. KPI strip 4 cards responsive (inbox, admin-structure)
10. Table → cards empilées mobile (inbox, admin-structure)
11. Filter chips avec dots colorés statut (inbox)
12. row--new gradient terracotta (inbox)
13. Tabs border-bottom terracotta (admin-structure)
14. Timeline sidebar avec dots states (educateur-souhait)

### Transverse
15. Hero gallery 5 images grid responsive (detail)
16. Sidebar mode-dependent kids/pro (detail)
17. Sticky action bar mobile avec CTA différencié (detail)
18. `:has(input:checked)` CSS moderne (filtres)
19. Sticky apply bar avec compteur live (filtres)
20. **Ligne aide financière JPA/CAF verte négative** (paiement)
21. Anti-enumeration login "si un compte existe" (reset)
22. Alert constructive "vous pouvez continuer" (recap)
23. Checklist avec états visuels + alertes contextuelles (planning, recap)
24. Breadcrumb avec bullet terracotta (detail)
25. Blockquote border-left terracotta (educateur-souhait)

## Mapping livraison ↔ repo

### ✅ Alignés (13)
Accueil, Explorer, Filtres avancés, Détail séjour, Ajouter souhait, Mes souhaits, Connexion, Mot de passe oublié, Créer accès pro, Inscription urgente, Inbox souhaits, Souhait détail, Inscrire un jeune (reserver)

### 🆕 Features nouvelles proposées (6)
Comparer, Mon compte kids, Notifications, Planning séjour, Retour de séjour, Équipe & structure

### ❌ Pas encore produits (6+)
- 4 pages légales : `/cgu`, `/cgv`, `/confidentialite`, `/mentions-legales`
- 2 parcours pro structure : `/structure/login`, `/structure/activate`
- 21 sous-écrans dashboards (Phase 2)
- 23 emails HTML + 5 PDFs

## Décisions produit tranchées

| Item | Décision 2026-04-19 |
|---|---|
| Brand "MonApp Colo" + endorsement "Groupe & Découverte" | ✅ Validé (installation plus tard) |
| Toggle kids/pro via localStorage + reload | ✅ Accepté pour maquette, React context en prod |
| Échelle typo custom vs Tailwind | À valider (tokens OK rem, kit.css écart 1-2px) |

## Décisions produit en attente

- **D1 Comparateur séjours** — adopter (design prêt) ?
- **D2 Mon compte kids** — créer JWT kids léger vs localStorage only ?
- **D3 Notifications** — système backend à créer ?
- **D4 Planning séjour J-42** — feature engageante à adopter ?
- **D5 Retour de séjour** — valeur UX forte à adopter ?

---

**Préparé 2026-04-19**
**Compagnon de** : `ETAT_DES_LIEUX_GRAPHIQUE.md`, `ETAT_DES_LIEUX_GRAPHIQUE_DASHBOARD.md`, `QUESTIONS_CLAUDE_DESIGN.md`, `QUESTIONS_CLAUDE_DESIGN_DASHBOARD.md`, `MAPPING_CLAUDE_DESIGN_SCREENS.md`, `SCREENS_SPEC_B2C.md`, `AUDIT_CLAUDE_DESIGN_2026-04-19.md`
