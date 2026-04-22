# SEMANTIC GUARDS — GED_APP

**Objectif** : documenter les 4 pièges sémantiques (T1-T4) que l'audit déterministe (scripts + grep) ne détecte pas, et les garde-fous obligatoires à appliquer dans le code.

Voir aussi : `CLAUDE.md § "RÈGLE #0 quinquies — PIÈGES SÉMANTIQUES"`.

---

## T1 — Silence de la Réussite (Success-but-Failed)

### Le piège

Supabase avec RLS peut retourner un **tableau vide** au lieu d'une erreur quand la ligne visée n'est pas visible pour le rôle courant. Le code continue comme si tout allait bien → dossier fantôme, update silencieux, delete invisible.

### Anti-pattern (INTERDIT)

```ts
// ❌ INTERDIT : pas de check post-action
await supabase.from('gd_dossier_enfant').update({ fiche_sanitaire: data }).eq('id', id);
return { ok: true }; // on ment : l'UPDATE peut avoir affecté 0 ligne
```

### Pattern correct

```ts
// ✅ OBLIGATOIRE : guard post-action via lib/supabase-guards.ts
import { assertUpdatedOne } from '@/lib/supabase-guards';

const { data, error } = await supabase
  .from('gd_dossier_enfant')
  .update({ fiche_sanitaire: payload })
  .eq('id', id)
  .select();

if (error) throw error;
const updated = assertUpdatedOne(data, 'update_fiche_sanitaire');
return { ok: true, id: updated.id };
```

### Helpers disponibles (`lib/supabase-guards.ts`)

| Helper | Usage |
|---|---|
| `assertInserted(data, ctx)` | Après INSERT avec `.select().single()` — throw si null |
| `assertUpdatedOne(data, ctx)` | Après UPDATE — throw si 0 ou > 1 rows |
| `assertUpdatedAtLeastOne(data, ctx)` | Après UPDATE bulk — throw si 0 rows |
| `assertDeleted(count, ctx)` | Après DELETE — throw si 0 rows |
| `assertSelectedOne(data, ctx)` | Après SELECT `.single()` — throw si null |

### Script d'audit

`scripts/audit/post-action-assertions.mjs` — flag les `await supabase.*\.(insert|update|upsert|delete)` sans `assert*` dans les 5 lignes qui suivent.

---

## T2 — Fragmentation de l'État (State Desync)

### Le piège

Séquence multi-système non-atomique :

```
1. Paiement Stripe OK ✅
2. UPDATE gd_inscriptions.statut = 'paid' OK ✅
3. Email Resend KO (timeout) ❌
```

L'utilisateur a payé mais n'a pas sa confirmation. Aucun moyen de détecter a posteriori → dette de support client.

### Garde-fou : table `gd_outbound_emails` + cron de réconciliation

Migration `085_gd_outbound_emails.sql` introduit un registre :

```sql
CREATE TABLE gd_outbound_emails (
  id                UUID PK,
  recipient         TEXT NOT NULL,
  template_id       TEXT NOT NULL,
  idempotency_key   TEXT NOT NULL UNIQUE,
  status            TEXT CHECK IN ('sent','failed','skipped'),
  resend_message_id TEXT,
  sent_at           TIMESTAMPTZ,
  error_text        TEXT,
  metadata          JSONB,
  upstream_ok_at    TIMESTAMPTZ  -- marqueur étape amont (payment/db)
);
```

### Pattern correct

```ts
// 1. Payment OK
const intent = await stripe.paymentIntents.retrieve(id);

// 2. UPDATE DB
const { data } = await supabase.from('gd_inscriptions').update({ statut: 'paid' }).select();
const inscription = assertUpdatedOne(data, 'mark_paid');

// 3. Log l'intention d'email AVANT le send (idempotent via key)
const idempotencyKey = `payment_confirm_${inscription.id}_${intent.id}`;
await supabase.from('gd_outbound_emails').insert({
  recipient: inscription.email,
  template_id: 'payment_confirmation',
  idempotency_key: idempotencyKey,
  status: 'sent',
  upstream_ok_at: new Date().toISOString(),
  metadata: { inscription_id: inscription.id },
}).onConflict('idempotency_key').ignore();

// 4. Send email — si échec, UPDATE status='failed'
const result = await tryResendSend({ ... });
if (!result.sent) {
  await supabase.from('gd_outbound_emails')
    .update({ status: 'failed', error_text: result.reason })
    .eq('idempotency_key', idempotencyKey);
}
```

### Cron de réconciliation

`/api/cron/email-reconciliation` (quotidien) :

```sql
SELECT * FROM gd_outbound_emails
WHERE (status = 'failed')
   OR (status = 'sent' AND upstream_ok_at IS NULL AND created_at < NOW() - INTERVAL '5 minutes');
```

Toute ligne retournée = intervention humaine ou retry automatique.

### Script d'audit

`scripts/audit/state-reconciliation.mjs` — flag les séquences `supabase.update` + `tryResendSend` sans passage par `gd_outbound_emails`.

---

## T3 — Illusion du Grep (Sentry quality)

### Le piège

`Sentry.captureException(e)` partout sans contexte = 500 alertes "Undefined error" sans savoir quel utilisateur, séjour, ou opération.

### Anti-pattern (INTERDIT)

```ts
// ❌ INTERDIT : appel direct sans scope
import * as Sentry from '@sentry/nextjs';
Sentry.captureException(e);
```

### Pattern correct (`lib/sentry-capture.ts`)

```ts
// ✅ OBLIGATOIRE : helper typé avec domain + operation + extra primitives
import { captureServerException } from '@/lib/sentry-capture';

captureServerException(
  err,
  { domain: 'payment', operation: 'stripe_webhook' },
  { inscription_id: inscription.id, event_id: event.id, amount: intent.amount },
);
```

### Règles d'usage

| Champ | Contrainte |
|---|---|
| `domain` | Enum fermé : `payment | rgpd | auth | audit | cron | upload` |
| `operation` | Chaîne descriptive stable (ex: `stripe_webhook`, `dossier_submit`, `expire_codes`) |
| `extra` | Uniquement primitives (`string | number | boolean | null`) — **anti-PII** |

### Interdits stricts

- `Sentry.captureException(e)` sans scope
- Passer un objet User/dossier complet dans `extra` → fuite PII
- Oublier le `domain` (rend le triage Sentry impossible)

### Script d'audit

`scripts/audit/sentry-coverage.mjs` — flag les handlers PII qui n'ont **ni** `auditLog` **ni** `captureServerException` ; flag les appels directs à `Sentry.captureException` hors `lib/sentry-capture.ts`.

---

## T4 — Décalage de Réalité (Zod ↔ SQL drift)

### Le piège

Contrainte CHECK SQL rejette une donnée que Zod TS accepte → erreur 23514 prod invisible au linting.

### Exemple pédagogique (hypothétique)

```ts
// Si Zod accepte 'stripe_new' :
paymentMethod: z.enum(['transfer', 'check', 'stripe_new']).default('transfer')

// Mais SQL CHECK rejette 'stripe_new' :
CHECK (payment_method IN ('stripe', 'transfer', 'check'))
```

→ Prod : INSERT avec `paymentMethod: 'stripe_new'` → code postgres 23514 → 500 silencieux.

### Cas détecté GED_APP 2026-04-22 — faux positif avec mapping explicite

Lors de l'audit initial, 2 divergences Zod/SQL avaient été flagguées puis **requalifiées faux positifs** après cross-check code :

- `app/api/admin/inscriptions/manual/route.ts:54` accepte `['transfer','check','stripe']` → matche l'état prod réel `('stripe','transfer','check')`. **Aligned.**
- `app/api/inscriptions/route.ts:29` accepte `['card','bank_transfer','cheque','transfer','check']` → les 3 premières sont mappées via `PAYMENT_METHOD_MAP` L41-47 (`card→stripe`, `bank_transfer→transfer`, `cheque→check`) **avant** l'INSERT. Pattern valide.

**Enseignement** : un mapping explicite front→DB est une alternative légitime à l'alignement strict. Ce qui compte = **zéro valeur Zod non mappée n'arrive en INSERT**. Le script `zod-sql-consistency.mjs` doit prendre en compte ces mappings (limite actuelle : détection purement textuelle).

### Drift entre migrations SQL successives (historique)

Le script `schema-drift.mjs` détecte les `CHECK IN (...)` qui divergent sur la même colonne entre migrations chronologiques. Exemples détectés :
- `payment_method` : `sql/009` = `('stripe','transfer','check')` ↔ `sql/010` = `('lyra','transfer','check')` — **la migration 010 n'est PAS l'état prod réel** (MCP confirme CHECK prod = `'stripe'`). Drift historique potentiellement jamais appliquée.
- `role` : `sql/042` = 4 valeurs ↔ `supabase/migrations/069` = 5 valeurs (ajout `cds_delegated`) — évolution volontaire, 069 = état prod.

**Règle** : en présence de drift historique, toujours cross-checker l'état prod via MCP `list_tables(verbose=true)` avant de considérer qu'une migration est autoritative.

### Pattern correct — schéma partagé

```ts
// lib/schemas/payment.ts
export const PAYMENT_METHODS = ['lyra', 'transfer', 'check'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const paymentMethodEnum = z.enum(PAYMENT_METHODS);
```

Puis côté SQL, commentaire explicite :

```sql
-- Keep in sync with lib/schemas/payment.ts::PAYMENT_METHODS
CHECK (payment_method IN ('lyra', 'transfer', 'check'))
```

### Script d'audit

`scripts/audit/zod-sql-consistency.mjs` — parse `z.enum([...])` et `CHECK (... IN (...))` et flag divergences. Exécution dans `scripts/audit/all.mjs`.

### Protocole PR

Toute PR qui modifie une CHECK SQL doit modifier le Zod correspondant **dans le même commit**, sinon merge bloqué.

---

## Intégration dans le workflow

Les 4 pièges complètent les 7 checks du « Prelude anti-pièges » de `CLAUDE.md`. Total : 11 checks à exécuter avant toute mutation sur tables PII.

```
Prelude [1]-[7]   : CONSULTATION / GREP / OWNERSHIP / ORDRE / SIZE CAPS / AUDITLOG / RUNTIME
Sémantique [8]    : T1 — assert post-action
Sémantique [9]    : T2 — gd_outbound_emails
Sémantique [10]   : T3 — sentry scope
Sémantique [11]   : T4 — Zod/SQL drift
```

Les scripts déterministes `scripts/audit/*.mjs` couvrent [1]-[6] et [8]-[11] automatiquement. `[7] Runtime failures` reste à couverture manuelle (review agent ou test d'intégration).
