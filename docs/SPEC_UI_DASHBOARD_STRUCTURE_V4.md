# Spécification UI — Dashboard Structure GED App
## Version 4 · Avril 2026 · 2 onglets + 5 sous-onglets éducatifs

---

## Architecture générale

### Éléments fixes (toujours affichés)
- **Barre urgence** : GED Astreinte H24 + Dir. colo + SAMU/Police/Pompiers/119
- **Header structure** : Nom, ville, type, badge rôle, nb séjours actifs, code
- **Footer** : Email GED, téléphone, horaires

### 2 onglets principaux
- **Dossiers en ligne** (accent bleu #185FA5) — complétion documentaire, zéro finance
- **Suivi éducatif** (accent teal #0F6E56) — avant/pendant/après séjour, zéro finance

---

## Onglet 1 — Dossiers en ligne

### KPIs (4 cartes)
| KPI | Calcul | Couleur |
|---|---|---|
| À compléter | complétude < 100% AND non refusé | Bleu |
| Validés GED | complétude 100% AND validé_ged | Vert |
| En cours | complétude 1-99% | Amber |
| Non commencés | complétude 0% | Gris |

### Bannière dématérialisation
"Tous les documents se remplissent en ligne"
+ Alerte J-7 si dossier < 100% ET départ ≤ 7j

### Tableau dossiers
Colonnes : Avatar enfant + Séjour + 6 dots documents (S/M/L/R/A/PJ) + Statut + "Compléter →"
Pas de prix, pas de date inscription.

---

## Onglet 2 — Suivi éducatif

### KPIs terrain (4 cartes permanentes)
| KPI | Source | Couleur si 0 | Si > 0 |
|---|---|---|---|
| En séjour maintenant | inscriptions active | Bleu | Bleu |
| Départs J-7 | sessions date_fin - NOW ≤ 7 | Gris | Amber |
| Alertes médicales | suivi_medical clos=false | Gris | Rouge |
| Incidents ouverts | suivi_incidents clos=false | Gris | Rouge |

Bannière "tout va bien" si tous alertes = 0.

### 5 sous-onglets (pills Avant/Pendant/Après + Médical + Appels transversaux)

#### A. Avant — Préparation départs
Par enfant : âge, allergies, contact urgence, besoins spécifiques, badge statut.
Barre gauche : rouge=refusée, bleu=en attente.

#### B. Pendant — Monitoring temps réel
Par enfant : RAG (vert/amber/rouge), J+X/Y jours avec barre progression, fiche liaison validée/à valider, dernier événement.
Actions rapides : Note · Appel · Signaler.

#### C. Médical (transversal)
Tableau : enfant, date, motif, praticien, famille informée ✅/❌, structure informée.
Alertes : famille non informée +24h, traitement actif.

#### D. Appels & Messages
4 compteurs : rappels prioritaires, messages non lus, appels passés, astreinte sollicitée.
Journal appels + messagerie GED ↔ structure.

#### E. Après — Bilan
6 cartes synthèse : sans incident, incidents, médical, appels, avertissements, rapatriements.
Notes fin de séjour par enfant. Bouton "Imprimer le bilan" (PDF).

---

## Tables Supabase requises

| Table | Existe | Usage |
|---|---|---|
| gd_inscriptions | Oui | KPIs, tableau, bilan |
| gd_stays / gd_stay_sessions | Oui | Séjours, dates |
| gd_dossier_enfant | Oui | Complétude, docs |
| gd_structures | Oui | Header, rôle |
| gd_structure_access_codes | Oui | 4 rôles |
| gd_suivi_incidents | **À créer** | RAG, incidents, bilan |
| gd_suivi_medical | **À créer** | Médical, alertes |
| gd_appels | **À créer** | Journal appels |
| gd_suivi_messages | **À créer** | Messagerie |
| gd_fiches_liaison | **À créer** | Validation directeur colo |
| gd_contacts_urgence | **À créer** | Contact urgence par enfant |
| gd_parametres_structure | **À créer** | Astreinte, directeur colo |
| gd_parametres_ged | **À créer** | Config globale GED |

---

## Différences clés Admin vs Éducatif

| Donnée | Onglet Admin | Onglet Éducatif |
|---|---|---|
| Prix | Oui | **Jamais** |
| Paiement | Oui | **Jamais** |
| Réf. dossier admin | Oui | Non |
| Allergies/besoins | Non | **Oui** |
| Contact urgence | Non | **Oui** |
| Fiche liaison validée | Non | **Oui** |
| Timeline incidents | Non | **Oui** |
| Actions (Note/Appel/Signaler) | Non | **Oui** |
| Codes d'accès | Direction | Non |
| Délégation | Direction | Non |
