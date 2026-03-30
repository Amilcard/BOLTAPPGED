---
name: GED_APP project stack and deployment target
description: Stack technique, infra de déploiement, URL prod, deux cibles distinctes (Vercel + VPS Docker)
type: project
---

Next.js 14 (output: standalone), Supabase, Stripe, Resend (email), Tailwind CSS, TypeScript strict.

Deux cibles de déploiement coexistent :
- Vercel : déploiement auto depuis branche `main` → app.groupeetdecouverte.fr
- VPS Hostinger : Docker + Traefik via deploy-vps.sh (branche `work` dans le script, mais CLAUDE.md dit d'utiliser `main` uniquement)

Auth admin : double mécanisme — cookie `gd_session` (middleware Next.js côté serveur) + localStorage `gd_auth` (AdminLayout côté client). JWT signé avec NEXTAUTH_SECRET.

Prisma est présent (Dockerfile fait `npx prisma generate`) mais l'app principale utilise Supabase JS directement. Prisma semble résiduel.

**Why:** Contexte projet GED = Groupe & Découverte, gestion de séjours pour enfants avec parcours Kids/Pro/Admin.
**How to apply:** Vérifier les deux cibles lors de chaque revue de déploiement. La cible active est Vercel.
