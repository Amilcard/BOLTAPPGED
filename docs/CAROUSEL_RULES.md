# Règles de Cohérence des Carrousels - GED

## 🔒 ORDRE VERROUILLÉ

L'ordre des carrousels sur la Home **NE DOIT JAMAIS** être modifié sans validation UX.

### Configuration Actuelle (PROTECTION ABSOLUE)
**Fichier source** : `components/home-carousels.tsx` (ligne 16)

```typescript
const UNIVERSE_CONFIG = [
  { key: 'MA_PREMIERE_COLO', title: 'Ma Première Colo', subtitle: 'Pour les 3-9 ans' },     // Position 1
  { key: 'AVENTURE_DECOUVERTE', title: 'Aventure & Découverte', subtitle: 'Pour les 8-14 ans' }, // Position 2
  { key: 'ADRENALINE_SENSATIONS', title: 'Sensations & Adrénaline', subtitle: 'Pour les 12-17 ans' } // Position 3
]
```

> [!CAUTION]
> **Interdiction formelle** de modifier cet ordre. Progression logique par âge croissant (3-9 → 8-14 → 12-17 ans).

---

## ✅ MODIFICATIONS AUTORISÉES (Saisonnalité)

### Titres Saisonniers
Les **titres** des carrousels peuvent être adaptés selon les saisons **UNIQUEMENT** si :
1. La cohérence **âge** est respectée
2. La cohérence **thématique** est respectée
3. L'**ordre** reste identique

**Exemples autorisés** :

| Saison | Position 1 (3-9 ans) | Position 2 (8-14 ans) | Position 3 (12-17 ans) |
|--------|---------------------|----------------------|----------------------|
| **Hiver** | Ma Première Neige | Aventure Montagne | Sensations Glisse |
| **Été** | Ma Première Colo | Aventure & Découverte | Sensations & Adrénaline |
| **Printemps** | Ma Première Aventure | Découverte Nature | Adrénaline Outdoor |

### Sous-titres (tranches d'âge)
Les **sous-titres** sont **INTOUCHABLES** :
- Position 1 : **"Pour les 3-9 ans"** (FIXE)
- Position 2 : **"Pour les 8-14 ans"** (FIXE)
- Position 3 : **"Pour les 12-17 ans"** (FIXE)

---

## 🚫 COHÉRENCE THÉMATIQUE (Règles Strictes)

### Position 1 : MA_PREMIERE_COLO (3-9 ans)
**Thématique** : Première expérience, découverte douce, encadrement renforcé

**Slugs autorisés** (fallback) :
- ✅ `les-ptits-puisotins-1`, `croc-marmotte`, `aqua-gliss`, `natation-et-sensation`, `les-apprentis-montagnards`

**Slugs INTERDITS** (trop intensifs) :
- ❌ `moto-moto`, `dh-experience-11-13-ans`, `yamakasi` → trop âgés/dangereux

### Position 2 : AVENTURE_DECOUVERTE (8-14 ans)
**Thématique** : Autonomie progressive, activités variées, découverte environnement

**Slugs autorisés** :
- ✅ `les-robinson-des-glieres`, `yamakasi`, `e-sport-and-sport`, `explore-mountain`, `mountain-and-chill`

**Slugs INTERDITS** :
- ❌ `les-ptits-puisotins-1` → trop jeune
- ❌ Séjours avec moto/engins motorisés lourds → position 3

### Position 3 : ADRENALINE_SENSATIONS (12-17 ans)
**Thématique** : Adrénaline, sensations fortes, autonomie maximale

**Slugs autorisés** :
- ✅ `moto-moto`, `dh-experience-11-13-ans`, `annecy-element`, `surf-sur-le-bassin`

**Slugs INTERDITS** :
- ❌ `croc-marmotte`, `les-ptits-puisotins-1` → trop jeunes

---

## 🔍 VÉRIFICATION BEFORE DEPLOY

### Checklist Ordre & Cohérence
Avant tout déploiement touchant `home-carousels.tsx`, vérifier :

- [ ] **Ordre** : Ma Première Colo (pos 1) → Aventure & Découverte (pos 2) → Sensations & Adrénaline (pos 3)
- [ ] **Âges** : 3-9 ans → 8-14 ans → 12-17 ans (progression stricte)
- [ ] **Thématique Position 1** : Aucun slug "adrénaline" (moto, DH, etc.)
- [ ] **Thématique Position 3** : Aucun slug "première colo" (Ptits Puisotins, etc.)
- [ ] **Sous-titres** : Inchangés

### Commande de Test Browser
```javascript
// Console DevTools : vérifier ordre H2 carrousels
[...document.querySelectorAll('h2')].map(h => h.textContent)
// Résultat attendu : ["Ma Première Colo", "Aventure & Découverte", "Sensations & Adrénaline"]
```

---

## 📋 PROCESS DE MODIFICATION (Si vraiment nécessaire)

Si une modification d'ordre est **absolument** nécessaire (revalidation marketing) :

1. **Créer un ticket** avec justification UX complète
2. **Valider** avec Product Owner + UX Designer
3. **Tester** impact sur taux de conversion (A/B test)
4. **Documenter** la nouvelle logique dans ce fichier
5. **Mettre à jour** les tests de non-régression

> [!WARNING]
> Toute modification non documentée sera considérée comme une **régression critique**.
