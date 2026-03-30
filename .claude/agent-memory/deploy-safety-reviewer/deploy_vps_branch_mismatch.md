---
name: deploy-vps.sh vérifie branche "work" — projet sur "main"
description: Incohérence entre le script de déploiement VPS (attend branche "work") et la convention projet (main uniquement)
type: project
---

`deploy-vps.sh` ligne 13 : vérifie que la branche courante est `work`, sinon exit 1.
`CLAUDE.md` et la convention projet : branche unique `main`, Vercel déploie depuis `main`.

**Risque :** Si le VPS est utilisé, le script échouera immédiatement sur `main`. Le script est en cohérence avec une ancienne organisation à deux branches.

**Why:** Vestige d'une période où le projet avait une branche `work` séparée.
**How to apply:** Signaler dans tout audit VPS. Si déploiement VPS requis, le script doit être mis à jour pour vérifier `main`.
