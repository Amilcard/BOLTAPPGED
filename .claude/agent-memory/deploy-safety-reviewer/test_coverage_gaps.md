---
name: Lacunes de couverture de tests identifiées lors de l'audit mars 2026
description: Cas critiques non couverts par les tests existants (auth, Stripe CB, /verify-db, unit tests)
type: project
---

Tests manquants critiques identifiés lors de l'audit pré-déploiement du 2026-03-25 :

1. **Auth login** : aucun test E2E du flux /login → /admin complet
2. **Paiement Stripe CB** : aucun test du parcours carte bancaire (seul virement est testé)
3. **Webhook Stripe** : aucun test d'intégration de /api/webhooks/stripe
4. **Page /verify-db** : tests E2E qui ciblent une page inexistante dans l'app
5. **Unit tests** : zéro test unitaire dans tests/unit/ (répertoire inexistant)
6. **Rate limiting** : aucun test de protection contre les abus sur /api/inscriptions et /api/auth/login

**Why:** Développement itératif avec focus sur les features métier, tests ajoutés a posteriori.
**How to apply:** Prioriser auth, Stripe CB et webhook lors de la prochaine session de tests.
