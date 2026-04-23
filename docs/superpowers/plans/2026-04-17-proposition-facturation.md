# Proposition Tarifaire + Facturation Structures — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre au travailleur social (pro JWT) de demander une proposition tarifaire depuis la fiche séjour, à l'admin GED d'envoyer le PDF par email, puis d'établir des factures avec suivi de paiement partiel ou total.

**Architecture:** 3 couches indépendantes — (A) demande côté pro → alerte admin → envoi PDF email, (B) API CRUD factures qui alimente l'UI existante `/admin/factures/page.tsx`, (C) corrections build. L'UI factures (920 lignes) existe déjà et est fonctionnelle ; seules les routes API manquent.

**Tech Stack:** Next.js 15 App Router, Supabase JS admin (service_role), JOSE JWT httpOnly cookies, Resend SDK, pdf-lib (déjà utilisé dans `/api/admin/propositions/pdf`), TypeScript strict.

---

## État de l'existant

| Élément | État |
|---|---|
| `gd_propositions_tarifaires` | Existe — statuts: brouillon/envoyee/validee/refusee |
| `gd_factures` + `gd_facture_lignes` + `gd_facture_paiements` | Tables créées, RLS strict, indexes en place |
| `app/admin/factures/page.tsx` | UI complète (liste, création, paiements, PDF) — **routes API manquantes** |
| `app/api/admin/propositions/pdf/route.ts` | Génère PDF (pdf-lib) — pas d'envoi email |
| `app/admin/propositions/page.tsx` | `'use client'` direct — même bug build que demandes |
| Bouton "Inscrire un enfant" fiche séjour | Existe en mode pro JWT — aucun bouton proposition |

---

## Fichiers créés / modifiés

| Fichier | Action | Responsabilité |
|---|---|---|
| Migration SQL (via MCP) | Créer | Ajouter `demandeur_email`, `demandeur_nom`, statut `'demandee'` à `gd_propositions_tarifaires` |
| `lib/email.ts` | Modifier | Ajouter `sendPropositionAlertGED()` + `sendPropositionEmail()` |
| `app/api/pro/propositions/route.ts` | Créer | POST — JWT requis, crée proposition en statut `demandee` |
| `app/api/admin/propositions/[id]/send/route.ts` | Créer | POST — requireEditor, génère PDF, envoie email, statut → `envoyee` |
| `app/sejour/[id]/stay-detail.tsx` | Modifier | Ajouter bouton "Demander une proposition" en mode pro JWT |
| `app/admin/propositions/AdminPropositionsClient.tsx` | Créer | Extraire le 'use client' existant + ajouter action "Envoyer" |
| `app/admin/propositions/page.tsx` | Modifier | Wrapper serveur `force-dynamic` |
| `app/api/admin/factures/route.ts` | Créer | GET list + POST create + PATCH statut |
| `app/api/admin/factures/[id]/paiements/route.ts` | Créer | GET paiements + POST ajouter paiement (auto-update statut facture) |
| `app/api/admin/factures/pdf/route.ts` | Créer | GET — génère PDF facture avec pdf-lib |
| `app/admin/factures/page.tsx` | Modifier | Wrapper serveur `force-dynamic` + renommer client → `AdminFacturesClient.tsx` |

---

## Task 1 — Migration DB : statut `demandee` + champs demandeur

**Files:**
- Migration via MCP Supabase `apply_migration`

- [ ] **Step 1 : Appliquer la migration via MCP**

```sql
-- Migration: add_proposition_demandee_status_and_demandeur_fields
ALTER TABLE gd_propositions_tarifaires
  ADD COLUMN IF NOT EXISTS demandeur_email TEXT,
  ADD COLUMN IF NOT EXISTS demandeur_nom   TEXT;

ALTER TABLE gd_propositions_tarifaires
  DROP CONSTRAINT IF EXISTS gd_propositions_tarifaires_status_check;

ALTER TABLE gd_propositions_tarifaires
  ADD CONSTRAINT gd_propositions_tarifaires_status_check
  CHECK (status IN ('brouillon','demandee','envoyee','validee','refusee','annulee'));
```

- [ ] **Step 2 : Vérifier**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'gd_propositions_tarifaires'
AND column_name IN ('demandeur_email','demandeur_nom');
-- doit retourner 2 lignes
```

- [ ] **Step 3 : Commit**

```bash
git commit -m "feat(db): statut demandee + champs demandeur sur propositions tarifaires"
```

---

## Task 2 — Fonctions email : alerte admin + envoi PDF proposition

**Files:**
- Modify: `lib/email.ts`

- [ ] **Step 1 : Ajouter les deux fonctions à la fin de `lib/email.ts`**

```typescript
// ── Proposition tarifaire : alerte admin (nouvelle demande) ──
export async function sendPropositionAlertGED(data: {
  demandeurNom: string;
  demandeurEmail: string;
  sejourTitre: string;
  sessionDate: string;
  villeDepart: string;
  propositionId: string;
}): Promise<void> {
  if (!process.env.EMAIL_SERVICE_API_KEY || process.env.EMAIL_SERVICE_API_KEY === 'YOUR_EMAIL_API_KEY_HERE') {
    console.warn('[email] sendPropositionAlertGED: clé manquante');
    return;
  }
  const adminEmails = (process.env.ADMIN_NOTIFICATION_EMAIL ?? '')
    .split(',').map(e => e.trim()).filter(Boolean);
  const to = adminEmails.length > 0 ? adminEmails : ['contact@groupeetdecouverte.fr'];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.groupeetdecouverte.fr';

  await getResend().emails.send({
    from: 'Groupe & Découverte <noreply@groupeetdecouverte.fr>',
    to,
    subject: `[GED] Nouvelle demande de proposition — ${htmlEscape(data.sejourTitre)}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:#2a383f;color:white;padding:20px;border-radius:8px 8px 0 0">
          <h1 style="margin:0;font-size:18px">Nouvelle demande de proposition tarifaire</h1>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
          <p><strong>Demandeur :</strong> ${htmlEscape(data.demandeurNom)} (${htmlEscape(data.demandeurEmail)})</p>
          <p><strong>Séjour :</strong> ${htmlEscape(data.sejourTitre)}</p>
          <p><strong>Session :</strong> ${htmlEscape(data.sessionDate)} — ${htmlEscape(data.villeDepart)}</p>
          <div style="text-align:center;margin:24px 0">
            <a href="${appUrl}/admin/propositions"
               style="background:#de7356;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">
              Traiter la demande
            </a>
          </div>
        </div>
      </div>`,
  });
}

// ── Proposition tarifaire : envoi PDF au travailleur social ──
export async function sendPropositionEmail(data: {
  to: string;
  destinataireNom: string;
  sejourTitre: string;
  dossierRef: string;
  pdfBuffer: Uint8Array;
}): Promise<void> {
  if (!process.env.EMAIL_SERVICE_API_KEY || process.env.EMAIL_SERVICE_API_KEY === 'YOUR_EMAIL_API_KEY_HERE') {
    console.warn('[email] sendPropositionEmail: clé manquante');
    return;
  }

  await getResend().emails.send({
    from: 'Groupe & Découverte <noreply@groupeetdecouverte.fr>',
    to: data.to,
    subject: `Votre proposition tarifaire — ${htmlEscape(data.sejourTitre)}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:#2a383f;color:white;padding:20px;border-radius:8px 8px 0 0">
          <h1 style="margin:0;font-size:18px">Groupe &amp; Découverte</h1>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
          <p>Bonjour ${htmlEscape(data.destinataireNom)},</p>
          <p>Veuillez trouver ci-joint votre proposition tarifaire pour le séjour
             <strong>${htmlEscape(data.sejourTitre)}</strong>.</p>
          <p>Référence : <strong>${htmlEscape(data.dossierRef)}</strong></p>
          <p>Pour toute question : 04 23 16 16 71 · contact@groupeetdecouverte.fr</p>
        </div>
      </div>`,
    attachments: [{
      filename: `proposition-${data.dossierRef}.pdf`,
      content: Buffer.from(data.pdfBuffer).toString('base64'),
    }],
  });
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
# Doit retourner 0 erreur
```

- [ ] **Step 3 : Commit**

```bash
git add lib/email.ts
git commit -m "feat(email): sendPropositionAlertGED + sendPropositionEmail"
```

---

## Task 3 — Route API : POST /api/pro/propositions/request

**Files:**
- Create: `app/api/pro/propositions/route.ts`

- [ ] **Step 1 : Créer la route**

```typescript
// app/api/pro/propositions/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendPropositionAlertGED } from '@/lib/email';

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentification requise.' } },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Corps invalide.' } },
      { status: 400 }
    );
  }

  const { sejour_slug, session_date, city_departure } = body;

  if (
    typeof sejour_slug !== 'string' || !sejour_slug.trim() ||
    typeof session_date !== 'string' || !session_date.trim() ||
    typeof city_departure !== 'string' || !city_departure.trim()
  ) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'sejour_slug, session_date et city_departure sont requis.' } },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  // Vérifier que la session et le prix existent
  const { data: pricing } = await supabase
    .from('gd_session_prices')
    .select('base_price_eur, transport_surcharge_ged, price_ged_total, start_date, end_date')
    .eq('stay_slug', sejour_slug)
    .eq('start_date', session_date)
    .eq('city_departure', city_departure)
    .single();

  if (!pricing) {
    return NextResponse.json(
      { error: { code: 'SESSION_NOT_FOUND', message: 'Session ou tarif introuvable.' } },
      { status: 400 }
    );
  }

  const { data: stay } = await supabase
    .from('gd_stays')
    .select('marketing_title, title')
    .eq('slug', sejour_slug)
    .single();

  const sejourTitre = (stay?.marketing_title || stay?.title || sejour_slug) as string;
  const dateFormatted = new Date(session_date).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // Créer la proposition en statut 'demandee'
  const { data: proposition, error } = await supabase
    .from('gd_propositions_tarifaires')
    .insert({
      demandeur_email:   auth.email,
      demandeur_nom:     auth.prenom ? `${auth.prenom} ${auth.nom ?? ''}`.trim() : auth.email,
      sejour_slug,
      sejour_titre:      sejourTitre,
      session_start:     session_date,
      session_end:       pricing.end_date ?? session_date,
      ville_depart:      city_departure,
      prix_sejour:       pricing.base_price_eur ?? 0,
      prix_transport:    pricing.transport_surcharge_ged ?? 0,
      prix_encadrement:  0,
      prix_total:        pricing.price_ged_total ?? 0,
      status:            'demandee',
      // structure_nom non connu à ce stade — l'admin le complétera
      structure_nom:     auth.organisation ?? '',
    })
    .select('id')
    .single();

  if (error || !proposition) {
    console.error('[propositions/request] insert error:', error?.message);
    return NextResponse.json(
      { error: { code: 'INSERT_ERROR', message: 'Impossible de créer la demande.' } },
      { status: 500 }
    );
  }

  // Alerte admin (non-bloquant)
  sendPropositionAlertGED({
    demandeurNom:   auth.prenom ? `${auth.prenom} ${auth.nom ?? ''}`.trim() : auth.email,
    demandeurEmail: auth.email,
    sejourTitre,
    sessionDate:    dateFormatted,
    villeDepart:    city_departure,
    propositionId:  proposition.id,
  }).catch(err => console.error('[propositions/request] alert email failed:', err));

  return NextResponse.json({ ok: true, propositionId: proposition.id }, { status: 201 });
}
```

> **Note :** `auth.prenom`, `auth.nom`, `auth.organisation` — vérifier les champs exacts du payload JWT dans `lib/auth-middleware.ts`. Adapter si les noms diffèrent (ex: `auth.firstName`, `auth.lastName`).

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3 : Tester manuellement**

```bash
# Avec un token JWT valide dans le cookie gd_session :
curl -X POST http://localhost:3000/api/pro/propositions \
  -H "Content-Type: application/json" \
  -b "gd_session=<token>" \
  -d '{"sejour_slug":"mon-sejour","session_date":"2026-07-01","city_departure":"Paris"}'
# Attendu : {"ok":true,"propositionId":"<uuid>"}
```

- [ ] **Step 4 : Commit**

```bash
git add app/api/pro/propositions/route.ts
git commit -m "feat(api): POST /api/pro/propositions — demande proposition depuis espace pro"
```

---

## Task 4 — UI : bouton "Demander une proposition" sur fiche séjour

**Files:**
- Modify: `app/sejour/[id]/stay-detail.tsx`

- [ ] **Step 1 : Ajouter l'état et la fonction de soumission**

Dans `stay-detail.tsx`, après la déclaration des états existants (`showProAuthModal`, etc.), ajouter :

```typescript
const [propositionRequested, setPropositionRequested] = useState(false);
const [propositionLoading, setPropositionLoading] = useState(false);

const handleRequestProposition = async () => {
  if (!preSelectedSessionId || !preSelectedCity) return;
  setPropositionLoading(true);
  try {
    const res = await fetch('/api/pro/propositions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sejour_slug: slug,
        session_date: preSelectedSessionId, // date ISO de la session
        city_departure: preSelectedCity,
      }),
    });
    if (res.ok) setPropositionRequested(true);
  } catch { /* silent */ }
  setPropositionLoading(false);
};
```

- [ ] **Step 2 : Ajouter le bouton sous "Inscrire un enfant"**

Remplacer le bloc CTA existant (lignes ~860-869 dans stay-detail.tsx) :

```typescript
// Avant (bloc existant à ne PAS toucher) :
) : (
  <Button
    onClick={() => setShowProAuthModal(true)}
    disabled={!preSelectedSessionId || !preSelectedCity || ...}
    className="w-full"
    size="lg"
  >
    Inscrire un enfant
  </Button>
)}
```

Ajouter APRÈS ce bouton, toujours dans le bloc `!isKids` :

```typescript
) : (
  <div className="space-y-2">
    <Button
      onClick={() => setShowProAuthModal(true)}
      disabled={!preSelectedSessionId || !preSelectedCity || (!IS_TEST_MODE && sessions.filter(s => s?.seatsLeft === -1 || (s?.seatsLeft ?? 0) > 0).length === 0)}
      className="w-full"
      size="lg"
    >
      Inscrire un enfant
    </Button>

    {propositionRequested ? (
      <p className="text-center text-xs text-primary font-medium py-2">
        Demande envoyée — notre équipe vous contacte sous 24h.
      </p>
    ) : (
      <Button
        variant="outline"
        className="w-full"
        size="default"
        disabled={!preSelectedSessionId || !preSelectedCity || propositionLoading}
        onClick={() => { void handleRequestProposition(); }}
      >
        {propositionLoading ? 'Envoi…' : 'Demander une proposition tarifaire'}
      </Button>
    )}
  </div>
)}
```

- [ ] **Step 3 : Vérifier TypeScript + build local**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
```

- [ ] **Step 4 : Commit**

```bash
git add app/sejour/[id]/stay-detail.tsx
git commit -m "feat(ui): bouton demande proposition tarifaire sur fiche séjour pro"
```

---

## Task 5 — Route admin : envoyer PDF proposition par email

**Files:**
- Create: `app/api/admin/propositions/[id]/send/route.ts`
- Modify: `app/admin/propositions/page.tsx` → split en wrapper + `AdminPropositionsClient.tsx`

- [ ] **Step 1 : Créer la route d'envoi**

```typescript
// app/api/admin/propositions/[id]/send/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendPropositionEmail } from '@/lib/email';
import { generatePropositionPdf } from '@/lib/pdf-proposition';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEditor(req);
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const { id } = await params;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: prop } = await supabase
    .from('gd_propositions_tarifaires')
    .select('*')
    .eq('id', id)
    .single();

  if (!prop) return NextResponse.json({ error: 'Proposition introuvable' }, { status: 404 });

  if (!prop.demandeur_email) {
    return NextResponse.json(
      { error: 'Pas d\'email destinataire — proposition créée manuellement sans demandeur.' },
      { status: 400 }
    );
  }

  // Générer le PDF (réutilise la logique existante du route pdf)
  const pdfBytes = await generatePropositionPdf(prop);

  // Envoyer l'email avec pièce jointe
  await sendPropositionEmail({
    to:              prop.demandeur_email,
    destinataireNom: prop.demandeur_nom || prop.demandeur_email,
    sejourTitre:     prop.sejour_titre || prop.sejour_slug,
    dossierRef:      prop.id.slice(0, 8).toUpperCase(),
    pdfBuffer:       pdfBytes,
  });

  // Mettre à jour le statut
  await supabase
    .from('gd_propositions_tarifaires')
    .update({ status: 'envoyee' })
    .eq('id', id)
    .in('status', ['brouillon', 'demandee']);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2 : Extraire la logique PDF en fonction partagée**

Le route `/api/admin/propositions/pdf/route.ts` contient la génération PDF. Extraire la fonction dans `lib/pdf-proposition.ts` :

```typescript
// lib/pdf-proposition.ts
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const ORANGE = rgb(0.878, 0.478, 0.373);
const DARK   = rgb(0.12, 0.12, 0.2);
const GRAY   = rgb(0.4, 0.4, 0.4);

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function fmtPrice(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount) + ' EUR';
}

export async function generatePropositionPdf(prop: Record<string, unknown>): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page   = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Header
  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: DARK });
  page.drawText('Association Groupe et Découverte', {
    x: 40, y: height - 30, size: 10, font, color: rgb(1,1,1),
  });
  page.drawText('PROPOSITION TARIFAIRE', {
    x: 40, y: height - 55, size: 18, font: fontBold, color: ORANGE,
  });

  // Structure destinataire
  let y = height - 120;
  page.drawText('À l\'attention de :', { x: 40, y, size: 10, font, color: GRAY });
  y -= 16;
  page.drawText(String(prop.structure_nom || ''), { x: 40, y, size: 11, font: fontBold, color: DARK });
  if (prop.structure_adresse) {
    y -= 14;
    page.drawText(String(prop.structure_adresse), { x: 40, y, size: 10, font, color: DARK });
  }
  if (prop.structure_cp || prop.structure_ville) {
    y -= 14;
    page.drawText(`${prop.structure_cp || ''} ${prop.structure_ville || ''}`.trim(), {
      x: 40, y, size: 10, font, color: DARK,
    });
  }

  // Séjour
  y -= 30;
  page.drawText('Séjour', { x: 40, y, size: 10, font, color: GRAY });
  y -= 16;
  page.drawText(String(prop.sejour_titre || prop.sejour_slug || ''), {
    x: 40, y, size: 12, font: fontBold, color: DARK,
  });

  // Dates + Ville
  y -= 20;
  const dateStr = prop.session_start
    ? `Du ${fmtDate(String(prop.session_start))} au ${fmtDate(String(prop.session_end || prop.session_start))}`
    : '';
  page.drawText(`${dateStr}   —   Ville de départ : ${prop.ville_depart || ''}`, {
    x: 40, y, size: 10, font, color: DARK,
  });

  // Tableau tarifs
  y -= 40;
  page.drawRectangle({ x: 40, y: y - 4, width: width - 80, height: 20, color: rgb(0.94, 0.94, 0.94) });
  page.drawText('Désignation', { x: 50, y, size: 9, font: fontBold, color: DARK });
  page.drawText('Montant', { x: width - 130, y, size: 9, font: fontBold, color: DARK });

  const lines: { label: string; amount: number }[] = [
    { label: 'Séjour éducatif', amount: Number(prop.prix_sejour) || 0 },
    { label: 'Transport', amount: Number(prop.prix_transport) || 0 },
  ];
  if (Number(prop.prix_encadrement) > 0) {
    lines.push({ label: 'Encadrement renforcé', amount: Number(prop.prix_encadrement) });
  }

  for (const line of lines) {
    y -= 20;
    page.drawText(line.label, { x: 50, y, size: 10, font, color: DARK });
    page.drawText(fmtPrice(line.amount), { x: width - 150, y, size: 10, font, color: DARK });
    page.drawLine({ start: { x: 40, y: y - 4 }, end: { x: width - 40, y: y - 4 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
  }

  // Total
  y -= 28;
  page.drawRectangle({ x: 40, y: y - 4, width: width - 80, height: 22, color: ORANGE });
  page.drawText('TOTAL', { x: 50, y, size: 11, font: fontBold, color: rgb(1,1,1) });
  page.drawText(fmtPrice(Number(prop.prix_total) || 0), { x: width - 160, y, size: 11, font: fontBold, color: rgb(1,1,1) });

  // Footer
  page.drawText('Groupe et Découverte — 04 23 16 16 71 — contact@groupeetdecouverte.fr', {
    x: 40, y: 30, size: 8, font, color: GRAY,
  });

  return pdfDoc.save();
}
```

- [ ] **Step 3 : Mettre à jour le PDF route existant pour utiliser la fonction partagée**

Dans `app/api/admin/propositions/pdf/route.ts`, remplacer le code inline de génération par :

```typescript
import { generatePropositionPdf } from '@/lib/pdf-proposition';
// ...
const pdfBytes = await generatePropositionPdf(proposition as Record<string, unknown>);
```

- [ ] **Step 4 : Split admin/propositions page (fix build)**

```bash
cp app/admin/propositions/page.tsx app/admin/propositions/AdminPropositionsClient.tsx
```

Remplacer `app/admin/propositions/page.tsx` par :

```typescript
export const dynamic = 'force-dynamic';
import AdminPropositionsClient from './AdminPropositionsClient';
export default function AdminPropositionsPage() {
  return <AdminPropositionsClient />;
}
```

- [ ] **Step 5 : Ajouter le bouton "Envoyer" dans `AdminPropositionsClient.tsx`**

Dans `AdminPropositionsClient.tsx`, dans la liste des actions par proposition (là où il y a les boutons aperçu/PDF/statut), ajouter :

```typescript
// Pour les propositions en statut 'demandee' ou 'brouillon' avec demandeur_email
{(p.status === 'demandee' || p.status === 'brouillon') && p.demandeur_email && (
  <button
    onClick={() => void handleSendProposition(p.id)}
    className="p-2 hover:bg-blue-50 rounded text-gray-400 hover:text-blue-600 transition"
    title="Envoyer par email"
    aria-label={`Envoyer la proposition à ${p.demandeur_email}`}
  >
    <Send size={16} />
  </button>
)}
```

Ajouter la fonction `handleSendProposition` dans le composant :

```typescript
const handleSendProposition = async (id: string) => {
  try {
    const res = await fetch(`/api/admin/propositions/${id}/send`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast(`Erreur envoi : ${err?.error ?? res.status}`);
      return;
    }
    toast('Proposition envoyée par email.');
    void fetchPropositions(); // recharge la liste
  } catch {
    toast('Erreur réseau lors de l\'envoi.');
  }
};
```

Ajouter aussi `'demandee'` dans le STATUS_OPTIONS et un badge visuel distinct (ex: orange) dans le composant.

- [ ] **Step 6 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 7 : Commit**

```bash
git add lib/pdf-proposition.ts app/api/admin/propositions/[id]/send/route.ts \
        app/api/admin/propositions/pdf/route.ts \
        app/admin/propositions/page.tsx app/admin/propositions/AdminPropositionsClient.tsx
git commit -m "feat: envoi email PDF proposition + split admin/propositions build fix"
```

---

## Task 6 — Routes API Factures : GET list + POST create + PATCH statut

**Files:**
- Create: `app/api/admin/factures/route.ts`

L'UI appelle :
- `GET /api/admin/factures` → `{ factures: Facture[] }`
- `POST /api/admin/factures` → `{ structure_nom, structure_adresse, structure_cp, structure_ville, lignes, montant_total }` → `{ facture }`
- `PATCH /api/admin/factures` → `{ id, statut }` → `{ facture }`

- [ ] **Step 1 : Créer `app/api/admin/factures/route.ts`**

```typescript
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { auditLog } from '@/lib/audit-log';

const VALID_STATUTS = ['brouillon','envoyee','payee_partiel','payee','annulee'] as const;
type FactureStatut = typeof VALID_STATUTS[number];

export async function GET(req: NextRequest) {
  const auth = await requireEditor(req);
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const url = new URL(req.url);
  const page  = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') ?? '50'));
  const from  = (page - 1) * limit;
  const to    = from + limit - 1;

  const { data, count, error } = await supabase
    .from('gd_factures')
    .select('*, gd_facture_lignes(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('[factures GET]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Normaliser : DB utilise 'statut', l'UI utilise 'status'
  const factures = (data ?? []).map(f => ({
    ...f,
    status: f.statut,
    lignes: f.gd_facture_lignes ?? [],
  }));

  return NextResponse.json({ factures, total: count ?? 0, page, limit });
}

export async function POST(req: NextRequest) {
  const auth = await requireEditor(req);
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }); }

  const { structure_nom, structure_adresse, structure_cp, structure_ville, lignes, montant_total } = body;

  if (!structure_nom || typeof structure_nom !== 'string' || !structure_nom.trim()) {
    return NextResponse.json({ error: 'structure_nom est requis' }, { status: 400 });
  }
  if (!Array.isArray(lignes) || lignes.length === 0) {
    return NextResponse.json({ error: 'Au moins une ligne enfant est requise' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Créer la facture
  const { data: facture, error: factureErr } = await supabase
    .from('gd_factures')
    .insert({
      structure_nom:     String(structure_nom).trim(),
      structure_adresse: String(structure_adresse ?? ''),
      structure_cp:      String(structure_cp ?? ''),
      structure_ville:   String(structure_ville ?? ''),
      montant_total:     Number(montant_total) || 0,
      statut:            'brouillon',
      created_by:        auth.email,
    })
    .select('id, numero')
    .single();

  if (factureErr || !facture) {
    console.error('[factures POST]', factureErr?.message);
    return NextResponse.json({ error: 'Erreur création facture' }, { status: 500 });
  }

  // Insérer les lignes
  interface LigneInput {
    enfant_prenom: string; enfant_nom: string; sejour_titre: string;
    session_start: string; session_end: string; ville_depart: string;
    prix_sejour: number; prix_transport: number; prix_encadrement: number;
  }
  const lignesRows = (lignes as LigneInput[]).map(l => ({
    facture_id:        facture.id,
    enfant_prenom:     String(l.enfant_prenom ?? ''),
    enfant_nom:        String(l.enfant_nom ?? ''),
    sejour_titre:      String(l.sejour_titre ?? ''),
    session_start:     l.session_start || null,
    session_end:       l.session_end || null,
    ville_depart:      String(l.ville_depart ?? ''),
    prix_sejour:       Number(l.prix_sejour) || 0,
    prix_transport:    Number(l.prix_transport) || 0,
    prix_encadrement:  Number(l.prix_encadrement) || 0,
    prix_ligne_total:  (Number(l.prix_sejour) || 0) + (Number(l.prix_transport) || 0) + (Number(l.prix_encadrement) || 0),
  }));

  const { error: lignesErr } = await supabase.from('gd_facture_lignes').insert(lignesRows);

  if (lignesErr) {
    console.error('[factures POST lignes]', lignesErr.message);
    // Rollback la facture orpheline
    await supabase.from('gd_factures').delete().eq('id', facture.id);
    return NextResponse.json({ error: 'Erreur insertion lignes' }, { status: 500 });
  }

  await auditLog(supabase, {
    action: 'create', resourceType: 'inscription',
    resourceId: facture.id, actorType: 'admin', actorId: auth.email,
    metadata: { numero: facture.numero, structure_nom },
  });

  return NextResponse.json({ facture: { ...facture, status: 'brouillon' } }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireEditor(req);
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }); }

  const { id, statut } = body;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  }
  if (!VALID_STATUTS.includes(statut as FactureStatut)) {
    return NextResponse.json({ error: `Statut invalide. Valeurs : ${VALID_STATUTS.join(', ')}` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('gd_factures')
    .update({ statut })
    .eq('id', id)
    .select('id, numero, statut')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ facture: { ...data, status: data.statut } });
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add app/api/admin/factures/route.ts
git commit -m "feat(api): GET/POST/PATCH /api/admin/factures"
```

---

## Task 7 — Route API Paiements : GET + POST avec auto-update statut facture

**Files:**
- Create: `app/api/admin/factures/[id]/paiements/route.ts`

L'UI appelle :
- `GET /api/admin/factures/${id}/paiements` → `{ paiements: Paiement[] }`
- `POST /api/admin/factures/${id}/paiements` → `{ date_paiement, montant, methode, reference, note }` → 201

Après chaque POST : recalculer le total payé → mettre à jour `gd_factures.statut` automatiquement.

- [ ] **Step 1 : Créer `app/api/admin/factures/[id]/paiements/route.ts`**

```typescript
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_METHODES = ['virement', 'cb_stripe', 'cheque'] as const;

async function syncStatutFacture(supabase: ReturnType<typeof import('@/lib/supabase-server').getSupabaseAdmin>, factureId: string): Promise<void> {
  const { data: facture } = await supabase
    .from('gd_factures')
    .select('montant_total, statut')
    .eq('id', factureId)
    .single();

  if (!facture || facture.statut === 'annulee') return;

  const { data: paiements } = await supabase
    .from('gd_facture_paiements')
    .select('montant')
    .eq('facture_id', factureId);

  const totalPaye = (paiements ?? []).reduce((s, p) => s + (Number(p.montant) || 0), 0);
  const montantTotal = Number(facture.montant_total) || 0;

  let newStatut: string;
  if (totalPaye <= 0) {
    newStatut = facture.statut === 'envoyee' ? 'envoyee' : 'brouillon';
  } else if (totalPaye >= montantTotal) {
    newStatut = 'payee';
  } else {
    newStatut = 'payee_partiel';
  }

  if (newStatut !== facture.statut) {
    await supabase.from('gd_factures').update({ statut: newStatut }).eq('id', factureId);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEditor(req);
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('gd_facture_paiements')
    .select('*')
    .eq('facture_id', id)
    .order('date_paiement', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ paiements: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEditor(req);
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }); }

  const { date_paiement, montant, methode, reference, note } = body;

  if (!date_paiement || typeof date_paiement !== 'string') {
    return NextResponse.json({ error: 'date_paiement requis (YYYY-MM-DD)' }, { status: 400 });
  }
  if (!montant || Number(montant) <= 0) {
    return NextResponse.json({ error: 'montant doit être > 0' }, { status: 400 });
  }
  if (!VALID_METHODES.includes(methode as typeof VALID_METHODES[number])) {
    return NextResponse.json({ error: `methode invalide. Valeurs : ${VALID_METHODES.join(', ')}` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Vérifier que la facture existe et n'est pas annulée
  const { data: facture } = await supabase
    .from('gd_factures')
    .select('id, statut')
    .eq('id', id)
    .single();

  if (!facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });
  if (facture.statut === 'annulee') {
    return NextResponse.json({ error: 'Impossible d\'ajouter un paiement à une facture annulée' }, { status: 400 });
  }

  const { data: paiement, error } = await supabase
    .from('gd_facture_paiements')
    .insert({
      facture_id:     id,
      date_paiement:  String(date_paiement),
      montant:        Number(montant),
      methode:        String(methode),
      reference:      String(reference ?? ''),
      note:           String(note ?? ''),
    })
    .select()
    .single();

  if (error) {
    console.error('[factures paiements POST]', error.message);
    return NextResponse.json({ error: 'Erreur enregistrement paiement' }, { status: 500 });
  }

  // Auto-update statut facture (payee_partiel / payee)
  await syncStatutFacture(supabase, id);

  return NextResponse.json({ paiement }, { status: 201 });
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add 'app/api/admin/factures/[id]/paiements/route.ts'
git commit -m "feat(api): GET/POST /api/admin/factures/[id]/paiements — auto-update statut"
```

---

## Task 8 — Route PDF Facture

**Files:**
- Create: `app/api/admin/factures/pdf/route.ts`
- Create: `lib/pdf-facture.ts`

L'UI appelle : `GET /api/admin/factures/pdf?id=<uuid>`

- [ ] **Step 1 : Créer `lib/pdf-facture.ts`**

```typescript
// lib/pdf-facture.ts
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const ORANGE = rgb(0.878, 0.478, 0.373);
const DARK   = rgb(0.12, 0.12, 0.2);
const GRAY   = rgb(0.4, 0.4, 0.4);

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtPrice(n: number) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(n) + ' EUR';
}

interface FactureLigne {
  enfant_prenom: string; enfant_nom: string; sejour_titre: string;
  session_start?: string; session_end?: string; ville_depart?: string;
  prix_sejour: number; prix_transport: number; prix_encadrement: number; prix_ligne_total: number;
}

interface FactureData {
  numero: string;
  structure_nom: string; structure_adresse?: string; structure_cp?: string; structure_ville?: string;
  montant_total: number; statut: string; created_at: string;
  lignes: FactureLigne[];
}

export async function generateFacturePdf(f: FactureData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page   = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Header
  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: DARK });
  page.drawText('Association Groupe et Découverte', { x: 40, y: height - 30, size: 10, font, color: rgb(1,1,1) });
  page.drawText('FACTURE', { x: 40, y: height - 55, size: 20, font: fontBold, color: ORANGE });
  page.drawText(f.numero, { x: width - 150, y: height - 50, size: 12, font: fontBold, color: rgb(1,1,1) });

  // Structure
  let y = height - 120;
  page.drawText('Facturer à :', { x: 40, y, size: 10, font, color: GRAY });
  y -= 16;
  page.drawText(f.structure_nom, { x: 40, y, size: 11, font: fontBold, color: DARK });
  if (f.structure_adresse) { y -= 14; page.drawText(f.structure_adresse, { x: 40, y, size: 10, font, color: DARK }); }
  if (f.structure_cp || f.structure_ville) {
    y -= 14;
    page.drawText(`${f.structure_cp ?? ''} ${f.structure_ville ?? ''}`.trim(), { x: 40, y, size: 10, font, color: DARK });
  }

  // Date
  y -= 30;
  page.drawText(`Date : ${fmtDate(f.created_at)}`, { x: 40, y, size: 10, font, color: GRAY });

  // Tableau
  y -= 30;
  const colEnfant = 40;
  const colSejour = 170;
  const colDates  = 310;
  const colTotal  = width - 120;

  page.drawRectangle({ x: 40, y: y - 4, width: width - 80, height: 20, color: rgb(0.94,0.94,0.94) });
  page.drawText('Enfant',      { x: colEnfant, y, size: 9, font: fontBold, color: DARK });
  page.drawText('Séjour',      { x: colSejour, y, size: 9, font: fontBold, color: DARK });
  page.drawText('Session',     { x: colDates,  y, size: 9, font: fontBold, color: DARK });
  page.drawText('Total',       { x: colTotal,  y, size: 9, font: fontBold, color: DARK });

  for (const l of f.lignes) {
    y -= 20;
    page.drawText(`${l.enfant_prenom} ${l.enfant_nom}`.slice(0, 20), { x: colEnfant, y, size: 9, font, color: DARK });
    page.drawText((l.sejour_titre || '').slice(0, 25), { x: colSejour, y, size: 9, font, color: DARK });
    const dates = l.session_start ? `${fmtDate(l.session_start)}` : '';
    page.drawText(dates, { x: colDates, y, size: 9, font, color: DARK });
    page.drawText(fmtPrice(l.prix_ligne_total), { x: colTotal, y, size: 9, font, color: DARK });
    page.drawLine({ start: { x: 40, y: y - 3 }, end: { x: width - 40, y: y - 3 }, thickness: 0.4, color: rgb(0.9,0.9,0.9) });
  }

  // Total
  y -= 30;
  page.drawRectangle({ x: 40, y: y - 4, width: width - 80, height: 24, color: ORANGE });
  page.drawText('TOTAL TTC', { x: 50, y, size: 11, font: fontBold, color: rgb(1,1,1) });
  page.drawText(fmtPrice(f.montant_total), { x: colTotal - 20, y, size: 11, font: fontBold, color: rgb(1,1,1) });

  // Footer
  page.drawText('Groupe et Découverte — 04 23 16 16 71 — contact@groupeetdecouverte.fr', { x: 40, y: 30, size: 8, font, color: GRAY });

  return pdfDoc.save();
}
```

- [ ] **Step 2 : Créer `app/api/admin/factures/pdf/route.ts`**

```typescript
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { generateFacturePdf } from '@/lib/pdf-facture';

export async function GET(req: NextRequest) {
  const auth = await requireEditor(req);
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const id = req.nextUrl.searchParams.get('id');
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: 'ID manquant ou invalide' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: facture } = await supabase
    .from('gd_factures')
    .select('*, gd_facture_lignes(*)')
    .eq('id', id)
    .single();

  if (!facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });

  const lignes = (facture.gd_facture_lignes ?? []) as Parameters<typeof generateFacturePdf>[0]['lignes'];
  const pdfBytes = await generateFacturePdf({ ...facture, lignes });

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="facture-${facture.numero}.pdf"`,
    },
  });
}
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add lib/pdf-facture.ts app/api/admin/factures/pdf/route.ts
git commit -m "feat(pdf): génération PDF facture (pdf-lib)"
```

---

## Task 9 — Fix build : admin/factures page (server wrapper)

**Files:**
- Modify: `app/admin/factures/page.tsx`
- Create: `app/admin/factures/AdminFacturesClient.tsx`

- [ ] **Step 1 : Split**

```bash
cp app/admin/factures/page.tsx app/admin/factures/AdminFacturesClient.tsx
```

Remplacer `app/admin/factures/page.tsx` par :

```typescript
export const dynamic = 'force-dynamic';
import AdminFacturesClient from './AdminFacturesClient';
export default function AdminFacturesPage() {
  return <AdminFacturesClient />;
}
```

- [ ] **Step 2 : Build complet**

```bash
npm run build 2>&1 | grep -E "error|Error|warning" | head -20
# Doit passer sans erreur sur /admin/factures
```

- [ ] **Step 3 : Commit + push**

```bash
git add app/admin/factures/page.tsx app/admin/factures/AdminFacturesClient.tsx
git commit -m "fix(build): admin/factures server wrapper (React Client Manifest)"
git push origin main
```

---

## Checklist de vérification finale

- [ ] `GET /api/admin/factures` renvoie `{ factures, total }`
- [ ] `POST /api/admin/factures` crée facture + lignes, rollback si lignes échouent
- [ ] `PATCH /api/admin/factures` change le statut
- [ ] `POST /api/admin/factures/[id]/paiements` enregistre le paiement ET met à jour `statut` → `payee_partiel` ou `payee`
- [ ] `GET /api/admin/factures/pdf?id=` renvoie un PDF valide
- [ ] `POST /api/admin/propositions/[id]/send` envoie email + PDF en pièce jointe + statut → `envoyee`
- [ ] Bouton "Demander une proposition" visible sur fiche séjour en mode pro JWT
- [ ] Build Vercel passe sans erreur sur `/admin/factures` et `/admin/propositions`
- [ ] TypeScript strict : `npx tsc --noEmit` = 0 erreur
