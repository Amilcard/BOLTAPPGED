# Règles de Nommage des Séjours - GED

## ⚠️ PRIORITÉ ABSOLUE

### Ordre d'Affichage des Titres
**TOUJOURS** respecter cette hiérarchie :

1. **`marketingTitle`** → Titres premium branding (ex: "MX RIDER ACADEMY")
2. **`titleKids`** → Fallback CityCrunch Kids si `marketingTitle` absent
3. **`title`** → Legacy technique (NE JAMAIS afficher si `marketingTitle` existe)

### Code de Référence
```typescript
// ✅ CORRECT (StayCard.tsx ligne 16)
const displayTitle = stay?.marketingTitle || stay?.titleKids || stay?.title;
```

---

## 🚫 LISTE DES ANCIENS TITRES (INTERDITS EN UI)

Si `marketingTitle` existe, les titres suivants **NE DOIVENT JAMAIS** apparaître en UI :

| Ancien Titre (Legacy) | Nouveau Titre (Premium) | Slug |
|----------------------|------------------------|------|
| Moto Moto | **MX RIDER ACADEMY** | moto-moto |
| Aqua' Fun | **AZUR DIVE & JET** | aqua-fun |
| Annecy Élément | **ALPINE SKY CAMP** | annecy-element |
| Destination Soleil | **RIVIERA SPEED CLUB** | destination-soleil |
| DH Expérience | **GRAVITY BIKE PARK** | dh-experience-11-13-ans |
| Sperienza in Corsica | **CORSICA WILD TRIP** | sperienza-in-corsica-1 |
| Surf sur le Bassin | **WEST COAST SURF CAMP** | surf-sur-le-bassin |
| E-sport and Sport | **GAMING HOUSE 1850** | e-sport-and-sport |
| Les Robinson des Glières | **SURVIVOR CAMP 74** | les-robinson-des-glieres |
| Survie Beaufortain | **INTO THE WILD** | survie-dans-le-beaufortain |
| Breizh Equit' | **BRETAGNE OCEAN RIDE** | breizh-equit-kids-8-11-ans |
| Yamakasi Parkour | **URBAN MOVE ACADEMY** | yamakasi |
| Destination Bassin | **DUNE & OCEAN KIDS** | destination-bassin-darcachon-1 |
| Glièr'Aventures | **DUAL CAMP : LAC & MONTAGNE** | glieraventures |
| Nature Picture | **WILDLIFE REPORTER** | nature-picture |
| Mountain & Chill | **ADRENALINE & CHILL** | mountain-and-chill |
| Explore Mountain | **ALPINE TREK JUNIOR** | explore-mountain |
| L'Aventure Verticale | **ROCKS & PADDLE** | laventure-verticale |
| Les P'tits Puisotins | **MY LITTLE FOREST** | les-ptits-puisotins-1 |
| Croc' Marmotte | **ALPOO KIDS** | croc-marmotte |
| Aqua'Gliss | **BABY RIDERS** | aqua-gliss |
| Natation et Sensation | **SWIM ACADEMY** | natation-et-sensation |
| Les Apprentis Montagnards | **HUSKY ADVENTURE** | les-apprentis-montagnards |

---

## ✅ VÉRIFICATION BEFORE DEPLOY

Avant tout déploiement, **TOUJOURS** vérifier :

1. **Aucun ancien titre visible** sur Home (Kids + Pro)
2. **Cohérence Home/Detail** : H1 = titre card
3. **Console browser** : chercher "Moto Moto", "Annecy Element", etc. → doit retourner 0 résultat

### Commande de Vérification Rapide
```bash
# Dans le navigateur (Console DevTools)
document.body.innerText.match(/Moto Moto|Annecy Element|Croc' Marmotte/g)
// Résultat attendu : null (aucun match)
```

---

## 🔒 PROTECTION AUTOMATIQUE

### Fichier Clé : `lib/supabaseGed.ts`
Le mapping snake_case → camelCase **DOIT** toujours inclure `marketing_title` :

```typescript
// ✅ LIGNE 44 - Ne jamais retirer marketing_title de ce SELECT
.select('*, marketing_title, title_kids, title_pro, ...')

// ✅ LIGNE 58 - Ne jamais retirer ce mapping
marketingTitle: stay.marketing_title,
```

### Test de Non-Régression (Futur)
Si un test automatisé est ajouté, il doit vérifier :
- [ ] `marketingTitle` existe dans le type `Stay`
- [ ] `StayCard` utilise `marketingTitle` en priorité
- [ ] Aucun ancien titre rendu si `marketingTitle` présent

---

## 📚 VOIR AUSSI

**Protection Carrousels** : [`docs/CAROUSEL_RULES.md`](file:///Users/laidhamoudi/Dev/GED_APP/docs/CAROUSEL_RULES.md)
- Ordre verrouillé des carrousels (Ma Première Colo → Aventure → Sensations)
- Cohérence âge et thématique
- Modifications saisonnières autorisées

