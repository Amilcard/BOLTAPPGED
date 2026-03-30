---
name: GED_APP Security Risks Identified (Audit LOT C, 2026-03-25)
description: Risques de sécurité identifiés lors de l'audit LOT C pré-déploiement
type: project
---

Audit réalisé le 2026-03-25. Risques identifiés classés par criticité.

**Why:** Audit pré-déploiement sur données de mineurs — RGPD, sécurité, RLS.

**How to apply:** Vérifier la résolution de ces points avant le prochain déploiement.

## CRITIQUES

1. **Credentials de production dans .env versionné** — SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL (avec mot de passe), STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, EMAIL_SERVICE_API_KEY présents en clair dans .env. Le .gitignore ne couvre que .env.local mais pas .env lui-même.

2. **NEXTAUTH_SECRET non remplacé** — .env contient "your-secret-key-here-change-in-production". Si ce fichier est utilisé en prod, tous les JWTs admin sont signés avec un secret trivial (force brute triviale).

3. **Cookie gd_session httpOnly: false** — app/api/auth/login/route.ts ligne 55. Le JWT admin est accessible depuis JavaScript → XSS = vol de session admin.

4. **RLS des tables critiques non confirmé** — gd_inscriptions, gd_dossier_enfant (fiches médicales), gd_wishes, gd_stays, gd_session_prices, gd_stay_sessions n'ont pas d'ENABLE ROW LEVEL SECURITY dans les migrations fournies. Si RLS est désactivé par défaut, accès PostgREST anon à toutes ces données.

5. **Policy gd_souhaits SELECT anon = USING(true)** — migration 020 ligne 188-190. N'importe qui peut lire tous les souhaits via PostgREST direct (bypasse le filtrage API). Expose kid_prenom, educateur_email, motivation.

## MAJEURS

6. **Middleware admin ne vérifie pas la signature JWT** — middleware.ts vérifie seulement le format 3-segments, pas la signature HMAC. Un token forgé (format valide, signature fausse) passe le middleware. La vraie vérification est dans verifyAuth() côté API — mais le middleware contrôle l'accès aux pages.

7. **gd_check_session_capacity SECURITY DEFINER sans search_path** — migration 022. La fonction s'exécute avec les droits du owner postgres. supabase_functions_search_path_fix.sql ne couvre pas cette fonction.

8. **Absence de rate limiting sur /api/inscriptions et /api/auth/login** — pas de protection brute force ou flood d'inscriptions.

9. **Bucket dossier-documents — policies non auditables** — documents médicaux d'enfants. Les bucket policies Supabase Storage ne sont pas dans les migrations fournies.

10. **Tokens UUID sans expiration** — suivi_token, educateur_token, kid_session_token n'ont pas de TTL. Un token envoyé par email reste valide indéfiniment.

## MINEURS / RGPD

11. **Logs serveur avec données personnelles limitées** — les console.error de PRICE_MISMATCH loguent slug/date/city mais pas de PII direct. Acceptable.

12. **Absence de mention légale / consentement documentée** — le champ consent dans le schema d'inscription est vérifié côté serveur (z.boolean().refine(v => v === true)), ce qui est bien, mais aucune page de politique de confidentialité n'est référencée dans le code.

13. **Droit à l'effacement** — DELETE /api/admin/inscriptions/[id] existe mais réservé ADMIN. Pas de mécanisme self-service.

14. **Données bancaires en NEXT_PUBLIC_** — NEXT_PUBLIC_IBAN, NEXT_PUBLIC_BIC exposés côté client. Acceptable si c'est intentionnel (affichage instructions virement), mais à documenter.
