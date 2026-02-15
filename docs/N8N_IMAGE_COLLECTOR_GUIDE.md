# Guide Technique : Collecteur d'Images Séjours Flooow

## 📋 Vue d'ensemble

Système automatisé de collecte d'images depuis Unsplash et Pexels, alignées sur les 24 séjours Flooow avec mapping précis par :
- **Âge** (3-9 ans, 8-15 ans, 12-17 ans)
- **Activité** (moto, équitation, surf, survie, parapente, etc.)
- **Format** (landscape 1200x800 minimum)
- **Émotion** (MÉCANIQUE, AÉRIEN, SURVIE, PASSION, etc.)

---

## 🎯 Objectifs

1. **Automatisation complète** : collecte hebdomadaire sans intervention
2. **Qualité garantie** : filtres dimensions, content_filter:high, âge approprié
3. **Attribution légale** : stockage photographe + URL pour crédits
4. **Traçabilité** : logs d'import, statistiques par séjour/source
5. **Évolutivité** : ajout facile de nouveaux séjours via JSON

---

## 📦 Fichiers du Projet

```
/mnt/GED_APP/
├── n8n-flooow-image-collector-v2.json    # Workflow n8n principal
├── flooow-sejours-images-mapping.json     # Mapping séjours → mots-clés
├── sql/
│   └── 006_create_sejours_images_table.sql # Schéma BDD
└── docs/
    └── N8N_IMAGE_COLLECTOR_GUIDE.md       # Ce fichier
```

---

## 🗄️ Architecture Base de Données

### Table principale : `sejours_images`

```sql
CREATE TABLE sejours_images (
  -- Identifiant
  id UUID PRIMARY KEY,

  -- Référence séjour
  slug VARCHAR(255) NOT NULL,           -- Ex: "moto-moto"
  marketing_title VARCHAR(255),         -- Ex: "MX RIDER ACADEMY"
  emotion_tag VARCHAR(50),              -- Ex: "MÉCANIQUE"
  carousel_group VARCHAR(50),           -- Ex: "ADRENALINE_SENSATIONS"
  age_range VARCHAR(20),                -- Ex: "12-17"

  -- Source
  source VARCHAR(20),                   -- "unsplash" | "pexels"
  source_id VARCHAR(100) NOT NULL,

  -- URLs
  storage_path TEXT,                    -- Chemin Supabase Storage
  public_url TEXT,                      -- URL publique finale
  thumbnail_url TEXT,

  -- Attribution
  photographer_name VARCHAR(255),
  photographer_url TEXT,
  photographer_portfolio TEXT,

  -- Métadonnées
  alt_description TEXT,
  keyword_used VARCHAR(255),            -- Mot-clé ayant trouvé l'image
  width INTEGER,
  height INTEGER,
  color VARCHAR(10),
  likes INTEGER,

  -- Qualité
  status VARCHAR(20) DEFAULT 'active',  -- active | archived | rejected
  quality_score INTEGER DEFAULT 5,      -- 1-10
  manual_selection BOOLEAN DEFAULT FALSE,

  -- Tracking
  imported_at TIMESTAMP,
  updated_at TIMESTAMP,
  last_used_at TIMESTAMP,
  usage_count INTEGER DEFAULT 0,

  UNIQUE(source, source_id)
);
```

### Vues utiles

```sql
-- Statistiques par séjour
SELECT * FROM v_sejours_images_stats;

-- Top images par qualité
SELECT * FROM v_top_sejours_images LIMIT 20;

-- Séjours manquant d'images
SELECT * FROM v_sejours_missing_images WHERE priority = 'CRITICAL';
```

### Fonctions SQL

```sql
-- Obtenir une image aléatoire pour un séjour
SELECT * FROM get_random_sejour_image('moto-moto');

-- Obtenir les 5 meilleures images
SELECT * FROM get_top_sejour_images('annecy-element', 5);

-- Incrémenter compteur d'usage
SELECT increment_image_usage('uuid-image-id');
```

---

## 🔄 Workflow n8n : Architecture

### 1. Déclenchement
- **Trigger** : Schedule (tous les dimanches 3h)
- **Manuel** : via bouton "Execute Workflow"

### 2. Chargement Configuration
```javascript
// Nœud: Charger Mapping Séjours
operation: "read"
filePath: "/path/to/flooow-sejours-images-mapping.json"
```

### 3. Parser & Split
```javascript
// Nœud: Parser Configuration
// Transforme le JSON en éléments individuels par séjour
const mapping = JSON.parse($input.first().json.data);
return mapping.sejours.map(sejour => ({ json: sejour }));
```

### 4. Préparer Recherches
```javascript
// Nœud: Préparer Recherches
// Prend les 4 premiers mots-clés par séjour
// 3 images par mot-clé = 12 images max/séjour
const keywordsToUse = item.keywords_en.slice(0, 4);
```

### 5. Double Recherche Parallèle

#### Unsplash API
```http
GET https://api.unsplash.com/search/photos
?query={{ $json.current_keyword }}
&per_page=3
&orientation=landscape
&content_filter=high
&order_by=relevant

Headers:
Authorization: Client-ID YOUR_UNSPLASH_ACCESS_KEY
```

#### Pexels API
```http
GET https://api.pexels.com/v1/search
?query={{ $json.current_keyword }}
&per_page=3
&orientation=landscape
&size=large

Headers:
Authorization: YOUR_PEXELS_API_KEY
```

### 6. Normalisation
```javascript
// Nœud: Normaliser Unsplash / Pexels
// Uniformise les formats API
{
  source: 'unsplash',
  source_id: photo.id,
  url_regular: photo.urls.regular,
  url_raw: photo.urls.raw,
  url_thumb: photo.urls.thumb,
  download_url: photo.links.download_location,
  photographer: photo.user.name,
  photographer_url: photo.user.links.html,
  width: photo.width,
  height: photo.height,
  alt_description: photo.alt_description,
  // + métadonnées séjour
  slug: sejour.slug,
  marketing_title: sejour.marketing_title,
  emotion_tag: sejour.emotion_tag,
  carousel_group: sejour.carousel_group,
  age_range: sejour.age_range,
  keyword_used: sejour.current_keyword
}
```

### 7. Filtres Qualité
```javascript
// Nœud: Filtre Qualité
IF width >= 1200 AND height >= 800
  → Continuer
ELSE
  → Rejeter
```

### 8. Vérification Duplicatas
```sql
-- Nœud: Vérifier Existant
SELECT source_id FROM sejours_images
WHERE source = '{{ source }}' AND source_id = '{{ source_id }}'
LIMIT 1;

-- Nœud: Filtrer Nouveaux
IF result is empty → Continuer (nouvelle image)
ELSE → Skip (déjà importée)
```

### 9. Téléchargement
```javascript
// Nœud: Télécharger Image
method: "GET"
url: "={{ $json.download_url }}"
response.responseFormat: "file"
outputPropertyName: "image_binary"
timeout: 30000
```

### 10. Upload Supabase Storage
```javascript
// Nœud: Upload Supabase
operation: "upload"
bucketName: "flooow-sejours-images"
fileName: "={{ $json.carousel_group }}/{{ $json.slug }}/{{ $json.source }}_{{ $json.emotion_tag }}_{{ $json.source_id }}.jpg"
binaryPropertyName: "image_binary"
contentType: "image/jpeg"
cacheControl: "public, max-age=31536000, immutable"
```

Structure Supabase :
```
flooow-sejours-images/
├── ADRENALINE_SENSATIONS/
│   ├── moto-moto/
│   │   ├── unsplash_MÉCANIQUE_abc123.jpg
│   │   ├── pexels_MÉCANIQUE_456789.jpg
│   ├── annecy-element/
│   │   ├── unsplash_AÉRIEN_xyz789.jpg
├── ALTITUDE_AVENTURE/
│   ├── les-robinson-des-glieres/
│   │   ├── unsplash_SURVIE_def456.jpg
├── OCEAN_FUN/
├── MA_PREMIERE_COLO/
```

### 11. Enregistrement BDD
```sql
-- Nœud: Enregistrer BDD
INSERT INTO sejours_images (
  slug, marketing_title, emotion_tag, carousel_group, age_range,
  source, source_id, storage_path, public_url, thumbnail_url,
  photographer_name, photographer_url, photographer_portfolio,
  alt_description, keyword_used, width, height, color, likes,
  imported_at
) VALUES (...)
ON CONFLICT (source, source_id) DO NOTHING;
```

### 12. Statistiques & Logs
```javascript
// Nœud: Statistiques Import
{
  timestamp: "2026-02-07T19:00:00Z",
  total_imported: 142,
  by_carousel: {
    "ADRENALINE_SENSATIONS": 48,
    "ALTITUDE_AVENTURE": 54,
    "OCEAN_FUN": 28,
    "MA_PREMIERE_COLO": 12
  },
  by_emotion: {
    "MÉCANIQUE": 12,
    "AÉRIEN": 15,
    "SURVIE": 18,
    ...
  },
  by_source: {
    "unsplash": 78,
    "pexels": 64
  },
  by_sejour: {
    "moto-moto (MX RIDER ACADEMY)": 8,
    "annecy-element (ALPINE SKY CAMP)": 10,
    ...
  },
  top_photographers: {
    "John Doe": 8,
    "Jane Smith": 6,
    ...
  }
}
```

---

## 🔑 Configuration APIs

### 1. Clés API Requises

#### Unsplash
1. Créer compte développeur : https://unsplash.com/developers
2. Créer application → obtenir **Access Key**
3. Dans n8n :
   - Credentials → Add Credential → HTTP Query Auth
   - Name: `Unsplash API Key`
   - Name: `client_id`
   - Value: `YOUR_UNSPLASH_ACCESS_KEY`

#### Pexels
1. Créer compte : https://www.pexels.com/api/
2. Obtenir **API Key**
3. Dans n8n :
   - Credentials → Add Credential → HTTP Header Auth
   - Name: `Pexels API Key`
   - Name: `Authorization`
   - Value: `YOUR_PEXELS_API_KEY`

### 2. Supabase
1. Dans Supabase Dashboard :
   - Storage → Create bucket `flooow-sejours-images`
   - Settings → Public bucket (ou configurer RLS)
2. API Credentials :
   - Project URL : `https://your-project.supabase.co`
   - Service Role Key : `eyJ...` (depuis Settings > API)
3. Dans n8n :
   - Credentials → Add Credential → Supabase API
   - Name: `Supabase Flooow`
   - Host: `https://your-project.supabase.co`
   - Service Role Secret: `eyJ...`

---

## 🎨 Mapping Séjours → Images

### Structure JSON

```json
{
  "sejours": [
    {
      "slug": "moto-moto",
      "marketing_title": "MX RIDER ACADEMY",
      "emotion_tag": "MÉCANIQUE",
      "carousel_group": "ADRENALINE_SENSATIONS",
      "age_range": "12-17",
      "keywords_en": [
        "motocross teens",
        "motorcycle training youth",
        "dirt bike circuit",
        "youth motorsport"
      ],
      "keywords_fr": [
        "moto cross ados",
        "pilotage moto jeunes"
      ],
      "image_style": "action, dynamique, mécanique",
      "orientation": "landscape",
      "age_visible": "teens"
    }
  ]
}
```

### Catégories d'Âge

| Code | Âge | Style Images | Contexte |
|------|-----|--------------|----------|
| `young_children` | 3-9 ans | Doux, coloré, ludique | Activités encadrées, joie |
| `children` | 8-15 ans | Dynamique, aventure | Action modérée, groupe |
| `teens` | 12-17 ans | Action, liberté, défi | Sport intense, autonomie |

### Tags Émotionnels

| Tag | Description | Mots-clés Associés |
|-----|-------------|-------------------|
| MÉCANIQUE | Machines, technique | motocross, mechanics, garage |
| AÉRIEN | Altitude, ciel | paragliding, sky, aerial |
| SURVIE | Bushcraft, autonomie | wilderness, survival, camping |
| PASSION | Engagement spécialisé | dedication, focus, training |
| GLISSE | Sports de glisse | surfing, sliding, waves |
| DOUCEUR | Calme, sécurisant | gentle, soft, cozy |

---

## 🚀 Installation & Déploiement

### Prérequis
- n8n installé (self-hosted ou n8n.cloud)
- Supabase project actif
- Clés API Unsplash + Pexels
- Accès base de données PostgreSQL

### Étapes

#### 1. Créer la base de données
```bash
# Connectez-vous à votre PostgreSQL/Supabase
psql -h your-db-host -U postgres -d flooow

# Exécutez le schéma
\i sql/006_create_sejours_images_table.sql
```

#### 2. Configurer Supabase Storage
```sql
-- Créer le bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('flooow-sejours-images', 'flooow-sejours-images', true);

-- Politique d'accès lecture publique
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'flooow-sejours-images');

-- Politique upload service_role uniquement
CREATE POLICY "Service Role Upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'flooow-sejours-images' AND auth.role() = 'service_role');
```

#### 3. Importer workflow n8n
1. n8n → Workflows → Import from File
2. Sélectionner `n8n-flooow-image-collector-v2.json`
3. Configurer les credentials :
   - Unsplash API Key
   - Pexels API Key
   - Supabase Flooow

#### 4. Ajuster le chemin du mapping
```javascript
// Nœud: Charger Mapping Séjours
filePath: "/absolute/path/to/flooow-sejours-images-mapping.json"
```

#### 5. Test manuel
1. Désactiver le Schedule Trigger
2. Cliquer "Execute Workflow"
3. Vérifier :
   - Logs n8n (pas d'erreurs)
   - Supabase Storage (images uploadées)
   - Table `sejours_images` (lignes insérées)
   - Table `import_logs` (statistiques)

#### 6. Activer l'automatisation
- Réactiver Schedule Trigger
- Ajuster cron si besoin (`0 3 * * 0` = dim 3h)

---

## 📊 Monitoring & Maintenance

### Vérifications Quotidiennes

```sql
-- Images importées dernières 24h
SELECT COUNT(*), source
FROM sejours_images
WHERE imported_at > NOW() - INTERVAL '24 hours'
GROUP BY source;

-- Séjours sans images
SELECT slug, marketing_title
FROM gd_stays
WHERE published = true
AND slug NOT IN (
  SELECT DISTINCT slug FROM sejours_images WHERE status = 'active'
);

-- Top photographes
SELECT photographer_name, COUNT(*) as images
FROM sejours_images
WHERE imported_at > NOW() - INTERVAL '7 days'
GROUP BY photographer_name
ORDER BY images DESC
LIMIT 10;
```

### Alertes à Configurer

1. **Échec workflow n8n** → Email/Slack
2. **Séjour < 3 images** → Dashboard admin
3. **API rate limit atteint** → Retry automatique + log
4. **Image upload fail** → Log détaillé

### Maintenance Mensuelle

```sql
-- Archiver images peu utilisées
UPDATE sejours_images
SET status = 'archived'
WHERE usage_count = 0
AND imported_at < NOW() - INTERVAL '6 months'
AND manual_selection = FALSE;

-- Statistiques qualité
SELECT
  AVG(quality_score) as avg_quality,
  COUNT(*) FILTER (WHERE manual_selection = TRUE) as manual_count,
  COUNT(*) FILTER (WHERE usage_count > 10) as popular_count
FROM sejours_images
WHERE status = 'active';
```

---

## 🎯 Utilisation dans l'Application

### 1. Récupérer images pour un séjour

```typescript
// app/sejours/[slug]/page.tsx
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const supabase = createClient();

  // Récupérer image principale
  const { data: image } = await supabase
    .from('sejours_images')
    .select('public_url, alt_description, photographer_name')
    .eq('slug', params.slug)
    .eq('status', 'active')
    .order('quality_score', { ascending: false })
    .limit(1)
    .single();

  return {
    openGraph: {
      images: [image?.public_url],
    },
  };
}
```

### 2. Carousel images

```typescript
// components/SejourGallery.tsx
'use client';

import { useEffect, useState } from 'react';

export function SejourGallery({ slug }: { slug: string }) {
  const [images, setImages] = useState([]);

  useEffect(() => {
    fetch(`/api/sejours/${slug}/images?limit=6`)
      .then(res => res.json())
      .then(data => setImages(data));
  }, [slug]);

  return (
    <div className="grid grid-cols-3 gap-4">
      {images.map((img) => (
        <div key={img.id} className="relative aspect-video">
          <img
            src={img.public_url}
            alt={img.alt_description}
            className="object-cover rounded-lg"
          />
          <div className="absolute bottom-2 right-2 text-xs bg-black/50 px-2 py-1 rounded">
            Photo: {img.photographer_name}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 3. API Route

```typescript
// app/api/sejours/[slug]/images/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '6');

  const supabase = createClient();

  const { data, error } = await supabase
    .from('sejours_images')
    .select('*')
    .eq('slug', params.slug)
    .eq('status', 'active')
    .order('quality_score', { ascending: false })
    .order('usage_count', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Incrémenter usage_count
  if (data && data.length > 0) {
    await supabase.rpc('increment_image_usage', {
      image_id: data[0].id
    });
  }

  return NextResponse.json(data);
}
```

### 4. Affichage crédits photographes

```typescript
// components/ImageCredit.tsx
export function ImageCredit({ photographer, url }: {
  photographer: string;
  url: string;
}) {
  return (
    <div className="text-xs text-gray-500">
      Photo par{' '}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-gray-700"
      >
        {photographer}
      </a>
      {' sur '}
      <a
        href="https://unsplash.com"
        className="underline hover:text-gray-700"
      >
        Unsplash
      </a>
    </div>
  );
}
```

---

## 🔧 Personnalisation

### Ajouter un nouveau séjour

1. Éditez `flooow-sejours-images-mapping.json` :
```json
{
  "slug": "nouveau-sejour",
  "marketing_title": "NOUVEAU TITRE",
  "emotion_tag": "NOUVELLE_EMOTION",
  "carousel_group": "ADRENALINE_SENSATIONS",
  "age_range": "10-15",
  "keywords_en": [
    "keyword1 youth",
    "keyword2 teens",
    "keyword3 kids"
  ],
  "keywords_fr": ["mot1 jeunes", "mot2 ados"],
  "image_style": "style description",
  "orientation": "landscape",
  "age_visible": "children"
}
```

2. Le workflow collectera automatiquement les images au prochain run

### Ajuster le nombre d'images

```javascript
// Nœud: Préparer Recherches
// Modifier :
const keywordsToUse = item.keywords_en.slice(0, 6); // Au lieu de 4
```

### Filtrer par photographe

```javascript
// Nœud: Normaliser Unsplash/Pexels
// Ajouter filtre :
if (photo.user.username === 'banned_photographer') continue;
```

---

## 🐛 Dépannage

### Erreur : "API Rate Limit"

**Unsplash** : 50 requêtes/heure (demo), 5000/heure (production)
**Pexels** : 200 requêtes/heure

**Solutions** :
1. Réduire `images_per_keyword` de 3 à 2
2. Espacer les exécutions (hebdomadaire au lieu de quotidien)
3. Upgrader plan API

### Erreur : "Supabase Storage Upload Failed"

```javascript
// Vérifier permissions bucket
SELECT * FROM storage.buckets WHERE id = 'flooow-sejours-images';

// Vérifier policies
SELECT * FROM storage.policies WHERE bucket_id = 'flooow-sejours-images';
```

### Images de mauvaise qualité

```sql
-- Identifier images problématiques
SELECT slug, source_id, width, height, quality_score
FROM sejours_images
WHERE width < 1200 OR height < 800 OR quality_score < 4
ORDER BY quality_score ASC;

-- Marquer pour re-collecte
UPDATE sejours_images
SET status = 'rejected'
WHERE quality_score < 4;
```

### Duplicatas non détectés

```sql
-- Trouver duplicatas
SELECT source, source_id, COUNT(*)
FROM sejours_images
GROUP BY source, source_id
HAVING COUNT(*) > 1;

-- Nettoyer (garder le plus récent)
DELETE FROM sejours_images
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY source, source_id ORDER BY imported_at DESC
    ) as rn
    FROM sejours_images
  ) t WHERE t.rn > 1
);
```

---

## 📈 Métriques de Succès

### KPIs à Suivre

1. **Couverture** : % séjours avec ≥ 5 images
   - Cible : 100%

2. **Diversité** : nombre photographes uniques
   - Cible : > 50

3. **Qualité moyenne** : AVG(quality_score)
   - Cible : ≥ 7/10

4. **Performance** : temps exécution workflow
   - Cible : < 10 minutes

5. **Coût** : nb appels API / mois
   - Unsplash : < 4000 (plan gratuit : 5000)
   - Pexels : < 150 (plan gratuit : 200)

### Dashboard Recommandé

```sql
-- Vue synthétique pour dashboard admin
CREATE OR REPLACE VIEW v_images_dashboard AS
SELECT
  (SELECT COUNT(DISTINCT slug) FROM sejours_images WHERE status = 'active') as sejours_covered,
  (SELECT COUNT(*) FROM gd_stays WHERE published = true) as sejours_total,
  (SELECT COUNT(*) FROM sejours_images WHERE status = 'active') as images_active,
  (SELECT COUNT(DISTINCT photographer_name) FROM sejours_images) as photographers_unique,
  (SELECT AVG(quality_score) FROM sejours_images WHERE status = 'active') as avg_quality,
  (SELECT COUNT(*) FROM sejours_images WHERE imported_at > NOW() - INTERVAL '7 days') as imported_week,
  (SELECT COUNT(*) FROM sejours_images WHERE manual_selection = true) as curated_count;
```

---

## 🎓 Bonnes Pratiques

### 1. Mots-clés Optimaux

✅ **BON** :
- `"motocross teens training"`
- `"youth surfing lessons ocean"`
- `"children camping forest adventure"`

❌ **MAUVAIS** :
- `"moto"` (trop vague)
- `"kids"` (trop générique)
- `"awesome extreme sport"` (pas spécifique)

### 2. Validation Qualité

```javascript
// Critères à checker manuellement (échantillon)
const qualityChecklist = {
  age_appropriate: true,  // Visages d'âge cohérent
  safe_context: true,     // Pas de danger apparent
  good_lighting: true,    // Bien exposé
  focus_sharp: true,      // Net
  composition: true,      // Cadrage pro
  authentic: true         // Pas trop posé/stock
};
```

### 3. Crédits Photographes

**Obligatoire selon licences** :
- Unsplash : attribution appréciée mais non obligatoire
- Pexels : attribution non obligatoire

**Recommandé** :
- Toujours afficher nom + lien photographe
- Format : `"Photo par [Nom](url) sur [Plateforme](url)"`

---

## 🔒 Sécurité & Conformité

### RGPD
- ✅ Pas de données personnelles collectées
- ✅ Images licences libres (Unsplash/Pexels License)
- ✅ Pas de tracking utilisateur

### Licences Images

**Unsplash License** :
- ✅ Usage commercial autorisé
- ✅ Modification autorisée
- ❌ Pas de revente des images seules
- ❌ Pas de copie du service Unsplash

**Pexels License** :
- ✅ Usage commercial autorisé
- ✅ Modification autorisée
- ❌ Pas de revente des images seules
- ❌ Ne pas suggérer endorsement du photographe

### Rate Limiting

```javascript
// Recommandé : ajouter délais entre requêtes
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Entre chaque recherche API
await delay(500); // 500ms
```

---

## 📞 Support

### Contacts API

- **Unsplash** : help@unsplash.com
- **Pexels** : help@pexels.com
- **Supabase** : https://supabase.com/support

### Ressources

- [Unsplash API Docs](https://unsplash.com/documentation)
- [Pexels API Docs](https://www.pexels.com/api/documentation/)
- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [n8n Docs](https://docs.n8n.io/)

---

## 📝 Changelog

### v2.0 - 2026-02-07
- ✨ Mapping précis 24 séjours Flooow
- ✨ Mots-clés alignés âge/activité/format
- ✨ Filtres qualité renforcés
- ✨ Statistiques détaillées par séjour
- ✨ Vues SQL utilitaires
- ✨ Documentation complète

### v1.0 - 2026-02-05
- 🎉 Version initiale
- Collecte Unsplash + Pexels
- Upload Supabase Storage
- Stockage métadonnées BDD

---

**Auteur** : Équipe Flooow InKlusif
**Dernière mise à jour** : 7 février 2026
**Version** : 2.0
