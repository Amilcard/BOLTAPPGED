# 📊 Résumé des Scripts SQL Flooow (Groupe et Découverte)

## 📈 Vue d'ensemble

| Script | Lignes | Objets créés | Fonction |
|--------|--------|--------------|----------|
| **006_create_sejours_images_table.sql** | 259 | 2 tables, 8 index, 3 vues, 3 fonctions, 1 trigger | Gestion images séjours |
| **007_smart_form_routing_helpers.sql** | 517 | 3 tables, 5 index, 2 vues, 8 fonctions, 1 trigger | Smart Form + Business Logic |
| **TOTAL** | **776 lignes** | **27 objets** | Système complet |

---

## 📦 SCRIPT 1 : `006_create_sejours_images_table.sql` (259 lignes)

### 🗃️ Tables créées

#### **sejours_images** (table principale)
```sql
┌─────────────────────────────────────────────────┐
│ Métadonnées Images Collectées (Unsplash/Pexels)│
├─────────────────────────────────────────────────┤
│ • id (UUID) - Identifiant unique                │
│ • slug - Référence séjour (ex: "moto-moto")     │
│ • marketing_title - Titre premium               │
│ • emotion_tag - Tag émotion (MÉCANIQUE, etc.)   │
│ • carousel_group - Groupe (ADRENALINE_SENSATIONS)│
│ • age_range - Tranche d'âge (ex: "12-17")       │
│                                                  │
│ SOURCE & URLs:                                   │
│ • source (unsplash/pexels)                       │
│ • source_id - ID source                          │
│ • storage_path - Chemin Supabase Storage         │
│ • public_url - URL publique                      │
│ • thumbnail_url - Miniature                      │
│                                                  │
│ PHOTOGRAPHE (crédits):                           │
│ • photographer_name                              │
│ • photographer_url                               │
│ • photographer_portfolio                         │
│                                                  │
│ MÉTADONNÉES VISUELLES:                           │
│ • alt_description - Description accessibilité    │
│ • keyword_used - Mot-clé de recherche           │
│ • width, height - Dimensions                     │
│ • color - Couleur dominante (#hex)              │
│ • likes - Popularité source                     │
│                                                  │
│ QUALITÉ:                                         │
│ • status (active/archived/rejected)              │
│ • quality_score (1-10) - Score qualité visuelle │
│ • manual_selection - Sélection manuelle équipe  │
│                                                  │
│ TRACKING:                                        │
│ • imported_at - Date import                      │
│ • updated_at - Dernière MAJ                      │
│ • last_used_at - Dernière utilisation           │
│ • usage_count - Nb affichages                   │
│                                                  │
│ CONTRAINTE: UNIQUE(source, source_id)           │
└─────────────────────────────────────────────────┘
```

**8 Index de performance :**
- `idx_sejours_images_slug` → Recherche par séjour
- `idx_sejours_images_carousel` → Filtre par carousel
- `idx_sejours_images_emotion` → Filtre par émotion
- `idx_sejours_images_age_range` → Filtre par âge
- `idx_sejours_images_status` → Filtre actives/archivées
- `idx_sejours_images_source` → Recherche par source+id
- `idx_sejours_images_quality` → Tri par qualité DESC
- `idx_sejours_images_imported` → Tri par date DESC

#### **import_logs** (historique)
```sql
┌─────────────────────────────────────┐
│ Logs Imports Images                 │
├─────────────────────────────────────┤
│ • id (UUID)                          │
│ • type - Type import                 │
│ • total_items - Nb éléments importés │
│ • details (JSONB) - Stats détaillées │
│ • created_at - Date import           │
└─────────────────────────────────────┘
```

### 📊 Vues créées

**1. v_sejours_images_stats** - Statistiques par séjour
```sql
SELECT slug, marketing_title, carousel_group,
       total_images, active_images,
       from_unsplash, from_pexels,
       avg_quality, last_import_date
FROM v_sejours_images_stats;
```

**2. v_top_sejours_images** - Top images par qualité
```sql
SELECT slug, marketing_title, public_url,
       quality_score, usage_count, relevance_score
FROM v_top_sejours_images
LIMIT 20;
```

**3. v_sejours_missing_images** - Alertes séjours sans images
```sql
SELECT slug, marketing_title, current_images,
       priority (CRITICAL/LOW/MEDIUM/OK)
FROM v_sejours_missing_images
WHERE priority = 'CRITICAL';
```

### ⚙️ Fonctions créées

**1. get_random_sejour_image(slug)**
```sql
-- Retourne 1 image aléatoire pour un séjour
SELECT * FROM get_random_sejour_image('moto-moto');
```

**2. get_top_sejour_images(slug, limit)**
```sql
-- Retourne meilleures images triées par qualité + usage
SELECT * FROM get_top_sejour_images('moto-moto', 6);
```

**3. increment_image_usage(image_id)**
```sql
-- Incrémente compteur usage d'une image
SELECT increment_image_usage('uuid-here');
```

### 🔔 Trigger

**trigger_sejours_images_updated_at**
- MAJ automatique `updated_at` à chaque UPDATE

---

## 📦 SCRIPT 2 : `007_smart_form_routing_helpers.sql` (517 lignes)

### 🗃️ Tables créées

#### **smart_form_submissions** (soumissions formulaire)
```sql
┌─────────────────────────────────────────────────┐
│ Soumissions Smart Form Travailleurs Sociaux     │
├─────────────────────────────────────────────────┤
│ • id (UUID)                                      │
│                                                  │
│ PROFIL ENFANT:                                   │
│ • inclusion_level (NIVEAU_1/NIVEAU_2/NIVEAU_3)  │
│ • child_age - Âge enfant                         │
│ • interests[] - Centres d'intérêt               │
│                                                  │
│ BESOINS SPÉCIFIQUES:                             │
│ • urgence_48h - Départ urgent                   │
│ • handicap - Situation handicap                 │
│ • qf - Quotient Familial                        │
│ • qpv - Quartier Prioritaire                    │
│                                                  │
│ CONTACT:                                         │
│ • referent_organization - Organisme             │
│ • contact_email                                  │
│ • contact_phone                                  │
│                                                  │
│ RÉSULTAT:                                        │
│ • suggested_stays (JSONB) - Séjours proposés    │
│ • alert_priority (STANDARD/MEDIUM/HIGH/HOT_LEAD)│
│                                                  │
│ CRM:                                             │
│ • submitted_at - Date soumission                │
│ • crm_synced_at - Date sync CRM                 │
│ • crm_lead_id - ID lead dans CRM                │
└─────────────────────────────────────────────────┘
```

**3 Index :**
- `idx_smart_form_level` → Par niveau inclusion
- `idx_smart_form_submitted` → Par date DESC
- `idx_smart_form_urgence` → Filtre urgences (WHERE urgence_48h = TRUE)

#### **notification_queue** (queue notifications)
```sql
┌─────────────────────────────────────┐
│ Queue Notifications Alertes         │
├─────────────────────────────────────┤
│ • id (UUID)                          │
│ • type - Type notification           │
│ • priority - Priorité                │
│ • recipient - Destinataire           │
│ • subject - Sujet                    │
│ • payload (JSONB) - Données          │
│ • status (pending/sent/failed)       │
│ • created_at, sent_at                │
│ • error_message - Si échec           │
└─────────────────────────────────────┘
```

**2 Index :**
- `idx_notification_queue_status` → Par status + date
- `idx_notification_queue_priority` → Par priorité + date

### ⚙️ Fonctions créées (8 fonctions)

**1. get_suggested_stays_by_inclusion_level(level, age)**
```sql
-- Retourne séjours suggérés selon niveau + âge avec images
SELECT * FROM get_suggested_stays_by_inclusion_level('NIVEAU_2_RENFORCE', 14);

→ Résultat :
  slug, marketing_title, emotion_tag, carousel_group,
  age_min, age_max, punchline, spot_label, image_url
```

**2. get_stays_by_tags(tags[], age, limit)**
```sql
-- Recherche séjours par tags avec score matching
SELECT * FROM get_stays_by_tags(
  ARRAY['Mécanique', 'Sport Intensif'], 14, 10
);
```

**3. get_stay_carousel_images(slug, limit)**
```sql
-- Images carousel optimisées (qualité + rotation)
SELECT * FROM get_stay_carousel_images('moto-moto', 6);
```

**4. log_smart_form_submission(...)**
```sql
-- Enregistre soumission + détermine priorité alerte
SELECT log_smart_form_submission(
  'NIVEAU_2_RENFORCE',  -- inclusion_level
  14,                    -- child_age
  ARRAY['moto', 'sport'], -- interests
  false,                 -- urgence_48h
  false,                 -- handicap
  650,                   -- qf
  true,                  -- qpv
  'ASE Haute-Savoie',   -- organization
  'email@example.com',   -- email
  '0612345678',          -- phone
  '{"stays": []}'::jsonb -- suggested_stays
);

→ Retourne: UUID submission_id
```

**5. estimate_financial_aid(qf, qpv, price)**
```sql
-- Calcule aide financière selon QF + bonus QPV
SELECT * FROM estimate_financial_aid(450, true, 850);

→ Résultat :
  aide_montant: 850€
  reste_a_charge: 0€
  taux_prise_en_charge: 1.0 (100%)
  eligible_aide_max: true
```

**6. increment_image_usage(image_id)**
```sql
-- Track utilisation images (usage_count++)
SELECT increment_image_usage('uuid-image-id');
```

**7. update_sejours_images_updated_at()**
```sql
-- Fonction trigger MAJ timestamps
-- (appelée automatiquement par trigger)
```

**8. notify_urgent_submission()**
```sql
-- Fonction trigger alertes urgentes
-- Insère dans notification_queue si HIGH_PRIORITY ou HOT_LEAD
```

### 📊 Vues créées

**1. v_smart_form_stats** - Statistiques soumissions
```sql
SELECT inclusion_level,
       total_submissions, urgent_count,
       handicap_count, qpv_count,
       avg_child_age, avg_qf,
       synced_to_crm, last_submission
FROM v_smart_form_stats;
```

**2. v_smart_form_urgent_alerts** - Alertes en attente
```sql
SELECT id, inclusion_level, child_age,
       referent_organization,
       contact_email, contact_phone,
       alert_priority,
       hours_since_submission
FROM v_smart_form_urgent_alerts;
```

### 🔔 Trigger

**trigger_notify_urgent_submission**
- Déclenché AFTER INSERT sur `smart_form_submissions`
- Si `alert_priority` = HIGH_PRIORITY ou HOT_LEAD
- → Insère notification dans `notification_queue`

---

## 🎯 Exemples d'utilisation

### Cas 1 : Récupérer images pour un séjour

```sql
-- 6 meilleures images pour MX RIDER ACADEMY
SELECT
  public_url,
  photographer_name,
  quality_score
FROM get_stay_carousel_images('moto-moto', 6);
```

### Cas 2 : Smart Form - Ado 14 ans besoin cadre

```sql
-- Travailleur social cherche séjour cadre renforcé
SELECT
  marketing_title,
  emotion_tag,
  punchline,
  image_url
FROM get_suggested_stays_by_inclusion_level('NIVEAU_2_RENFORCE', 14);

-- Résultat : MX RIDER ACADEMY, SURVIVOR CAMP, BRETAGNE OCEAN RIDE...
```

### Cas 3 : Calcul aide financière

```sql
-- Famille QF=450€, QPV, séjour 850€
SELECT * FROM estimate_financial_aid(450, true, 850);

-- Résultat : 0€ reste à charge (100% pris en charge)
```

### Cas 4 : Dashboard admin - Alertes urgentes

```sql
-- Alertes HIGH_PRIORITY en attente
SELECT
  referent_organization,
  contact_phone,
  hours_since_submission
FROM v_smart_form_urgent_alerts
WHERE alert_priority = 'HIGH_PRIORITY_CALL_NOW'
ORDER BY submitted_at ASC;
```

---

## ✅ Validation avant exécution

### Prérequis vérifiés :

- ✅ Tables `gd_stays` existe (référencée dans vues)
- ✅ PostgreSQL 12+ (FILTER, LATERAL, JSONB)
- ✅ Extension `pgcrypto` pour UUID (gen_random_uuid)

### Safe à exécuter :

- ✅ Toutes les créations sont `IF NOT EXISTS` ou `OR REPLACE`
- ✅ Aucune suppression de données
- ✅ Aucune modification de tables existantes
- ✅ Uniquement ajouts de nouvelles structures

---

**Total : 776 lignes SQL | 27 objets créés | Production-ready ✨**
