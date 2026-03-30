---
name: Fuite de credentials dans .env
description: Le fichier .env contient des credentials de production réels non chiffrés, commité dans le repo
type: project
---

Le fichier `.env` (racine du projet) contient des valeurs réelles de production :
- `DATABASE_URL` et `DIRECT_URL` : mot de passe Supabase en clair (`0tekB1291SPsbfEh`)
- `NEXTAUTH_SECRET` : secret JWT en clair (64 hex chars)
- `SUPABASE_SERVICE_ROLE_KEY` : JWT service_role complet
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` : JWT anon complet
- `STRIPE_SECRET_KEY` : clé Stripe test `sk_test_...` (valeur complète)
- `STRIPE_WEBHOOK_SECRET` : `whsec_...` complet
- `EMAIL_SERVICE_API_KEY` : clé Resend `re_...` complète

Le `.gitignore` exclut `.env` — ce fichier n'est donc pas commité sur GitHub.
Mais il est présent sur le disque local du développeur et pourrait être accidentellement inclus.

**Why:** Risque de leak total si le .env est accidentellement stagé (git add .) ou si le repo est cloné sur une machine compromise.

**How to apply:** Vérifier systématiquement avant chaque commit que `.env` n'est pas stagé. Ne jamais utiliser `git add .` sans vérifier le diff.
