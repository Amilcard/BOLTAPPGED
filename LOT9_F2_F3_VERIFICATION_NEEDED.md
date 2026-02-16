# F2 & F3 - Vérifications à faire (FICHIER EN DEADLOCK)

**Fichiers concernés** :
- `app/sejour/[id]/stay-detail.tsx` (affichage prix)
- `components/booking-modal.tsx` (champ date naissance)

**Statut** : ⚠️ Fichiers en deadlock - vérifications à faire manuellement

---

## F2 : Prix "à partir de" absent en mode Pro

### Problème rapporté
> "F2 jai vérifier les tarifs séjours a partir de .. n apparaissent pas dans la session pro"

Le prix "À partir de X€" ne s'affiche PAS en mode Pro alors qu'il devrait.

### Hypothèses
1. **Condition isPro masque le prix** : Le code vérifie `isKids` et n'affiche le prix que pour Kids
2. **Variable minPrice manquante** : La variable `minPrice` n'est pas calculée ou est null en mode Pro
3. **Condition hasSelection incorrecte** : Le prix n'apparaît que si une session est sélectionnée

### Code à vérifier (stay-detail.tsx)

Chercher autour de ces patterns :
```typescript
// Pattern 1 : Condition isKids masque le prix Pro
{!isKids && (
  <div>À partir de {minPrice}€</div>
)}

// Pattern 2 : Variable minPrice
const minPrice = ...;  // Vérifier comment elle est calculée

// Pattern 3 : priceBreakdown.minPrice
const { minPrice, total, hasSelection } = priceBreakdown;
```

### Actions à faire
1. Ouvrir `app/sejour/[id]/stay-detail.tsx`
2. Chercher "À partir de" ou "minPrice"
3. Vérifier les conditions d'affichage :
   - Le prix doit s'afficher en mode **Pro** (pas seulement Kids)
   - `minPrice` doit être calculé depuis `enrichment.sessions` (prix mini sans transport)
4. Si condition `{!isKids &&` masque le prix Pro, la retirer ou inverser
5. Vérifier que `priceBreakdown.minPrice` est bien passé et non-null

### Code attendu
```typescript
// CORRECT : Afficher en mode Pro
{isPro && minPrice && (
  <div className="text-sm text-gray-600">
    À partir de <span className="font-semibold">{minPrice} €</span>
  </div>
)}

// OU bien afficher toujours (Pro et Kids)
{minPrice && (
  <div className="text-sm text-gray-600">
    À partir de <span className="font-semibold">{minPrice} €</span>
  </div>
)}
```

---

## F3 : Date de naissance complète requise

### Problème rapporté
> "F3 jai vérifier il faut absolument une date de naisse complete pour eviter erreur inscription liées aux ages"

Actuellement, le formulaire demande seulement l'**année de naissance** (`childBirthYear`).
Il faut demander la **date complète** (`childBirthDate` : JJ/MM/AAAA) pour éviter les erreurs d'âge.

### Code à vérifier (booking-modal.tsx)

#### Champ actuel (année seulement)
```typescript
// INCORRECT : Année seulement
<select name="childBirthYear" required>
  {birthYears.map(year => (
    <option key={year} value={year}>{year}</option>
  ))}
</select>
```

#### Champ attendu (date complète)
```typescript
// CORRECT : Date complète JJ/MM/AAAA
<input
  type="date"
  name="childBirthDate"
  required
  placeholder="JJ/MM/AAAA"
  max={new Date().toISOString().split('T')[0]}
  min={new Date(currentYear - 17, 0, 1).toISOString().split('T')[0]}
/>
```

### Actions à faire
1. Ouvrir `components/booking-modal.tsx`
2. Chercher `childBirthYear` dans le formulaire (Step 2 probablement)
3. Remplacer le select d'année par un input type="date"
4. Mettre à jour la validation :
   ```typescript
   // Avant
   const isStep2Valid = step2.childFirstName && step2.childBirthYear && step2.consent;

   // Après
   const isStep2Valid = step2.childFirstName && step2.childBirthDate && step2.consent;
   ```
5. Mettre à jour l'interface Step2Data :
   ```typescript
   interface Step2Data {
     childFirstName: string;
     childBirthDate: string;  // ← au lieu de childBirthYear: number
     consent: boolean;
   }
   ```
6. Mettre à jour handleSubmit pour envoyer `childBirthDate` au lieu de `childBirthYear`

### Validation côté client
Ajouter une validation pour s'assurer que l'âge est entre 6 et 17 ans :
```typescript
const validateAge = (birthDate: string): boolean => {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 6 && age <= 17;
};
```

---

## ⚠️ IMPORTANT - Cohérence BDD

### F3 : Schema Supabase
Vérifier que la table `gd_inscriptions` (ou `gd_bookings`) a bien la colonne :
```sql
ALTER TABLE gd_inscriptions
ADD COLUMN IF NOT EXISTS child_birth_date DATE;
```

Si la colonne n'existe pas, la créer avant de déployer le changement front.

### Type TypeScript
Mettre à jour `lib/types.ts` :
```typescript
export interface Booking {
  // ...
  childBirthDate: string;  // Format ISO "YYYY-MM-DD"
  // childBirthYear?: number;  // ← Supprimer ou marquer deprecated
}
```

---

## Récapitulatif

| Issue | Fichier | Ligne approx | Action | Priorité |
|-------|---------|--------------|--------|----------|
| **F2** | `stay-detail.tsx` | ~400-550 | Afficher "À partir de" en mode Pro | 🟡 Moyenne |
| **F3** | `booking-modal.tsx` | ~180-250 | Champ date complète (pas année) | 🟠 Haute |
| **F3** | `lib/types.ts` | ~30-50 | Type Booking avec childBirthDate | 🟠 Haute |
| **F3** | Schema SQL | - | Colonne child_birth_date | 🟠 Haute |

---

**Note** : Les fichiers `stay-detail.tsx` et `booking-modal.tsx` sont actuellement en deadlock système et ne peuvent pas être modifiés automatiquement. Ces modifications devront être faites manuellement en ouvrant les fichiers dans un éditeur.

---

*Document généré le 3 février 2026 - Lot 9 : Vérifications F2 et F3*
