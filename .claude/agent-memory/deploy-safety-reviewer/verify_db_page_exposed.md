---
name: Page /verify-db absente de l'app mais référencée dans les tests E2E
description: verify-db.spec.ts cible /verify-db qui n'existe pas dans app/ — tests E2E échoueront
type: project
---

`tests/e2e/verify-db.spec.ts` navigue vers `/verify-db` et attend un tableau de données en base.
Aucun répertoire `app/verify-db/` n'existe dans la structure de l'application.

**Conséquence :** Le test E2E échoue avec 404. De plus, si la page existait, elle exposerait des données internes (noms de séjours, statuts DB) sans authentification.

**Why:** Page de diagnostic créée pendant le développement, non portée en app/ ou supprimée.
**How to apply:** Signaler comme test fragile/cassé. Si la page doit exister, vérifier qu'elle est protégée par auth.
