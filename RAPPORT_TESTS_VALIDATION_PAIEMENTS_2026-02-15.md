# RAPPORT TESTS : Validation Âge, Emails, Paiements

**Date** : 15/02/2026 14:00
**Version** : main (après merge protection anti-régression)
**Environnement** : localhost:3000

---

## 🎯 OBJECTIFS DES TESTS

1. ✅ Tester validation dates de naissance (enfant hors limites d'âge)
2. ✅ Vérifier le routage des emails (Kids → Éducateur, Pro → GED)
3. ✅ Vérifier la présence des propositions de paiement (Virement, Chèque, En ligne)

---

## ❌ PROBLÈME 1 : VALIDATION D'ÂGE ABSENTE

### Test effectué
**Séjour** : ALPOO KIDS (tranche 6-8 ans)

**Cas 1 : Enfant trop jeune**
- Nom : Tom Petit
- Date naissance : **15/08/2022** (3 ans - HORS LIMITES)
- Résultat : ❌ **Aucune erreur bloquante**

**Cas 2 : Enfant trop vieux**
- Nom : Lucie Grande
- Date naissance : **10/03/2015** (10 ans - HORS LIMITES)
- Résultat : ❌ **Aucune erreur bloquante**

### Constat

| Critère | État actuel | État attendu |
|---------|-------------|--------------|
| **Calcul âge** | ✅ Fonctionne (affiche "3 ans", "10 ans") | ✅ OK |
| **Validation** | ❌ Aucune | ✅ Message d'avertissement |
| **Blocage** | ❌ Permet de continuer | ⚠️ Warning ou blocage |
| **Message** | ❌ Absent | ✅ Message non-anxiogène |

### Impact
- **Risque** : Inscription d'enfants incompatibles avec la tranche d'âge du séjour
- **Expérience utilisateur** : Aucun feedback si erreur
- **Conséquence métier** : GED doit gérer manuellement les inscriptions hors limites

### Recommandation

**Option A : Message d'avertissement non-bloquant (RECOMMANDÉ)**

```typescript
// Dans booking-modal.tsx, ligne 568
{step2.childBirthDate && calculateAge(step2.childBirthDate) !== null && (
  <p className="mt-1 text-xs text-primary-500">
    Âge : {calculateAge(step2.childBirthDate)} ans
  </p>
)}

// ↓ AJOUTER :
{step2.childBirthDate && calculateAge(step2.childBirthDate) !== null && (
  (() => {
    const age = calculateAge(step2.childBirthDate);
    const minAge = stay.age_min || 6;
    const maxAge = stay.age_max || 17;
    const isOutOfRange = age < minAge || age > maxAge;

    return isOutOfRange ? (
      <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">Ce séjour est conçu pour les {minAge}-{maxAge} ans</p>
          <p className="text-xs mt-1">
            Tu as {age} ans ? Pas de souci ! Notre équipe vérifiera que le séjour peut s'adapter à toi. N'hésite pas à nous appeler si tu as des questions.
          </p>
        </div>
      </div>
    ) : null;
  })()
)}
```

**Message proposé** :
> ℹ️ **Ce séjour est conçu pour les 6-8 ans**
> Tu as 10 ans ? Pas de souci ! Notre équipe vérifiera que le séjour peut s'adapter à toi. N'hésite pas à nous appeler si tu as des questions.

**Tonalité** :
- ✅ Non-anxiogène
- ✅ Bienveillant
- ✅ Informatif sans bloquer
- ✅ Encourage le contact si doute

**Option B : Validation bloquante (si choix métier strict)**

```typescript
// Bloque le bouton "Continuer" si âge hors limites
const isAgeValid = () => {
  const age = calculateAge(step2.childBirthDate);
  if (!age) return true;
  return age >= (stay.age_min || 6) && age <= (stay.age_max || 17);
};

// Modifier isStep2Valid ligne 165
const isStep2Valid = step2.childSex && step2.childFirstName && step2.childBirthDate && step2.consent && isAgeValid();
```

---

## ❌ PROBLÈME 2 : ROUTAGE EMAILS NON IMPLÉMENTÉ

### État actuel du code

**Backend (`app/api/bookings/route.ts`)** :
```typescript
// L'email est reçu mais aucun envoi n'est déclenché
email: z.string().email(), // Ligne 12

// Créé la réservation en DB mais PAS d'email
const booking = await tx.booking.create({ ... }); // Ligne 60
```

**Constat** :
- ❌ **Aucun envoi d'email automatique**
- ❌ **Pas de système de notification**
- ❌ **Pas de différenciation Kids/Pro**

### Routage attendu

| Parcours | Destinataire email | Email saisi | Contenu attendu |
|----------|-------------------|-------------|-----------------|
| **Kids** | **Éducateur** (email saisi dans le formulaire souhait) | `educateur@example.com` | Notification de souhait de l'enfant |
| **Pro** | **GED** (adresse fixe pro) | `inscriptions@groupeetdecouverte.fr` | Notification d'inscription structure |
| **Pro** | **Référent structure** (email saisi) | `referent@structure.fr` | Confirmation de demande |

### Recommandation

**Ajouter un service d'envoi email** (Resend, SendGrid, ou serveur SMTP interne)

```typescript
// app/api/bookings/route.ts - APRÈS création booking

// 1. Email à GED (toujours pour parcours Pro)
await sendEmail({
  to: 'inscriptions@groupeetdecouverte.fr',
  subject: `Nouvelle inscription : ${stay.title}`,
  html: renderBookingEmailGED(booking, session, stay)
});

// 2. Email de confirmation au référent
await sendEmail({
  to: data.email, // Email du référent structure
  subject: `Confirmation demande d'inscription - ${stay.title}`,
  html: renderBookingEmailConfirmation(booking, session, stay)
});
```

**Pour le parcours Kids** (wishlist) :
```typescript
// components/wishlist-modal.tsx - APRÈS enregistrement souhait

await sendEmail({
  to: step1.educatorEmail, // Email éducateur saisi
  subject: `${step1.childName} souhaite participer à ${stay.title}`,
  html: renderWishlistEmail(childName, stayTitle, message)
});
```

---

## ❌ PROBLÈME 3 : MÉTHODES DE PAIEMENT ABSENTES

### Test effectué

**Recherche dans le code** :
- ❌ `virement` : 0 résultat
- ❌ `chèque` : 0 résultat
- ❌ `paiement` : 0 résultat

**Scan de l'interface** :
- ❌ Aucune mention de mode de paiement dans le modal de réservation
- ❌ Pas d'option "Virement" ou "Chèque"
- ❌ Pas d'intégration paiement en ligne (Stripe, PayPal, etc.)

### État actuel

Le système **ne propose aucune méthode de paiement** au moment de la réservation.

### Recommandation

**Ajouter une section "Mode de paiement" dans le récapitulatif final (Étape 5/5)**

```typescript
// booking-modal.tsx - Step 4 (Validation), APRÈS le récapitulatif

<div className="mt-4 pt-4 border-t border-primary-200">
  <h5 className="font-medium text-primary mb-3">Mode de paiement</h5>
  <div className="space-y-2 text-sm text-primary-700">
    <div className="flex items-start gap-2 p-3 bg-white rounded-lg border border-primary-100">
      <Check className="w-4 h-4 text-secondary mt-0.5" />
      <div>
        <p className="font-medium">Virement bancaire</p>
        <p className="text-xs text-primary-500">
          RIB envoyé par email après confirmation
        </p>
      </div>
    </div>
    <div className="flex items-start gap-2 p-3 bg-white rounded-lg border border-primary-100">
      <Check className="w-4 h-4 text-secondary mt-0.5" />
      <div>
        <p className="font-medium">Chèque</p>
        <p className="text-xs text-primary-500">
          À l'ordre de "Groupe & Découverte" - Adresse envoyée par email
        </p>
      </div>
    </div>
    <div className="flex items-start gap-2 p-3 bg-white rounded-lg border border-primary-100">
      <Check className="w-4 h-4 text-secondary mt-0.5" />
      <div>
        <p className="font-medium">Paiement en ligne (CB)</p>
        <p className="text-xs text-primary-500">
          Lien de paiement sécurisé envoyé par email
        </p>
      </div>
    </div>
  </div>
  <p className="mt-3 text-xs text-primary-500 italic">
    Vous recevrez un email de confirmation avec les instructions de paiement.
  </p>
</div>
```

**Workflow complet** :
1. ✅ Utilisateur valide la réservation → DB
2. ✅ Email envoyé à GED + Référent
3. ✅ Email contient RIB + Instructions virement/chèque
4. ✅ Email contient lien paiement CB (si implémenté)

---

## 📊 SYNTHÈSE DES PROBLÈMES

| Problème | Gravité | Impact | Effort fix |
|----------|---------|--------|------------|
| **Validation âge absente** | 🔴 **HAUTE** | Inscriptions invalides | 🟢 **Faible** (30min) |
| **Emails non envoyés** | 🔴 **CRITIQUE** | Aucune notification | 🔴 **Moyen** (2-4h) |
| **Modes paiement absents** | 🟡 **MOYENNE** | Confusion utilisateur | 🟢 **Faible** (1h) |

---

## ✅ TESTS RÉUSSIS (pour référence)

| Test | Statut | Détails |
|------|--------|---------|
| **Parcours Kids** | ✅ OK | Modal souhait fonctionne |
| **Parcours Pro** | ✅ OK | Formulaire inscription complet |
| **Calcul tarifs** | ✅ OK | 629€ + 188€ = 817€ |
| **Toggle Kids/Pro** | ✅ OK | Changement fluide |
| **Sélection session/ville** | ✅ OK | Prix mis à jour temps réel |
| **Calcul âge** | ✅ OK | "3 ans", "10 ans" affiché |

---

## 🎯 PLAN D'ACTION RECOMMANDÉ

### Court terme (avant production)

1. **[P0] Ajouter validation âge** ⏱️ 30min
   - Message non-anxiogène si hors limites
   - Permet inscription mais informe l'utilisateur

2. **[P0] Afficher modes de paiement** ⏱️ 1h
   - Section dans récapitulatif Step 5
   - Mention virement/chèque/CB

### Moyen terme (après MVP)

3. **[P1] Implémenter envoi emails** ⏱️ 2-4h
   - Intégrer Resend ou SendGrid
   - Email GED + Email confirmation référent
   - Email éducateur (parcours Kids)

4. **[P2] Intégrer paiement CB** ⏱️ 4-8h
   - Stripe ou PayPlug
   - Lien de paiement dans email

---

## 📋 CHECKLIST DÉPLOIEMENT

Avant de déployer en production :

- [ ] ✅ Validation âge ajoutée
- [ ] ✅ Modes paiement affichés
- [ ] ⚠️ Système email configuré (ou désactivé volontairement)
- [ ] ⚠️ Tests emails réels (pas de spam)
- [ ] ✅ Tests parcours complets Kids + Pro
- [ ] ✅ Tests régressions (noms UFOVAL absents)

---

**Prochaine étape recommandée** : Corriger la validation d'âge (30min) puis déployer.
