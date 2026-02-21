# 🔧 FIX DÉFINITIF - Régressions visuelles npm run dev

## ✅ CHANGEMENT APPLIQUÉ

**Fichier** : `next.config.js`

```javascript
// ❌ AVANT (causait bugs en dev)
distDir: process.env.NEXT_DIST_DIR || '.next',
output: process.env.NEXT_OUTPUT_MODE || 'standalone',

// ✅ APRÈS (mode standalone uniquement en prod)
output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
// distDir supprimé (Next.js utilise .next par défaut)
```

---

## 🎯 CAUSE RACINE IDENTIFIÉE

**Problème** : `output: 'standalone'` active un mode d'optimisation Docker **incompatible avec le dev local**.

**Effets** :
- CSS Tailwind non injecté dans le DOM
- Hot-reload incomplet
- Fonts non chargées
- Cache corrompu

---

## 📋 WORKFLOW OPTIMAL (après fix)

### 1️⃣ **Premier démarrage**
```bash
npm run dev
```
- Attendre "compiled successfully"
- Ouvrir `localhost:3000`
- **Hard refresh UNE FOIS** : `Ctrl + Shift + R` (ou `Cmd + Shift + R` Mac)

### 2️⃣ **Si styles toujours cassés**
```bash
# Arrêter serveur (Ctrl+C)
rm -rf .next
npm run dev
# Puis hard refresh navigateur
```

### 3️⃣ **En cas de cache bloqué** (fichiers .next non supprimables)
```bash
# Arrêter serveur (Ctrl+C)
# Fermer VSCode complètement
# Relancer VSCode
npm run dev
```

---

## 🔍 VÉRIFICATION POST-FIX

### Inspect Element
- Classes Tailwind appliquées : `text-primary` → `#2a383f`
- Font : `Rubik` (pas système)

### Network Tab
- CSS chargé : `/_next/static/css/*.css` (200 OK)
- Aucune erreur 404

### Console
- Aucune erreur hydratation
- Aucun warning Tailwind

---

## 🚀 RÉSULTAT ATTENDU

✅ CSS stable à chaque reload
✅ Fonts chargées
✅ Header aligné
✅ Containers respectés
✅ Hot-reload fonctionnel

**Fini les `npm run dev` chaotiques** 🎉
