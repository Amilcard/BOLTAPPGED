# Audit n8n — VPS Hostinger GED

**Date** : 7 mars 2026
**VPS** : `srv1307641.hstgr.cloud` (IP `147.93.126.86`)
**OS** : Ubuntu 24.04
**n8n URL** : `https://n8n.srv1307641.hstgr.cloud/`

---

## 1. Infrastructure

**Docker** : 1 projet "n8n", 2 conteneurs actifs (uptime ~45h au moment de l'audit) :

| Conteneur | Image | Ports | Rôle |
|---|---|---|---|
| `n8n-n8n-1` | `docker.n8n.io/n8nio/n8n` | `127.0.0.1:5678→5678/tcp` | Application n8n |
| `n8n-traefik-1` | `traefik` | — | Reverse proxy HTTPS |

**Volume données** : `/var/lib/docker/volumes/n8n_data/_data` → `/home/node/.n8n`
**Config** : `N8N_RUNNERS_ENABLED=true`, `N8N_PROTOCOL=https`, `WEBHOOK_URL=https://n8n.srv1307641.hstgr.cloud/`

**Version n8n** : Release stable (mais **> 6 semaines sans mise à jour** — "Error tracking disabled because this release is older than 6 weeks.")

---

## 2. Inventaire complet des workflows (25 workflows)

### ACTIF (1 seul)

| ID | Nom | Actif | Trigger | Dernière maj | Dernier événement |
|---|---|---|---|---|---|
| `kG6OASM4PxZaBt9H` | **GED__UFOVAL__SCRAPE_SEED_STAYS__v2_FIXED** | ✅ OUI | Manual Trigger + Webhook `ufoval-import` | 2026-02-02 | `manual_error` (02/02/2026) |

### INACTIFS (24 workflows)

#### Workflows UFOVAL Scraping (séjours)

| ID | Nom | Dernière maj | Notes |
|---|---|---|---|
| `SqjOjFYjQfc9y2PD` | UFOVAL Scraper - GED Production | 2026-01-30 | Ancien scraper prod, exécutions manuelles le 30/01 |
| `0tYjXOMCS5xwXbECq_8-z` | UFOVAL Scraper - GED Production | 2026-01-30 | Doublon |
| `3dwfBdWkRogadWNRNwo7q` | UFOVAL Scraper - GED Production | 2026-01-30 | Doublon |
| `XV8PUMWMkN69VU_ELLuMn` | UFOVAL Scraper - GED Production | 2026-01-30 | Doublon |
| `1t8goBUWx5Ea8zAJ0BDSI` | GED__UFOVAL__SCRAPE_SEED_STAYS__v1 | 2026-02-18 | Version 1, remplacée par v2_FIXED |
| `d7kV8YDGNiDRcoyrqbjIE` | GED__UFOVAL__SCRAPE_SEED_STAYS__v1 | 2026-02-18 | Doublon v1 |
| `Z7m4o1NJZfNA3CtK9-qHJ` | GED__UFOVAL__SCRAPE_SEED_STAYS__v2_FIXED | 2026-02-02 | Doublon du workflow actif |

#### Workflows Sessions / is_full

| ID | Nom | Dernière maj | Notes |
|---|---|---|---|
| `xkRGhkq8Ada0QMlJHx_F3` | **01 UFOVAL is_full SESSIONS v4** | 2026-02-18 | Trigger manual, INACTIF |
| `sV_pSvlz5mEk5FtfXuWC3` | GED_UFOVAL_SESSION_IS_FULL_v1 | 2026-02-18 | Ancienne version |
| `OGJ7S3kG66hV7mYdsidkF` | GED_UFOVAL_SESSION_IS_FULL_v1 | 2026-02-18 | Doublon |
| `vloMDKTlmfJL4zA_679aV` | GED_UFOVAL_SESSION_IS_FULL_DEBUG_v4 | 2026-02-18 | Version debug |

#### Workflow PHASE3 Sessions & Prix

| ID | Nom | Dernière maj | Notes |
|---|---|---|---|
| `Q6NYZ--VYw231rc6mMRtC` | **GED — PHASE3 Sessions & Prix Sync v2** | 2026-02-18 | Trigger manual, appelle Supabase API, INACTIF |

#### Workflow AI Image Generation

| ID | Nom | Dernière maj | Notes |
|---|---|---|---|
| `Z2zKVFQC93CDx_2yHfJta` | **UFOVAL — AI Image Generation v5.1 (Edge Function)** | 2026-02-20 | Appelle Supabase Edge Function via PATCH, INACTIF |

#### Workflows Transport

| ID | Nom | Dernière maj | Notes |
|---|---|---|---|
| `GppyDgLqBUq5fIMAjylaJ` | GED_UFOVAL_SCRAPE_TRANSPORT_ALL_17 | 2026-02-18 | INACTIF |
| `rntFMI3GRw7wv21B12cFf` | GED_UFOVAL_SCRAPE_TRANSPORT_TEST | 2026-02-18 | INACTIF |

#### Workflows Contenu

| ID | Nom | Dernière maj | Notes |
|---|---|---|---|
| `0GlIeZKVR7VoUFYNOYMV1` | GED_UFOVAL_SCRAPE_CONTENU_ALL | 2026-02-18 | INACTIF |

#### Workflows de test (à supprimer)

| Nom | Dernière maj |
|---|---|
| My workflow | 2026-02-18 |
| My workflow 3 | 2026-02-08 |
| My workflow 4 | 2026-02-18 |
| My workflow 5 | 2026-02-18 |
| My workflow 6 | 2026-02-18 |
| My workflow 7 | 2026-02-08 |

---

## 3. Identification des 2 workflows fonctionnels

Croisement des données n8n (statistiques d'exécution, dates, contenu) avec Supabase (table `gd_stays`, bucket `ged-sejours-images`) et l'app (`app.groupeetdecouverte.fr`).

### 3.1 Workflow 1 — Scraping/Complétude séjours

**Le bon workflow** : `GED__UFOVAL__SCRAPE_SEED_STAYS__v2_FIXED` (ID `kG6OASM4PxZaBt9H`)

**Preuves croisées :**
- Seul workflow **ACTIF** sur l'instance n8n
- **70 exécutions manuelles réussies** (`manual_success`) le 2 février 2026
- 1 `production_success` le 31 janvier 2026
- Les URLs UFOVAL dans le workflow (`ufoval.fol74.org/sejours-colonies-de-vacances/...`) correspondent aux **24 séjours** présents dans la table `gd_stays` sur Supabase
- Les `import_batch_ts` de `gd_stays` datent du 2 février 2026, cohérent avec les 70 succès manuels de ce jour
- Webhook `ufoval-import` enregistré pour ce workflow

**État actuel** : Le dernier événement est `manual_error` (02/02/2026 à 08:23), MAIS 70 `manual_success` ont suivi à 18:08 le même jour. Le workflow a donc fonctionné après l'erreur.

**Trigger** : Manual Trigger + Webhook POST `ufoval-import` (pas de cron automatique).

### 3.2 Workflow 2 — AI Image Generation

**Le bon workflow** : `UFOVAL — AI Image Generation v5.1 (Edge Function)` (ID `Z2zKVFQC93CDx_2yHfJta`)

**Preuves croisées :**
- Seul workflow de génération d'images sur l'instance
- Le plus récemment mis à jour : **20 février 2026**
- Cible la table `gd_stays.images` via HTTP PATCH sur l'Edge Function Supabase (`gd_stays?slug=eq.{{ $json.slug }}`)
- La table `gd_stays` montre **24 séjours avec 5 images chacun** (`images IS NOT NULL`, `img_count = 5`) — les images ont bien été générées et stockées
- Le bucket Supabase Storage `ged-sejours-images` (PUBLIC) contient 4 dossiers de catégories : ADRENALINE_SENSATIO..., AVENTURE_DECOUVERTE, MA_PREMIERE_COLO, TEST
- L'authentification utilise `httpHeaderAuth` avec Bearer token vers Supabase

**État actuel** : INACTIF (active=0), aucune exécution récente enregistrée dans les statistiques. Le workflow a fonctionné par le passé (les images existent en BDD) mais est actuellement désactivé.

**Note** : L'app `app.groupeetdecouverte.fr` affiche les séjours mais les **images ne se chargent pas** (zones grises visibles). À investiguer : les URLs d'images dans `gd_stays.images` pointent-elles vers des fichiers existants dans le bucket Storage ?

---

## 4. Problèmes identifiés

### Critiques

1. **Aucun workflow ne tourne automatiquement** — Tous les triggers sont manuels. Aucun cron/schedule n'est configuré. Le scraping UFOVAL ne se fait pas de manière automatisée.

2. **Le seul workflow actif est en erreur** — `GED__UFOVAL__SCRAPE_SEED_STAYS__v2_FIXED` a son dernier statut = `manual_error` depuis le 2 février (plus d'un mois).

3. **L'historique d'exécution est vide** — Tables `execution_entity` et `execution_data` = 0 enregistrements. Impossible de diagnostiquer les erreurs passées en détail. La compaction automatique purge tout.

4. **Version n8n obsolète** — Release de plus de 6 semaines, error tracking désactivé.

5. **Python 3 manquant** dans le conteneur — "Failed to start Python task runner in internal mode" (répété dans les logs). Si des workflows utilisent du code Python, ils échoueront.

6. **AI Image Generation inactif + 0 crédits nexos.ai** — Aucune image ne sera générée pour les nouveaux séjours.

### Moyens

7. **24 workflows inactifs** dont beaucoup de doublons et de tests — Pollution qui complique la maintenance.

8. **Échecs d'authentification API** — Logs montrent "Authorization failed - please check your credentials" et multiples "browserId check failed".

---

## 5. Consolidation — Pas nécessaire (1 seule instance)

Tous les workflows sont déjà dans la **même et unique instance n8n** sur le VPS. Il n'y a pas de deuxième instance à consolider.

---

## 6. Plan d'action recommandé

### Immédiat (priorité haute)

1. **Mettre à jour n8n** — `docker compose pull && docker compose up -d` dans `/local-files/` (ou le dossier du docker-compose).

2. **Débugger le workflow SCRAPE_SEED_STAYS v2_FIXED** — Se connecter à l'interface n8n (`https://n8n.srv1307641.hstgr.cloud/`), ouvrir le workflow, le lancer manuellement et analyser l'erreur.

3. **Ajouter un trigger Cron/Schedule** au workflow de scraping pour qu'il s'exécute automatiquement (ex: toutes les 6h ou quotidiennement).

4. **Activer le workflow AI Image Generation v5.1** — Vérifier les crédits nexos.ai, recharger si nécessaire, puis activer le workflow.

5. **Activer les workflows complémentaires** :
   - `01 UFOVAL is_full SESSIONS v4` (vérification places disponibles)
   - `GED — PHASE3 Sessions & Prix Sync v2` (sync prix/sessions)
   - Les configurer avec des triggers Cron appropriés.

### Court terme (ménage)

6. **Supprimer les workflows de test** — "My workflow" 1 à 7.

7. **Supprimer les doublons** — Garder uniquement la version la plus récente de chaque workflow (v2_FIXED pour le scraping, v4 pour is_full, etc.).

8. **Configurer la rétention des exécutions** — Garder au moins 7 jours d'historique pour le debugging.

9. **Installer Python 3** dans le conteneur n8n si des nodes Code Python sont utilisés.

### Moyen terme

10. **Orchestration** — Créer un "meta-workflow" qui enchaîne : Scrape UFOVAL → Sync Sessions & Prix → Check is_full → Generate AI Images pour les nouveaux séjours.

11. **Monitoring** — Configurer des alertes (email/webhook) en cas d'échec de workflow.

---

## 7. Corrections appliquées (7 mars 2026)

### 7.1 Accès n8n restauré

**Problème** : L'interface web n8n (`https://n8n.srv1307641.hstgr.cloud/`) était inaccessible — connexion refusée sur les ports 80 et 443.

**Diagnostic** :
- Nginx (installé par défaut par Hostinger) occupait le port 80, empêchant Traefik de binder les ports 80 et 443.
- `docker compose restart` ne suffit pas — les port bindings sont fixés à la création du conteneur, pas au restart.
- Les erreurs Traefik `ged@docker` et `ged-app@docker` provenaient d'une ancienne config nginx obsolète (vestige d'un reverse proxy vers `localhost:3000` pour `app.groupeetdecouverte.fr`, mais rien ne tournait sur le port 3000).

**Corrections appliquées** :
1. `systemctl stop nginx && systemctl disable nginx` — Arrêt et désactivation de Nginx
2. `docker compose down && docker compose up -d` dans `/docker/n8n/` — Recréation des conteneurs pour binder les ports

**Vérification cascade** :
- La config nginx `ged-app` (site-enabled) pointait vers `localhost:3000` mais **aucun processus n'écoutait sur ce port** → config morte, aucun impact
- L'app `app.groupeetdecouverte.fr` fonctionne normalement (hébergée ailleurs, pas sur ce VPS)
- Aucun service système ne dépendait de Nginx (`systemctl list-dependencies --reverse`)
- Pas de Hostinger panel service lié à Nginx

**Résultat** :
- ✅ n8n accessible sur `https://n8n.srv1307641.hstgr.cloud/` (page de sign-in affichée)
- ✅ Traefik écoute sur ports 80 (HTTP→HTTPS redirect) et 443 (HTTPS avec Let's Encrypt)
- ✅ Certificat SSL automatique via `mytlschallenge` (ACME TLS challenge)
- ✅ App GED (`app.groupeetdecouverte.fr`) non impactée

### 7.2 Fichiers de configuration clés

| Fichier | Chemin | Contenu |
|---|---|---|
| Docker Compose | `/docker/n8n/docker-compose.yml` | n8n + Traefik |
| Variables env | `/docker/n8n/.env` | DOMAIN_NAME, SUBDOMAIN, SSL_EMAIL |
| Données n8n | `/var/lib/docker/volumes/n8n_data/_data` | SQLite DB + config |
| Nginx (désactivé) | `/etc/nginx/sites-enabled/ged-app` | Ancienne config morte |

### 7.3 Modèle business identifié

Le pipeline GED fonctionne ainsi : **Scraping séjours UFOVAL → Reformulation complète → Ajout marge → Génération images AI → Publication sur app.groupeetdecouverte.fr**. Les workflows n8n gèrent les étapes d'import et de génération d'images.
