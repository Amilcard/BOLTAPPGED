# Politique de rétention des données — GED App

## Données contenant des adresses IP

| Table | Données stockées | Durée rétention | Purge | Mécanisme |
|---|---|---|---|---|
| `gd_login_attempts` | IP, compteur tentatives, window_start | **24 heures** | Horaire (via cron) | `purge_old_login_attempts()` |
| `gd_audit_log` | IP, action, acteur, ressource, métadonnées | **3 ans** (reco CNIL) | Mensuelle (1er du mois) | `purge_old_audit_logs()` |

## Données médicales / sensibles (Art. 9 RGPD)

| Table | Données stockées | Durée rétention | Purge | Mécanisme |
|---|---|---|---|---|
| `gd_dossier_enfant.fiche_sanitaire` | Données santé enfant | **3 mois après fin de séjour** | Mensuelle | `gd_purge_expired_medical_data()` |
| `gd_dossier_enfant.fiche_liaison_jeune` | Infos liaison éducative | **3 mois après fin de séjour** | Mensuelle | `gd_purge_expired_medical_data()` |

## Données administratives

| Table | Données stockées | Durée rétention | Purge |
|---|---|---|---|
| `gd_inscriptions` | Données inscription + paiement | **3 ans** après dernier accès | Manuelle |
| `gd_dossier_enfant` (hors médical) | Bulletin, documents joints | **3 ans** | Manuelle |

## Mécanisme de purge

### Cron Vercel (actif)
- Route : `GET /api/cron/rgpd-purge`
- Schedule : `0 3 1 * *` (1er du mois à 3h)
- Protection : `CRON_SECRET` Bearer token
- Appelle 4 fonctions RPC Supabase :
  1. `gd_purge_expired_audit_logs` — audit logs > 12 mois
  2. `gd_purge_expired_medical_data` — données médicales > 3 mois post-séjour
  3. `purge_old_login_attempts` — IPs rate limiting > 24h
  4. `purge_old_audit_logs` — audit logs > 3 ans

### Cron pg_cron (optionnel, si activé)
- `purge-login-attempts` : `0 * * * *` (horaire) — plus fréquent que le cron Vercel mensuel
- `purge-audit-logs` : `0 4 1 * *` (mensuel)
- Nécessite extension `pg_cron` activée dans Supabase Dashboard → Database → Extensions

## Contact DPO
- Email : dpo@groupeetdecouverte.fr
- Procédure incident : `docs/PROCEDURE_VIOLATION_DONNEES.md`
