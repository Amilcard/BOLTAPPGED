# Fiche synoptique test GED — Thanh

**À imprimer recto-verso · Garder à côté de vous pendant le test**

---

## Mes identifiants

| Usage | Valeur |
|---|---|
| Mail terrain (éducatrice + secrétariat) | `ttu.nguyen188@gmail.com` |
| Mail pro (direction + admin GED) | `Thanh.Nguyen@univ-lyon2.fr` |
| Admin GED — password | `TestGED2026!` |
| Code Direction (10 chars) | `20A1F449A8` |
| Code CDS (6 chars) | `8D7FC4` |
| Structure test | Structure Test Thanh, 86 rue Pasteur, 69007 Lyon |

**Application à tester :** https://app.groupeetdecouverte.fr

---

## Les 16 parcours en un coup d'œil

### Bloc A — Vous jouez une jeune de 13 ans (sans compte)

| # | Parcours | Adresse | Mail | Temps |
|---|---|---|---|---|
| P1 | Découvrir l'appli | `/` | — | 10 min |
| P2 | Explorer catalogue | `/recherche` | — | 15 min |
| P3 | Mettre en favoris | `/envies` | — | 10 min |
| P4 | Envoyer envies à éducatrice | Via formulaire | gmail | 10 min |

### Bloc B — Vous jouez une éducatrice ASE

| # | Parcours | Adresse | Mail | Temps |
|---|---|---|---|---|
| P5 | Lire envies reçues | Lien dans email | gmail | 10 min |
| P6 | Demander un tarif | `/sejour/[slug]` | gmail | 10 min |
| P7 | Demander accès pro | `/acceder-pro` | gmail | 10 min |
| P8 | Se connecter pro | `/login?context=pro` | gmail + code `8D7FC4` | 5 min |
| P9 | Inscrire un jeune | `/sejour/[slug]/reserver` | gmail | 20 min |
| P10 | Remplir le dossier | Lien email reçu | gmail | 30 min |
| P11 | Signer et envoyer | Idem P10 | gmail | 15 min |

### Bloc C — Vous jouez direction / secrétariat

| # | Parcours | Adresse | Mail | Temps |
|---|---|---|---|---|
| P12 | Connexion direction | `/structure/login` → `20A1F449A8` | univ-lyon2 | 5 min |
| P13 | Inviter secrétaire | Dashboard direction | univ-lyon2 | 15 min |
| P14 | Activer compte secrétaire | Lien email | gmail | 10 min |
| P15 | Secrétaire remplit dossier | Dashboard secrétariat | gmail | 20 min |

### Bloc D — Vous jouez admin GED

| # | Parcours | Adresse | Mail | Temps |
|---|---|---|---|---|
| P16 | Consulter admin ⚠️ | `/login` | univ-lyon2 + `TestGED2026!` | 15 min |

**Total cumulé : ~4 heures** (sur 1 ou 2 journées)

---

## Points d'attention rapides

### Avant de démarrer

- 2 boîtes mail ouvertes en même temps (gmail + univ-lyon2)
- Dossier captures d'écran prêt (`IMG_001.png`, `IMG_002.png`, …)
- Navigateur récent (Chrome / Firefox / Safari / Edge au choix)
- Testez aussi sur téléphone, pas seulement sur PC

### Pendant les parcours

- Le site peut afficher un widget Cloudflare "Vérification" → **cochez-le**
- La date de naissance doit faire que l'enfant ait **6 ans au moment du séjour** (pas aujourd'hui)
- Le code structure `8D7FC4` ou `20A1F449A8` est à saisir **à l'étape 3/5 du formulaire** d'inscription
- Pour le paiement, utilisez la carte test : `4242 4242 4242 4242`, date future, CVC `123`

### Sur P16 (admin) — règle d'or

**REGARDEZ, NE CLIQUEZ PAS.** Le compte admin a les droits d'écriture sur la vraie prod.

Ne cliquez JAMAIS :
- Boutons "Supprimer", "Révoquer", "Annuler"
- "Valider l'inscription", "Changer le statut"
- "Envoyer email", "Envoyer la facture", "Relancer"
- Changements de prix, dates, capacité

### Gravité à cocher dans votre tableau de retour

- **1** = détail cosmétique (typo, alignement)
- **2** = gêne mineure (compris mais pénible)
- **3** = gêne importante (j'ai dû tâtonner)
- **4** = bloquant partiel (une partie impossible)
- **5** = bloquant total (le parcours ne marche pas)

---

## Contact en cas de souci

- **Équipe GED** : `groupeetdecouverte@gmail.com`
- **Téléphone urgence** : 04 23 16 16 71

---

**Bon courage.** Ce guide + le guide complet = tout ce dont vous avez besoin.
Si un point n'est pas clair, notez **"Pas compris, j'ai arrêté"** et passez au
parcours suivant. C'est l'info la plus précieuse pour nous.

*Dernière mise à jour : 19 avril 2026 au soir (après fixes UX nocturnes)*
