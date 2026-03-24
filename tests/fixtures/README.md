# Fixtures de test — GED_APP

Ce fichier documente les variables d'environnement requises pour lancer les tests
dossier-enfant et les préconditions à remplir en environnement local ou de staging.

---

## Variables d'environnement requises

| Variable | Obligatoire pour | Description |
|---|---|---|
| `TEST_SUIVI_TOKEN` | Tests E2E (A–E) + API (E, G, H, I) | `suivi_token` UUID d'une inscription de test dont le dossier n'a **pas** encore été soumis (`ged_sent_at IS NULL`) |
| `TEST_INSCRIPTION_ID` | Tests E2E (A–E) + API (E, G, H, I) | UUID de l'inscription correspondant au token ci-dessus (`gd_inscriptions.id`) |
| `TEST_SENT_INSCRIPTION_ID` | API (F, J) | UUID d'une inscription dont le dossier a **déjà** été soumis (`ged_sent_at IS NOT NULL`) |
| `TEST_SENT_SUIVI_TOKEN` | API (F) | `suivi_token` correspondant à `TEST_SENT_INSCRIPTION_ID` |
| `TEST_ADMIN_SESSION` | API (I, J) + E2E admin (K, L) | Valeur brute du cookie `gd_session` d'un compte admin actif |
| `PLAYWRIGHT_BASE_URL` | Tous les tests E2E | URL de l'appli à tester (défaut : `http://localhost:3000`) |
| `NEXT_PUBLIC_API_URL` | Tous les tests API | URL de base pour les appels fetch (défaut : `http://localhost:3000`) |

---

## Comment créer une inscription de test en dev

### 1. Prérequis
- Le serveur `npm run dev` doit tourner sur `http://localhost:3000`
- Les variables Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) doivent être configurées dans `.env.local`

### 2. Créer une inscription de test incomplète

Via Supabase Studio ou l'interface de réservation :

```sql
-- Vérifier une inscription de test existante avec dossier non soumis
SELECT
  i.id            AS inscription_id,
  i.suivi_token,
  i.referent_email,
  d.ged_sent_at
FROM gd_inscriptions i
LEFT JOIN gd_dossier_enfant d ON d.inscription_id = i.id
WHERE i.referent_email LIKE '%test%'
  AND (d.ged_sent_at IS NULL OR d.id IS NULL)
LIMIT 5;
```

Ou en créant une inscription de zéro via le formulaire de réservation (mode Pro, utiliser
une adresse email de test comme `test-ged@exemple.com`), puis récupérer le `suivi_token`
depuis la table `gd_inscriptions`.

### 3. Créer une inscription de test déjà soumise (pour tests F et J)

```sql
-- Marquer un dossier de test comme déjà envoyé
UPDATE gd_dossier_enfant
SET
  ged_sent_at = now(),
  bulletin_completed = true,
  sanitaire_completed = true,
  liaison_completed = true,
  renseignements_completed = true
WHERE inscription_id = '<UUID_INSCRIPTION_TEST>'
RETURNING id;
```

### 4. Obtenir un cookie de session admin

1. Se connecter sur `/admin/login` avec un compte admin
2. Ouvrir les DevTools > Application > Cookies > `gd_session`
3. Copier la valeur brute du cookie

---

## Fichier .env.test (non commité)

Créer un fichier `.env.test` à la racine (non commité — ajouter à `.gitignore`) :

```env
PLAYWRIGHT_BASE_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000

# Inscription de test incomplète
TEST_SUIVI_TOKEN=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
TEST_INSCRIPTION_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Inscription de test déjà soumise
TEST_SENT_INSCRIPTION_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
TEST_SENT_SUIVI_TOKEN=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Session admin
TEST_ADMIN_SESSION=<valeur_cookie_gd_session>
```

---

## Lancer les tests

```bash
# Tests API (Jest) — ne nécessite pas de navigateur
npm run test:api

# Tests E2E (Playwright) — nécessite le serveur dev
npm run dev &                          # dans un terminal dédié
npx playwright test tests/e2e/dossier-enfant.spec.ts

# Avec les variables de test chargées depuis .env.test
export $(cat .env.test | xargs) && npx playwright test tests/e2e/dossier-enfant.spec.ts
```

---

## Nettoyage après les tests

Les tests d'upload créent des documents dans Supabase Storage (`dossier-documents/<inscriptionId>/`).
Nettoyer manuellement via Supabase Studio > Storage > `dossier-documents` si nécessaire.

Les tests de relance (I) déclenchent un vrai email fire-and-forget si les clés Resend sont
configurées. Utiliser une adresse email de test ou désactiver Resend en dev si ce n'est pas souhaité.
