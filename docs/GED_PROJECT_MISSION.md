# GED_APP — Projet & Mission

**Dernière mise à jour** : 2026-03-31
**Version** : 1.0

---

## Mission

Groupe & Découverte (GED) est une plateforme numérique qui connecte les travailleurs sociaux (éducateurs, assistants familiaux, référents ASE) avec des séjours éducatifs pour enfants protégés âgés de 3 à 17 ans.

**Problème résolu** : Les enfants suivis par l'Aide Sociale à l'Enfance (ASE) ont un accès limité aux vacances et loisirs collectifs. GED facilite l'accès, le financement et l'organisation de ces séjours pour les professionnels de la protection de l'enfance.

---

## Utilisateurs

### 1. Kids (enfants)
- Parcourent les séjours disponibles
- Ajoutent des séjours à leur wishlist (localStorage)
- Envoient un "souhait" à leur éducateur référent
- Suivent l'état de leur souhait via un token

### 2. Professionnels / Structures sociales (éducateurs, référents)
- Reçoivent une notification email avec magic link quand un kid envoie un souhait
- Répondent au souhait (valider / discuter / refuser)
- Créent des inscriptions pour les enfants
- Remplissent le dossier enfant (4 blocs : bulletin, sanitaire, liaison, renseignements)
- Suivent l'état du dossier et du paiement via un token de suivi

### 3. Admin GED
- Gèrent les inscriptions (validation, suivi, statuts)
- Gèrent les séjours et sessions (dates, prix, capacité)
- Créent des propositions tarifaires pour les structures
- Gèrent les utilisateurs admin
- Accèdent aux statistiques

---

## Séjours proposés

24 séjours éducatifs en France, opérés par UFOVAL. Thématiques :
- Aventure / Sport intensif / Survie (MX RIDER ACADEMY, SURVIVOR CAMP 74, BRETAGNE OCEAN RIDE...)
- Nature / Premiers pas (ALPOO KIDS, MY LITTLE FOREST, HUSKY ADVENTURE...)
- Mer / Glisse (SURF SUR LE BASSIN, AZUR DIVE & JET, CORSICA WILD TRIP...)
- Tech / Urbain (GAMING HOUSE 1850, PARKOUR...)

Tranches d'âge : 3-7 ans, 8-11 ans, 11-14 ans, 14-17 ans selon les séjours.

---

## Flux principaux

### Flux A — Kid → Souhait → Inscription
```
Kid souhaite un séjour
  → Email éducateur (magic link, TTL 30j)
  → Éducateur répond (valide / refuse / en discussion)
  → Si validé → Inscription créée
  → Dossier enfant complété (4 blocs)
  → Paiement (CB Stripe / virement / chèque)
  → Admin valide
```

### Flux B — Admin → Proposition → Inscription
```
Admin crée proposition tarifaire
  → PDF généré (réf PROP-YYYYMM-XXXX)
  → Email envoyé à la structure avec PDF en PJ
  → Structure accepte/refuse en ligne (lien direct token)
  → Si accepté → Inscription créée automatiquement
  → Dossier enfant + paiement
```

---

## Modes de paiement

- **CB Stripe** : PaymentIntent + webhook `/api/webhooks/stripe`
- **Virement bancaire** : IBAN communiqué, validation manuelle admin
- **Chèque vacances / ANCV** : validation manuelle admin

---

## Statuts clés

### Inscription (`gd_inscriptions.status`)
`en_attente` → `validee` → `refusee` | `annulee`

### Paiement (`gd_inscriptions.payment_status`)
`pending_payment` → `paid` | `failed` | `amount_mismatch`

### Souhait (`gd_souhaits.status`)
`emis` → `vu` → `en_discussion` | `valide` | `refuse`

### Proposition tarifaire (`gd_propositions_tarifaires.status`)
`brouillon` → `envoyee` → `validee` | `refusee` | `annulee`

---

## Contacts clés

- **Admin GED** : contact@groupeetdecouverte.fr
- **App** : app.groupeetdecouverte.fr
- **Email notifications** : noreply@groupeetdecouverte.fr (Resend)

---

## Règles métier critiques

1. Un souhait par kid par séjour (anti-doublon sur kid_session_token + sejour_slug)
2. Le magic link éducateur expire après 30 jours
3. Les inscriptions supprimées sont en soft delete (champ `deleted_at`)
4. Chaque changement de statut admin est tracé dans `gd_inscription_status_logs`
5. Le webhook Stripe est idempotent (table `gd_processed_events`)
6. Les prix ne sont jamais exposés dans les endpoints publics
7. L'accès admin est protégé par JWT (cookie `gd_session`, httpOnly, 8h)
8. Rate limiting login : 5 tentatives / 15 min par IP
