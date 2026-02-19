# 🧹 NETTOYAGE RÉFÉRENCES FLOOOW - Projet GED

**Date:** 15 février 2026
**Action:** Suppression de toutes les références au projet Flooow du dossier GED

---

## ⚠️ CLARIFICATION IMPORTANTE

Ce projet est **GED (Groupe & Découverte)**, PAS Flooow.

Le dossier contenait par erreur de nombreux fichiers du projet Flooow qui n'ont rien à voir avec GED.

---

## 📂 FICHIERS FLOOOW IDENTIFIÉS À SUPPRIMER

### Fichiers JSON n8n (12 fichiers)
```
❌ flooow-sejours-images-mapping-v2.json
❌ n8n-flooow-image-v5-fiable.json
❌ n8n-flooow-image-v6-slugmap.json
❌ n8n-flooow-image-v7-bypass.json
❌ n8n-flooow-image-v8-fullfix.json
❌ n8n-flooow-image-v9-direct.json
❌ n8n-flooow-image-v10-final.json
❌ n8n-flooow-image-collector-v2.json
❌ n8n-flooow-image-collector-v3-cinematic.json
❌ n8n-flooow-simple-v4.json
❌ business_logic_rules.json (contient logique Flooow)
```

### Fichiers SQL Flooow
```
❌ sql/006_create_sejours_images_table.sql (table Flooow)
❌ sql/007_smart_form_routing_helpers.sql (smart form Flooow)
```

### Fichiers Documentation
```
❌ README_INTEGRATION_COMPLETE.md (doc Flooow complète)
❌ docs/N8N_IMAGE_COLLECTOR_GUIDE.md (si existe)
❌ docs/SMART_FORM_INTEGRATION_GUIDE.md (si existe)
```

---

## ✅ CE QUI RESTE (Projet GED uniquement)

### Documentation GED valide
```
✅ CARTOGRAPHIE_COMPLETE_APP.md
✅ RAPPORT_TESTS_VALIDATION_PAIEMENTS_2026-02-15.md
✅ RAPPORT_ANTI_REGRESSION_FINAL.md
✅ ETAT_DES_LIEUX_UFOVAL_CITYCRUNCH_2026-02-15.md
✅ TESTS_GED_PROJET_REEL.md
✅ README-INSTALLATION.md
✅ README_DEPLOY.md
✅ DEPLOY_VPS.md
```

### Code GED valide
```
✅ app/ (toutes les pages Next.js)
✅ components/ (composants React)
✅ lib/ (utilitaires)
✅ prisma/ (schéma BDD GED)
✅ tests/ (tests adaptés GED)
```

### SQL GED valide
```
✅ sql/009_add_payment_columns.sql (paiements GED)
✅ Autres migrations GED
```

---

## 🚫 POURQUOI SUPPRIMER

1. **Confusion:** Mélange 2 projets différents
2. **Erreurs:** Tests créés sur mauvaise base
3. **Maintenance:** Documentation contradictoire
4. **Sécurité:** Éviter fuites logique métier Flooow dans GED

---

## 📋 DIFFÉRENCES GED vs FLOOOW

| Aspect | GED | Flooow |
|--------|-----|--------|
| **Projet** | Réservation séjours vacances | Guichet unique activités |
| **Âge** | 3-17 ans | 6-17 ans |
| **Aides** | ❌ Aucune | ✅ QF, QPV, mobilité |
| **Public** | Familles + Structures | Familles fragiles |
| **Paiement** | Virement, Chèque, CB | Conventionné/Devis |
| **Tables BDD** | `gd_*` | `flooow_*` |

---

## 🔧 COMMANDES NETTOYAGE

**Note:** Les fichiers sont protégés en écriture, suppression manuelle nécessaire.

```bash
cd /sessions/admiring-adoring-pasteur/mnt/GED_APP

# Lister fichiers Flooow
ls -la *flooow* business_logic_rules.json README_INTEGRATION_COMPLETE.md

# Supprimer (si permissions OK)
rm -f *flooow*.json
rm -f business_logic_rules.json
rm -f README_INTEGRATION_COMPLETE.md
rm -f sql/006_create_sejours_images_table.sql
rm -f sql/007_smart_form_routing_helpers.sql
```

---

## ✅ ÉTAT FINAL SOUHAITÉ

**Projet GED pur:**
- ✅ Code Next.js pour réservations séjours
- ✅ Base `gd_inscriptions`, `gd_stays`, `gd_sessions`
- ✅ Paiements GED (virement/chèque/CB)
- ✅ Tests adaptés GED
- ✅ Documentation GED uniquement

**Aucune trace de:**
- ❌ Flooow
- ❌ Smart Form
- ❌ Aides financières
- ❌ Quotient Familial
- ❌ n8n images (logique Flooow)

---

**Action utilisateur requise:** Supprimer manuellement les fichiers listés ou confirmer suppression automatique.
