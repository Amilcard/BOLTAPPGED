# ✅ Système Complet : Collecte d'Images + Smart Form Flooow

## 📦 Vue d'Ensemble

Ce document récapitule **l'intégration complète** du système Flooow comprenant :

1. **Collecte automatique d'images** (n8n + Unsplash/Pexels)
2. **Smart Form de routage intelligent** (Business logic + SQL)
3. **Mapping produits et règles visuelles cinématographiques**

---

## 🗂️ Fichiers Créés

### 📸 **Système Images**

| Fichier | Description | Usage |
|---------|-------------|-------|
| `flooow-sejours-images-mapping-v2.json` | Mapping séjours → mots-clés cinématographiques | Config source pour n8n |
| `n8n-flooow-image-collector-v3-cinematic.json` | Workflow n8n avec filtres visuels avancés | Import dans n8n |
| `sql/006_create_sejours_images_table.sql` | Schéma BDD pour images | Exécuter dans Supabase |
| `docs/N8N_IMAGE_COLLECTOR_GUIDE.md` | Guide technique complet (400+ lignes) | Documentation développeur |

### 🎯 **Système Smart Form**

| Fichier | Description | Usage |
|---------|-------------|-------|
| `business_logic_rules.json` | Règles métier centralisées (smart form, visual mapping, product display) | Config référence unique |
| `sql/007_smart_form_routing_helpers.sql` | Fonctions SQL backend | Exécuter dans Supabase |
| `docs/SMART_FORM_INTEGRATION_GUIDE.md` | Guide d'intégration frontend/backend | Documentation développeur |

---

## 🚀 Installation Rapide

### Étape 1 : Base de Données

```bash
# Connectez-vous à Supabase
psql -h your-project.supabase.co -U postgres -d flooow

# Exécutez les deux scripts
\i sql/006_create_sejours_images_table.sql
\i sql/007_smart_form_routing_helpers.sql
```

### Étape 2 : Workflow n8n

1. Ouvrir n8n
2. Import → `n8n-flooow-image-collector-v3-cinematic.json`
3. Configurer credentials :
   - Unsplash API Key
   - Pexels API Key
   - Supabase (Project URL + Service Role Key)
4. Ajuster le chemin vers `flooow-sejours-images-mapping-v2.json`
5. Test manuel → Activer le Schedule Trigger

### Étape 3 : Frontend

Suivre le guide : `docs/SMART_FORM_INTEGRATION_GUIDE.md`

---

## 📐 Architecture Globale

```
┌─────────────────────────────────────────────────────────┐
│                  UTILISATEUR B2B                         │
│            (Travailleur Social / Élu)                   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
          ┌────────────────────────┐
          │   SMART FORM FLOOOW    │
          │  (Frontend React/Next) │
          └────────────┬───────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
         ▼                           ▼
┌──────────────────┐      ┌──────────────────┐
│ business_logic_  │      │  API Routes      │
│ rules.json       │◄─────│  Next.js         │
│                  │      └────────┬─────────┘
│ - Smart Form     │               │
│ - Visual Mapping │               ▼
│ - Product Display│      ┌──────────────────┐
└──────────────────┘      │  Fonctions SQL   │
                          │  - get_suggested  │
                          │  - log_submission │
                          │  - estimate_aid   │
                          └────────┬─────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │  SUPABASE        │
                          │  PostgreSQL      │
                          │                  │
                          │  Tables:         │
                          │  - gd_stays      │
                          │  - sejours_images│
                          │  - smart_form_   │
                          │    submissions   │
                          └────────┬─────────┘
                                   │
            ┌──────────────────────┴──────────────────────┐
            │                                             │
            ▼                                             ▼
   ┌──────────────────┐                        ┌──────────────────┐
   │  SUPABASE        │                        │  n8n WORKFLOW    │
   │  STORAGE         │                        │  (Images Cron)   │
   │                  │◄───────────────────────│                  │
   │  Bucket:         │      Upload            │  - Unsplash API  │
   │  flooow-sejours- │                        │  - Pexels API    │
   │  images/         │                        │  - Filtres visuels│
   │                  │                        │  - Score qualité │
   └──────────────────┘                        └──────────────────┘
            │                                             ▲
            │                                             │
            └─────────────────┬───────────────────────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │  flooow-sejours-    │
                   │  images-mapping-    │
                   │  v2.json            │
                   │                     │
                   │  24 séjours avec    │
                   │  stratégies visuelles│
                   │  cinématographiques │
                   └─────────────────────┘
```

---

## 🔗 Liens entre les Systèmes

### 1. **Smart Form → Séjours Suggérés**

```typescript
// Frontend soumet niveau inclusion
POST /api/smart-form/submit
  body: { inclusion_level: 'NIVEAU_2_RENFORCE', child_age: 14 }

// Backend consulte business_logic_rules.json
const rule = businessLogicRules.smart_form_routing_rules.find(...)

// Backend appelle fonction SQL
SELECT * FROM get_suggested_stays_by_inclusion_level('NIVEAU_2_RENFORCE', 14)

// SQL retourne séjours avec images
LEFT JOIN sejours_images ON slug = ...
```

### 2. **Séjours → Images Cinématographiques**

```typescript
// Workflow n8n lit mapping v2
const sejour = mapping.sejours.find(s => s.slug === 'moto-moto')

// Utilise stratégie visuelle précise
const queries = [
  sejour.visual_strategy.primary_query,    // "motocross mud action helmet detail"
  ...sejour.visual_strategy.secondary_queries // ["quad biking dust", ...]
]

// Recherche sur Unsplash/Pexels
GET https://api.unsplash.com/search/photos?query=${query}

// Filtre avec score qualité visuelle
if (photo.visual_score >= 3 && !hasExcludedPatterns) {
  // Upload Supabase Storage
  // Insert sejours_images
}
```

### 3. **Produits → Noms Premium**

```typescript
// business_logic_rules.json définit
{
  "db_id": "moto-moto",
  "premium_title": "MX RIDER ACADEMY",
  "tagline": "Pilotage & Maîtrise"
}

// Frontend affiche toujours premium_title
<h2>{stay.premium_title}</h2>  // "MX RIDER ACADEMY"
// Jamais : stay.db_id ("moto-moto")
```

---

## 🎬 Exemple Complet : Parcours Utilisateur

### Scénario : Travailleur Social ASE cherche séjour pour ado 14 ans besoin cadre

#### 1. **Smart Form**

```
Utilisateur sélectionne :
- Niveau : NIVEAU_2_RENFORCE
- Âge : 14 ans
- QPV : Oui
- QF : 450€
```

#### 2. **Backend Routing**

```typescript
// business_logic_rules.json appliqué
{
  "input_selection": "NIVEAU_2_RENFORCE",
  "display_logic": {
    "show_catalog": true,
    "filter_tags": ["Mécanique", "Sport Intensif", "Cadre Serré"],
    "suggested_stays": ["MX RIDER ACADEMY", "SURVIVOR CAMP 74", ...]
  }
}

// Fonction SQL
SELECT * FROM get_suggested_stays_by_inclusion_level('NIVEAU_2_RENFORCE', 14)
→ Retourne : MX RIDER ACADEMY, SURVIVOR CAMP, BRETAGNE OCEAN RIDE...
```

#### 3. **Affichage Images**

```typescript
// Pour chaque séjour, récupérer images
SELECT * FROM get_stay_carousel_images('moto-moto', 6)

// Retourne images avec :
- visual_mood: "Gritty & Dynamic"
- color_palette: "Earth tones, orange dust, dark metals"
- quality_score: 4.5/5
- photographer credits
```

#### 4. **Calcul Aide Financière**

```sql
SELECT * FROM estimate_financial_aid(450, true, 850)
→ {
  aide_montant: 850,
  reste_a_charge: 0,
  taux_prise_en_charge: 1.0,
  eligible_aide_max: true
}
```

#### 5. **Affichage Final**

```
┌─────────────────────────────────────────┐
│ [Image cinématique motocross]           │
│ ADRENALINE & SENSATIONS                │
│                                          │
│ MX RIDER ACADEMY                        │
│ Pilotage & Maîtrise                     │
│                                          │
│ 📍 Haute-Savoie - Les Carroz            │
│ 👥 12-17 ans                             │
│                                          │
│ 💰 Reste à charge : 0€                  │
│ ✨ 100% pris en charge !                │
│                                          │
│ [Voir le séjour →]                      │
└─────────────────────────────────────────┘
```

---

## 📊 Tables Supabase Créées

### Images

```sql
sejours_images (
  - id, slug, marketing_title, emotion_tag
  - source (unsplash/pexels), source_id
  - public_url, thumbnail_url
  - photographer_name, photographer_url
  - visual_score, visual_mood, color_palette
  - quality_score, usage_count
  - imported_at
)
```

### Smart Form

```sql
smart_form_submissions (
  - id, inclusion_level, child_age
  - urgence_48h, handicap, qf, qpv
  - referent_organization, contact_email, contact_phone
  - suggested_stays (JSON)
  - alert_priority
  - submitted_at, crm_synced_at
)
```

### Notifications

```sql
notification_queue (
  - id, type, priority, recipient
  - subject, payload (JSON)
  - status (pending/sent/failed)
  - created_at, sent_at
)
```

---

## 🎯 Points Clés Business Logic

### Smart Form Routing

1. **NIVEAU_1_INCLUSION** → Catalogue ouvert, séjours doux (MA_PREMIERE_COLO, OCEAN_FUN)
2. **NIVEAU_2_RENFORCE** → Catalogue filtré, séjours cadre renforcé (ADRENALINE_SENSATIONS, mécanique/survie)
3. **NIVEAU_3_RUPTURE** → Pas de catalogue, modal contact immédiat, alerte HIGH_PRIORITY

### Visual Guidelines

- **Style** : Cinematic, Low saturation, High contrast, Candid shots
- **GDPR** : Éviter visages reconnaissables → Back views, silhouettes, gear detail
- **Filtres** : Exclure "smiling group posing", "classroom", "staged"
- **Score** : visual_score minimum 3/5 pour être accepté

### Product Display

- **Toujours** afficher `premium_title` (ex: "MX RIDER ACADEMY")
- **Jamais** afficher `db_id` ou noms UFOVAL
- **Prix B2B** : Masquer prix exact → "Tarif Conventionné / Devis Immédiat"
- **Prix Familles** : Afficher `price_from` + calculateur aide

---

## ✅ Checklist Complète

### Backend

- [ ] `sql/006_create_sejours_images_table.sql` exécuté
- [ ] `sql/007_smart_form_routing_helpers.sql` exécuté
- [ ] Tables créées et indexées
- [ ] Fonctions SQL testées

### n8n

- [ ] Workflow v3 importé
- [ ] Credentials Unsplash/Pexels configurées
- [ ] Credential Supabase configurée
- [ ] Chemin mapping v2 ajusté
- [ ] Test manuel réussi
- [ ] Schedule Trigger activé

### Frontend

- [ ] Types TypeScript créés
- [ ] Composant `SmartForm.tsx` implémenté
- [ ] Composant `SmartFormResults.tsx` implémenté
- [ ] API Route `/api/smart-form/submit` créée
- [ ] API Route `/api/smart-form/financial-aid` créée
- [ ] Dashboard admin créé
- [ ] Tests E2E effectués

### Configuration

- [ ] `business_logic_rules.json` versionné dans git
- [ ] `flooow-sejours-images-mapping-v2.json` versionné
- [ ] Variables d'environnement configurées
- [ ] Webhook notifications (optionnel)

---

## 📚 Documentation

1. **`docs/N8N_IMAGE_COLLECTOR_GUIDE.md`** (400+ lignes)
   - Architecture workflow
   - Configuration APIs
   - Mapping séjours/images
   - Monitoring & Maintenance

2. **`docs/SMART_FORM_INTEGRATION_GUIDE.md`** (500+ lignes)
   - Installation BDD
   - Types TypeScript
   - Composants React
   - API Routes
   - Dashboard Admin

3. **`business_logic_rules.json`** (JSON commenté)
   - Smart form routing rules
   - Visual mapping rules (cinematic)
   - Product display rules
   - Notification rules

---

## 🔧 Configuration .env

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# n8n (si self-hosted)
N8N_WEBHOOK_URL=https://your-n8n.domain/webhook/...

# Notifications (optionnel)
SALES_TEAM_PHONE=+33612345678
SMS_PROVIDER_API_KEY=...

# APIs Images
UNSPLASH_ACCESS_KEY=your-unsplash-key
PEXELS_API_KEY=your-pexels-key
```

---

## 🚀 Lancement

### Développement

```bash
# 1. Base de données
psql < sql/006_create_sejours_images_table.sql
psql < sql/007_smart_form_routing_helpers.sql

# 2. n8n
# Importer workflow via UI

# 3. Frontend
npm install
npm run dev
# → http://localhost:3000
```

### Production

```bash
# 1. Vérifier env vars
echo $SUPABASE_SERVICE_ROLE_KEY

# 2. Build
npm run build

# 3. Deploy
vercel deploy
# ou
pm2 start npm -- start
```

---

## 📞 Support

- **Documentation complète** : `/docs`
- **Issues** : Créer ticket GitHub
- **Email** : groupeetdecouverte@gmail.com

---

## 🎉 Prochaines Étapes

1. **Phase 1** : ✅ **Systèmes créés**
2. **Phase 2** : Intégration frontend (à faire)
3. **Phase 3** : Tests terrain avec 2-3 travailleurs sociaux
4. **Phase 4** : Monitoring & optimisations

---

**Auteur** : Équipe Flooow InKlusif + Claude Sonnet 4.5
**Date** : 7 février 2026
**Version** : 1.0 (Production-Ready)
