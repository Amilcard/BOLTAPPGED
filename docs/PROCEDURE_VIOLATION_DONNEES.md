# Procédure de notification de violation de données — GED App

> Document complet : `Documents_Legaux/06_Protocole_Notification_Violation_Donnees.md`

## Résumé opérationnel

### Délai CNIL : 72h après constatation (Art. 33 RGPD)

### Circuit d'alerte
1. **T0** — Détection (Sentry, Supabase audit logs, signalement utilisateur)
2. **T0 + 1h** — Évaluation risque (DPO + responsable technique)
3. **T0 + 4h** — Décision notification CNIL (si risque pour les droits des personnes)
4. **T0 + 72h max** — Notification CNIL via https://notifications.cnil.fr/
5. Si risque élevé — Communication aux personnes concernées (Art. 34)

### Contact DPO
- Email : dpo@groupeetdecouverte.fr
- Responsable traitement : Laïd HAMOUDI, Président

### Scénarios GED spécifiques
- Fuite données enfant ASE → notification immédiate + information structure PE
- Accès non autorisé dossier enfant → vérifier audit logs + révoquer tokens
- Compromission clé Supabase → rotation immédiate + audit accès

### Registre des violations
Maintenu dans `Documents_Legaux/` — chaque incident documenté avec :
date, nature, données concernées, nombre de personnes, mesures prises, notification CNIL (oui/non)

---

## Backup & restauration — Supabase

### État actuel (avril 2026)
- **Plan** : Pro
- **Backups quotidiens** : actifs, rétention ~7 jours
- **PITR** : non activé (add-on Pro, recommandé pour données ASE)
- **Perte max en cas d'incident** : 24h (dernier backup quotidien)

### Procédure de restauration
1. Ouvrir : `https://supabase.com/dashboard/project/[ref]/settings/database` → Backups
2. Sélectionner le backup le plus récent avant l'incident
3. Cliquer "Restore" → confirmer
4. **Attention** : la restauration écrase la base actuelle. Si des données ont été créées entre le backup et l'incident, elles seront perdues.
5. Après restore : vérifier RLS actif, tester routes critiques, vérifier cron RGPD

### Si PITR activé (recommandé)
- Restauration à la seconde près
- Dashboard → Backups → PITR → choisir date/heure exacte
- Perte max = 0 (vs 24h sans PITR)

### Quand activer PITR
- Dès que le nombre d'inscriptions dépasse 50/mois
- Ou dès qu'une structure ASE utilise l'app en production
- Coût : ~$100/mois (add-on Pro Supabase)

### Test dry-run (à faire 1x/trimestre)
1. Créer un projet Supabase temporaire
2. Restaurer un backup dessus
3. Vérifier que les données sont intègres
4. Supprimer le projet temporaire
