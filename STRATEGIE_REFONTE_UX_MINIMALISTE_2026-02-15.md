# STRATÉGIE : Refonte UX Minimaliste Hostinger

**Date** : 15/02/2026
**Objectif** : Migration vers design minimaliste Hostinger + Écrans dédiés (vs Modals)

---

## 📋 PARTIE 1 : SUPPRESSION ÉMOTICÔNES

### Audit complet

**Fichiers concernés** :
1. ✅ `components/booking-modal.tsx` (2 occurrences)
   - Ligne 251 : `📅 {formatDateLong(selectedSession.startDate)}`
   - Ligne 256 : `📍 {selectedCity}`

2. ✅ `lib/pricing.test.ts` (10 occurrences - fichier de test, OK à garder)

**Autres émoticônes potentielles à vérifier** :
- ❤️ (wishlist modal)
- ✨ (effets visuels)
- 🎯 (call-to-action)
- 📧 (emails)

### Actions de suppression

**Fichier** : `components/booking-modal.tsx`

**Ligne 251** :
```typescript
// AVANT
📅 {formatDateLong(selectedSession.startDate)}

// APRÈS (minimaliste)
{formatDateLong(selectedSession.startDate)}
```

**Ligne 256** :
```typescript
// AVANT
📍 {selectedCity}

// APRÈS (minimaliste)
{selectedCity}
```

**Alternative pro (avec icône Lucide)** :
```typescript
// Ligne 251
<Calendar className="w-3 h-3" /> {formatDateLong(selectedSession.startDate)}

// Ligne 256
<MapPin className="w-3 h-3" /> {selectedCity}
```

### Checklist complète

- [ ] `components/booking-modal.tsx` (📅, 📍)
- [ ] `components/wishlist-modal.tsx` (vérifier ❤️)
- [ ] `components/stay-card.tsx` (vérifier émoticônes)
- [ ] `app/sejour/[id]/stay-detail.tsx` (vérifier)
- [ ] Tous les autres `.tsx` (scan global)

**Principe** : Remplacer par icône Lucide ou supprimer si redondant

---

## 🎨 PARTIE 2 : STRATÉGIE MODALS → ÉCRANS DÉDIÉS

### Constat actuel

**Modals existants** :
1. ❌ **Booking Modal** (`/sejour/[id]` → popup)
2. ❌ **Wishlist Modal** (`/sejour/[id]` → popup)

**Problèmes** :
- ❌ Pas SEO-friendly (URL ne change pas)
- ❌ Navigation bizarre (back button ne fonctionne pas)
- ❌ Complexe à maintenir (state modal + parent)
- ❌ Moins pro/minimaliste qu'un écran dédié
- ❌ Difficulté à partager un lien direct

### Architecture cible (Hostinger-like)

```
ACTUEL (Modals)                    CIBLE (Pages dédiées)
─────────────────                  ─────────────────────

/                                   /
/sejour/[id]                        /sejour/[id]
  └─ Modal Booking                    └─ Bouton CTA
  └─ Modal Wishlist                      ↓
                                      /sejour/[id]/reserver
                                        └─ Écran complet 5 étapes

                                      /sejour/[id]/souhait
                                        └─ Écran complet Kids
```

### Plan de migration (sans régression)

#### Phase 1 : Création des nouvelles routes

**Créer** :
- `app/sejour/[id]/reserver/page.tsx` (Parcours Pro)
- `app/sejour/[id]/souhait/page.tsx` (Parcours Kids)

**Contenu** :
- Extraire le contenu actuel des modals
- Adapter en layout pleine page
- Breadcrumb : Séjour > Réserver
- Back button fonctionnel

#### Phase 2 : Redirection douce

**Fichier** : `app/sejour/[id]/stay-detail.tsx`

```typescript
// AVANT (Modal)
<button onClick={() => setShowBookingModal(true)}>
  Inscrire un enfant
</button>

// APRÈS (Page dédiée)
<Link href={`/sejour/${stay.slug}/reserver`}>
  <button>Inscrire un enfant</button>
</Link>
```

**Avantages** :
- ✅ URL propre : `/sejour/alpoo-kids/reserver`
- ✅ Shareable (copier-coller lien)
- ✅ Back button fonctionne
- ✅ SEO (Google indexe la page)
- ✅ Plus minimaliste (focus complet sur l'action)

#### Phase 3 : Nettoyage

- Supprimer `components/booking-modal.tsx`
- Supprimer `components/wishlist-modal.tsx`
- Nettoyer le state parent

### Structure écran dédié

```typescript
// app/sejour/[id]/reserver/page.tsx

export default async function ReserverPage({ params }: { params: { id: string } }) {
  const stay = await getStay(params.id);
  const sessions = await getSessions(params.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white">
      {/* Header minimaliste avec breadcrumb */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <nav className="text-sm text-primary-500 mb-6">
          <Link href="/">Accueil</Link> /
          <Link href={`/sejour/${params.id}`}>{stay.title}</Link> /
          <span className="text-primary">Réserver</span>
        </nav>

        {/* Titre */}
        <h1 className="text-3xl font-bold text-primary mb-2">
          Réserver {stay.marketingTitle}
        </h1>
        <p className="text-primary-600 mb-8">
          Suivez les 5 étapes pour finaliser votre inscription
        </p>

        {/* Stepper + Formulaire */}
        <BookingFlow stay={stay} sessions={sessions} />
      </div>
    </div>
  );
}
```

**Design** :
- Fond dégradé subtil (Hostinger-like)
- Max-width 3xl (lisibilité)
- Stepper horizontal en haut
- Formulaire centré
- Pas de modal = pas de fermeture accidentelle

### Routing complet

| Ancien (Modal) | Nouveau (Page) | Mode |
|----------------|----------------|------|
| `/sejour/[id]` + Modal | `/sejour/[id]/reserver` | Pro |
| `/sejour/[id]` + Modal | `/sejour/[id]/souhait` | Kids |

### Migration progressive (0 régression)

**Étape 1** : Créer les pages `/reserver` et `/souhait`
**Étape 2** : Tester en parallèle (garder les modals)
**Étape 3** : Basculer les CTA vers les pages
**Étape 4** : Supprimer les modals

**Durée estimée** : 4-6h

---

## 💳 PARTIE 3 : SCHÉMA TECHNIQUE PAIEMENTS

### Architecture proposée

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Utilisateur valide réservation                          │
│     └─ /sejour/[id]/reserver (Step 5/5)                     │
│        └─ Button "Confirmer" → POST /api/bookings           │
│                                                               │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              API ROUTE : /api/bookings                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  2. Créer booking en DB (Prisma/Supabase)                   │
│     ├─ status: 'pending'                                     │
│     ├─ payment_method: null (à choisir par user)            │
│     └─ booking_id: [UUID]                                    │
│                                                               │
│  3. Envoyer emails                                           │
│     ├─ → GED (inscriptions@groupeetdecouverte.fr)           │
│     │    └─ Notification nouvelle réservation              │
│     │                                                         │
│     └─ → Référent structure (email saisi)                   │
│          └─ Email confirmation avec 3 options paiement      │
│                                                               │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   EMAIL ENVOYÉ AU RÉFÉRENT                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Bonjour [Référent],                                         │
│                                                               │
│  Votre réservation est confirmée !                           │
│  Séjour : ALPOO KIDS                                         │
│  Montant : 817€ TTC                                          │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 3 MODES DE PAIEMENT DISPONIBLES                      │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │                                                       │   │
│  │ 1️⃣ VIREMENT BANCAIRE (recommandé pour structures)    │   │
│  │    IBAN : FR76 XXXX XXXX XXXX XXXX XXXX XXX         │   │
│  │    BIC : XXXXXXXX                                     │   │
│  │    Référence : BOOKING-[UUID]                        │   │
│  │    Délai : 3-5 jours ouvrés                          │   │
│  │                                                       │   │
│  │ 2️⃣ CHÈQUE                                              │   │
│  │    À l'ordre de : "Groupe & Découverte"              │   │
│  │    Adresse : 123 Rue Example, 75000 Paris            │   │
│  │    Référence au dos : BOOKING-[UUID]                 │   │
│  │    Délai : 5-7 jours ouvrés                          │   │
│  │                                                       │   │
│  │ 3️⃣ PAIEMENT EN LIGNE (CB)                             │   │
│  │    [BOUTON] Payer par carte bancaire                 │   │
│  │    └─ Lien : https://ged.com/pay/[UUID]              │   │
│  │    Sécurisé via Stripe                               │   │
│  │    Délai : Immédiat                                  │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  Une fois le paiement reçu, vous recevrez une confirmation. │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         ▼                ▼                ▼
    VIREMENT         CHÈQUE           PAIEMENT CB
         │                │                │
         │                │                ▼
         │                │    ┌──────────────────────┐
         │                │    │  Stripe Payment Page │
         │                │    │  /pay/[UUID]         │
         │                │    ├──────────────────────┤
         │                │    │  1. Vérif booking    │
         │                │    │  2. Intent Stripe    │
         │                │    │  3. Redirect success │
         │                │    └──────────────────────┘
         │                │                │
         │                │                ▼
         │                │    ┌──────────────────────┐
         │                │    │  Webhook Stripe      │
         │                │    │  /api/webhooks/stripe│
         │                │    ├──────────────────────┤
         │                │    │  Event: payment ok   │
         │                │    │  → Update DB         │
         │                │    │  → Email confirm     │
         │                │    └──────────────────────┘
         │                │                │
         ▼                ▼                ▼
    ┌─────────────────────────────────────────┐
    │  SUIVI MANUEL GED (pour virement/chèque)│
    │  → Admin reçoit notification             │
    │  → Valide paiement manuellement          │
    │  → Update booking.status = 'paid'        │
    │  → Email confirmation envoyé             │
    └─────────────────────────────────────────┘
```

### Flux détaillé : Paiement CB (Stripe)

```
1. USER clique "Payer par CB" dans email
   ↓
2. Redirect → https://ged.com/pay/[BOOKING_UUID]
   ↓
3. Page /pay/[uuid]/page.tsx
   ├─ Vérif booking existe + status = pending
   ├─ Créer Stripe Payment Intent
   │  └─ amount: 817€ (from booking)
   │  └─ metadata: { booking_id, stay_id }
   └─ Afficher Stripe Elements (form CB)
   ↓
4. USER remplit CB → Submit
   ↓
5. Stripe traite paiement
   ├─ Si OK → payment_intent.succeeded
   │  └─ Webhook /api/webhooks/stripe
   │     ├─ Vérif signature
   │     ├─ Update booking.status = 'paid'
   │     ├─ Update booking.payment_method = 'card'
   │     ├─ Update booking.paid_at = NOW()
   │     └─ Email confirmation à user + GED
   │
   └─ Si KO → payment_intent.failed
      └─ Afficher erreur + retry
   ↓
6. Redirect success → /sejour/[id]/confirmation
   └─ Afficher "Paiement confirmé ✅"
```

### Base de données : Schema booking

```sql
-- Table bookings (existante)
ALTER TABLE bookings ADD COLUMN payment_method VARCHAR(20);
-- Valeurs: 'virement', 'cheque', 'card', null

ALTER TABLE bookings ADD COLUMN payment_status VARCHAR(20) DEFAULT 'pending';
-- Valeurs: 'pending', 'paid', 'failed', 'refunded'

ALTER TABLE bookings ADD COLUMN paid_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE bookings ADD COLUMN stripe_payment_intent_id VARCHAR(255);

ALTER TABLE bookings ADD COLUMN payment_notes TEXT;
-- Notes admin pour virement/chèque (ex: "Chèque reçu le 20/02/2026")
```

### Intégration Stripe (recommandée)

**Fichiers à créer** :

1. `lib/stripe.ts` (config)
```typescript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});
```

2. `app/pay/[uuid]/page.tsx` (page paiement)
```typescript
// Page de paiement CB avec Stripe Elements
```

3. `app/api/webhooks/stripe/route.ts` (webhook)
```typescript
// Écoute events Stripe (payment_intent.succeeded)
```

4. `.env` (config)
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Coûts Stripe

- **Transaction classique** : 1,4% + 0,25€
- **Exemple** : 817€ → 1,4% = 11,44€ + 0,25€ = **11,69€ de frais**
- **Alternative** : Ajouter frais au client (817€ + 12€ = 829€)

### Alternative : PayPlug (français)

- Plus adapté PME françaises
- Tarifs similaires à Stripe
- Support français

---

## 📋 PLAN D'ACTION GLOBAL

### Court terme (avant production)

1. ✅ **Supprimer émoticônes** (30min)
   - booking-modal.tsx
   - wishlist-modal.tsx
   - stay-card.tsx

2. ⚠️ **Remplacer par icônes Lucide** (1h)
   - Calendar, MapPin, Heart, Check

### Moyen terme (après MVP)

3. ✅ **Créer pages dédiées** (4-6h)
   - `/sejour/[id]/reserver`
   - `/sejour/[id]/souhait`
   - Migration progressive

4. ✅ **Intégrer Stripe** (6-8h)
   - Config Stripe
   - Page /pay/[uuid]
   - Webhook
   - Tests

### Long terme (amélioration continue)

5. **Supprimer modals** (2h)
   - Nettoyage code
   - Réduction bundle size

6. **Tableau de bord admin** (8-12h)
   - Suivi paiements
   - Validation manuelle virement/chèque

---

## 🎯 PRIORITÉS RECOMMANDÉES

| Action | Priorité | Durée | Impact |
|--------|----------|-------|--------|
| Supprimer émoticônes | 🔴 P0 | 30min | UX Hostinger |
| Pages dédiées (reserver/souhait) | 🟡 P1 | 4-6h | SEO + UX pro |
| Intégration Stripe | 🟢 P2 | 6-8h | Monétisation |
| Admin dashboard paiements | 🟢 P3 | 8-12h | Gestion |

**Recommandation finale** : Commencer par P0 (émoticônes) + pages dédiées, puis Stripe après validation métier.
