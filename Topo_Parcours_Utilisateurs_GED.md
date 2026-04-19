# Parcours utilisateurs GED_APP — app.groupeetdecouverte.fr

## 3 types d'utilisateurs, 3 parcours distincts

---

## Parcours 1 — L'enfant / ado

L'enfant ou l'adolescent navigue seul sur l'application. Il arrive sur la page d'accueil qui affiche des carrousels de sejours (colos) classes par theme (montagne, mer, sport, decouverte). Il peut aussi passer par la page `/recherche` pour explorer tous les sejours disponibles.

En cliquant sur un sejour, il arrive sur la fiche detaillee (`/sejour/[id]`) : titre marketing, description, tranches d'age, dates des sessions, prix indicatif. Depuis cette page, il peut cliquer sur "Ajouter a mes souhaits".

Une modale s'ouvre (`WishlistModal`) dans laquelle il remplit :
- **Son prenom** (obligatoire)
- **L'email de son accompagnant·e** (educateur, animateur, referent — obligatoire)
- **Sa motivation** : ce qui l'attire dans ce sejour (minimum 20 caracteres, max 280)
- Optionnel : le prenom de son accompagnant·e (pour personnaliser le message)

A la validation, le souhait est enregistre en base de donnees (`gd_souhaits`) et un **email est automatiquement envoye a l'educateur** avec un lien magique (`/educateur/souhait/[token]`) pour qu'il puisse repondre.

L'enfant retrouve tous ses souhaits sur la page `/envies` avec le statut en temps reel : Envoye, Consulte, En discussion, Valide, Pas cette fois. Si l'educateur a laisse un commentaire, il le voit egalement.

**Important** : l'enfant ne s'inscrit pas lui-meme, ne choisit pas d'options educatives, ne paie rien. Son seul role est d'exprimer un souhait et d'attendre la reponse de son accompagnant·e.

### Pages concernees
- `/` — Page d'accueil (carrousels)
- `/recherche` — Recherche / exploration
- `/sejour/[id]` — Fiche sejour (consultation + emission de souhait)
- `/envies` — Liste de mes souhaits + suivi des statuts

### API concernees
- POST `/api/souhaits` — Creation / mise a jour d'un souhait
- GET `/api/souhaits/kid/[kidToken]` — Recuperation des souhaits de l'enfant (via UUID localStorage)

---

## Parcours 2 — L'educateur referent / travailleur social

L'educateur entre dans l'app de deux facons, toujours sans creation de compte (acces par token UUID) :

### 2a — Reponse a un souhait

L'educateur recoit un email contenant un lien magique (`/educateur/souhait/[token]`). Sur cette page, il voit :
- Le prenom de l'enfant
- Le sejour souhaite (avec lien vers la fiche)
- La motivation de l'enfant

Il peut repondre avec 3 actions :
- **Valider** — le souhait est accepte
- **On en parle** — mise en discussion
- **Pas possible** — le souhait est refuse

Il peut aussi ajouter un commentaire optionnel. Si le souhait est valide, un bouton CTA l'invite a aller vers la fiche sejour pour proceder a l'inscription.

### 2b — Inscription (reservation)

C'est l'educateur (et non l'enfant) qui realise l'inscription sur `/sejour/[id]/reserver`. Le formulaire `BookingFlow` comprend :

1. Choix de la session (dates)
2. Informations du referent (organisation, nom, email, telephone)
3. Informations de l'enfant (prenom, nom, date de naissance)
4. Ville de depart (avec surcharge transport eventuelle)
5. Options educatives (le cas echeant)
6. Remarques
7. Choix du mode de paiement (carte Stripe, virement ou cheque)
8. Paiement Stripe (si carte selectionnee)

Si toutes les sessions sont completes, 3 sejours alternatifs sont proposes.

Verifications serveur a l'inscription :
- Age de l'enfant (3-17 ans, calcule a la date de depart)
- Coherence du prix (verification serveur contre la base tarifaire)
- Capacite de la session (via RPC atomique + flag is_full UFOVAL)
- Anti-doublon (meme referent + sejour + session + date naissance)

Une fois l'inscription creee, un **token de suivi UUID** est genere et envoye par email au referent.

### 2c — Suivi post-inscription

Via le lien `/suivi/[token]`, l'educateur retrouve toutes les inscriptions liees a son email. Pour chaque dossier, il voit :
- Le statut de l'inscription (en attente, validee, refusee, annulee)
- Le statut du paiement (en attente, regle, echoue)
- Le montant et le mode de paiement
- La completude du dossier enfant (documents en attente / partiels / complets)

Il peut :
- **Uploader les documents obligatoires** du dossier enfant (fiches sanitaire, liaison, etc.)
- **Soumettre le dossier complet** (generation d'un PDF recapitulatif)
- **Renseigner ses preferences de suivi** : recevoir des nouvelles pendant le sejour (oui / si necessaire / non), canal prefere (email / telephone / les deux), demander un bilan ecrit en fin de sejour
- **Signaler des besoins specifiques** ou consignes de communication pour l'equipe encadrante

Resume financier global si plusieurs inscriptions (montant total, nombre regles / en attente).

### Pages concernees
- `/educateur/souhait/[token]` — Reponse a un souhait (lien magique)
- `/sejour/[id]/reserver` — Formulaire d'inscription (BookingFlow)
- `/suivi/[token]` — Tableau de bord suivi inscriptions + dossier enfant

### API concernees
- GET/PATCH `/api/educateur/souhait/[token]` — Gestion souhait
- POST `/api/inscriptions` — Creation inscription
- POST `/api/payment/create-intent` — Paiement Stripe
- POST `/api/webhooks/stripe` — Webhook Stripe (confirmation paiement)
- GET/PATCH `/api/suivi/[token]` — Suivi inscriptions + preferences
- GET/PATCH `/api/dossier-enfant/[inscriptionId]` — Dossier enfant
- POST `/api/dossier-enfant/[inscriptionId]/upload` — Upload documents
- POST `/api/dossier-enfant/[inscriptionId]/submit` — Soumission dossier
- GET `/api/dossier-enfant/[inscriptionId]/pdf` — Generation PDF

---

## Parcours 3 — L'administrateur GED

L'admin se connecte via `/login` (email + mot de passe Supabase). L'authentification cree un cookie JWT (`gd_session`) signe avec `NEXTAUTH_SECRET`, valide 8h, protegeant toutes les routes `/admin/*`.

Le dashboard (`/admin`) affiche les statistiques globales. La page demandes (`/admin/demandes`) liste toutes les inscriptions avec filtres et actions : voir le detail, changer le statut, consulter le dossier enfant, telecharger le PDF, et envoyer une relance email au referent si le dossier est incomplet.

L'admin gere aussi :
- Les sejours (`/admin/sejours`) — creation, edition, themes, tranches d'age
- Les sessions et tarifs (`/admin/sessions`) — dates, prix par ville, capacite, flag "complet"
- Les utilisateurs admin (`/admin/users`) — roles (admin, editeur, lecteur)
- Les propositions (`/admin/propositions`) — sejours soumis par des partenaires

### Pages concernees
- `/login` — Connexion admin
- `/admin` — Dashboard
- `/admin/demandes` — Liste inscriptions
- `/admin/demandes/[id]` — Detail inscription
- `/admin/sejours` — Gestion sejours
- `/admin/sessions` — Gestion sessions/tarifs
- `/admin/users` — Gestion utilisateurs
- `/admin/propositions` — Propositions partenaires

### API concernees
- POST `/api/auth/login` — Authentification
- GET `/api/admin/stats` — Statistiques
- GET/PATCH `/api/admin/inscriptions/[id]` — Gestion inscription
- POST `/api/admin/inscriptions/[id]/relance` — Relance email
- GET/POST/PATCH `/api/admin/stays` — CRUD sejours
- GET/POST/PATCH `/api/admin/stays/[id]/sessions` — CRUD sessions

---

## Flux critique complet

```
Enfant : Page d'accueil -> Fiche sejour -> Souhait (prenom + motivation + email educ)
                                                     |
                                                     v
Educateur : Email lien magique -> Reponse souhait -> [Si valide] -> Fiche sejour -> BookingFlow 8 etapes -> Inscription BDD + Stripe -> Email confirmation + token suivi
                                                                                                                                              |
                                                                                                                                              v
Educateur : Page suivi -> Upload dossier enfant -> Soumission -> PDF recapitulatif
                                                                       |
                                                                       v
Admin : Dashboard -> Validation inscription -> Relance si dossier incomplet
```

## Pages statiques
- `/cgu` — Conditions generales d'utilisation
- `/cgv` — Conditions generales de vente
- `/confidentialite` — Politique de confidentialite
- `/mentions-legales` — Mentions legales

---

*Document corrige le 28 mars 2026 — Audit GED_APP*
