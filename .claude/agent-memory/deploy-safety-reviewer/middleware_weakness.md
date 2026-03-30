---
name: Middleware Next.js — vérification JWT formelle uniquement
description: middleware.ts vérifie que le cookie a 3 segments (format JWT) mais ne valide pas la signature
type: project
---

Dans `middleware.ts` : seule vérification = `split('.').length === 3`. N'importe quel token forgé en 3 parties passe le middleware.

La vraie vérification de signature est faite par `verifyAuth()` dans `lib/auth-middleware.ts` (jsonwebtoken) sur chaque route API admin.

**Conséquence :** Un attaquant peut accéder aux pages admin côté rendu (HTML) avec un faux cookie, mais toutes les routes API admin re-vérifient la signature → données protégées. Le risque est limité à l'affichage des pages admin shell.

**Why:** Limitation connue de Next.js middleware Edge Runtime (pas de crypto native pour jwt.verify).
**How to apply:** Signaler comme "majeur" dans les audits mais non bloquant si toutes les routes API vérifient correctement.
