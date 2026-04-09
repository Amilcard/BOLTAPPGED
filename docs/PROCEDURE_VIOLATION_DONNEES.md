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
