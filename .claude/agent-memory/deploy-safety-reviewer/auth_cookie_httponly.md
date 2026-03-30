---
name: Cookie gd_session non httpOnly — risque XSS
description: Le cookie d'auth admin est défini avec httpOnly:false pour permettre la lecture JS côté client (AdminLayout)
type: project
---

Dans `app/api/auth/login/route.ts` ligne 55 : `httpOnly: false`.

Le cookie `gd_session` doit être lisible par JavaScript côté client car l'AdminLayout le lit via `document.cookie` ou équivalent. Ce choix est intentionnel (double mécanisme cookie + localStorage).

**Risque :** Un script XSS peut voler ce cookie et obtenir des droits admin.

**Why:** Architecture choisie pour synchroniser middleware serveur et layout client sans SSR d'un token.
**How to apply:** Toujours signaler ce risque dans les audits sécurité. Vérifier si une migration vers httpOnly + API refresh est envisagée.
