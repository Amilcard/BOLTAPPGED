# Team Invitation Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à la direction d'une structure d'inviter secrétariat et éducateurs avec leur email pro, chaque invité activant son propre password (jamais partagé) — conforme RGPD.

**Architecture:** Réutilisation de `gd_structure_access_codes` (déjà présente) avec 4 nouvelles colonnes (`invitation_token`, `invitation_expires_at`, `activated_at`, `password_hash`). Direction (code 10 chars) invite via `POST /api/structure/[code]/invite` → token one-time → email Resend → invité clique `/structure/activate?token=XXX` → définit password (bcrypt) → ligne active. Login ultérieur via `POST /api/auth/structure-login {email, password}` → cookie `gd_pro_session` JWT (pattern existant). Pas de rupture de l'accès code-only legacy.

**Tech Stack:** Next.js 15 App Router, Supabase direct (no ORM), bcryptjs 2.4.3 (déjà installé), jose 6.2.2 (JWT), Resend (emails), Jest (tests), `isRateLimited()`, `auditLog()`, `resolveCodeToStructure()` existants.

---

## File Structure

**Création :**
- `lib/password.ts` — wrapper bcrypt (hash/verify)
- `lib/invitation-token.ts` — génération UUID + expiration calc
- `app/api/structure/[code]/invite/route.ts` — POST invitation
- `app/api/structure/[code]/team/route.ts` — GET liste équipe
- `app/api/structure/[code]/team/[memberId]/revoke/route.ts` — POST révocation
- `app/api/structure/[code]/team/[memberId]/reinvite/route.ts` — POST réinvitation
- `app/api/auth/activate-invitation/route.ts` — POST activation (set password)
- `app/api/auth/structure-login/route.ts` — POST login email+password
- `app/structure/activate/page.tsx` — UI activation (server wrapper)
- `app/structure/activate/ActivateClient.tsx` — UI activation (client)
- `components/structure/StructureTeamTab.tsx` — onglet Équipe dashboard direction
- 8 fichiers test : `tests/api/*.test.ts`

**Modification :**
- `lib/email.ts` — ajout `sendTeamMemberInvite()`
- `app/structure/[code]/page.tsx` — ajout onglet "Équipe" conditionné au rôle direction

**Migration Supabase :**
- `add_team_invitation_columns` — 4 nouvelles colonnes sur `gd_structure_access_codes`

---

## Pre-flight Check

- [ ] **Confirmer bcryptjs installé**

Run: `grep '"bcryptjs"' /Users/laidhamoudi/Dev/GED_APP/package.json`
Expected: `"bcryptjs": "2.4.3"`

- [ ] **Confirmer branche main à jour**

Run: `cd /Users/laidhamoudi/Dev/GED_APP && git fetch origin && git status`
Expected: `On branch main` + `Your branch is up to date with 'origin/main'`

---

## Task 1 : Migration DB

**Files:**
- Migration Supabase via MCP `apply_migration`

- [ ] **Step 1: Appliquer la migration**

Via MCP `mcp__claude_ai_Supabase__apply_migration` avec project_id `iirfvndgzutbxwfdwawu`:

```sql
-- Nom: add_team_invitation_columns
ALTER TABLE gd_structure_access_codes
  ADD COLUMN IF NOT EXISTS invitation_token TEXT,
  ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS invited_by_email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sac_invitation_token
  ON gd_structure_access_codes(invitation_token)
  WHERE invitation_token IS NOT NULL;

-- CRITIQUE : contrainte UNIQUE (pas index simple) pour prévenir race condition double-invite
CREATE UNIQUE INDEX IF NOT EXISTS uq_sac_email_structure
  ON gd_structure_access_codes(structure_id, email)
  WHERE email IS NOT NULL;
```

- [ ] **Step 2: Vérifier les colonnes existent**

Via MCP `execute_sql`:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'gd_structure_access_codes'
  AND column_name IN ('invitation_token', 'invitation_expires_at', 'activated_at', 'password_hash', 'invited_by_email')
ORDER BY column_name;
```

Expected: 5 rows

- [ ] **Step 3: Commit tracking**

Aucun fichier à committer (migration Supabase cloud). Créer un fichier SQL pour traçabilité locale:

```bash
cat > /Users/laidhamoudi/Dev/GED_APP/supabase/migrations/068_team_invitation_columns.sql <<'SQL'
-- 2026-04-17 add_team_invitation_columns
ALTER TABLE gd_structure_access_codes
  ADD COLUMN IF NOT EXISTS invitation_token TEXT,
  ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS invited_by_email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sac_invitation_token
  ON gd_structure_access_codes(invitation_token)
  WHERE invitation_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sac_email_structure
  ON gd_structure_access_codes(structure_id, email)
  WHERE email IS NOT NULL;
SQL

git add supabase/migrations/068_team_invitation_columns.sql
git commit -m "feat(team-invite): migration 068 colonnes invitation gd_structure_access_codes"
git push origin main
```

---

## Task 2 : Helper password (bcrypt wrapper)

**Files:**
- Create: `lib/password.ts`
- Test: `tests/lib/password.test.ts`

- [ ] **Step 1: Écrire le test**

```typescript
// tests/lib/password.test.ts
import { hashPassword, verifyPassword } from '@/lib/password';

describe('password helper', () => {
  test('hashPassword retourne un hash bcrypt', async () => {
    const hash = await hashPassword('MotDePasse123!');
    expect(hash).toMatch(/^\$2[ayb]\$.{56}$/);
    expect(hash).not.toContain('MotDePasse123!');
  });

  test('verifyPassword accepte le bon password', async () => {
    const hash = await hashPassword('MotDePasse123!');
    expect(await verifyPassword('MotDePasse123!', hash)).toBe(true);
  });

  test('verifyPassword rejette un mauvais password', async () => {
    const hash = await hashPassword('MotDePasse123!');
    expect(await verifyPassword('Mauvais', hash)).toBe(false);
  });

  test('verifyPassword retourne false si hash null', async () => {
    expect(await verifyPassword('x', null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — doit échouer**

Run: `npx jest tests/lib/password.test.ts`
Expected: FAIL `Cannot find module '@/lib/password'`

- [ ] **Step 3: Implémenter le helper**

```typescript
// lib/password.ts
import bcrypt from 'bcryptjs';

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export function isPasswordStrong(plain: string): { ok: boolean; reason?: string } {
  if (plain.length < 12) return { ok: false, reason: 'Au moins 12 caractères.' };
  if (!/[a-z]/.test(plain)) return { ok: false, reason: 'Au moins une minuscule.' };
  if (!/[A-Z]/.test(plain)) return { ok: false, reason: 'Au moins une majuscule.' };
  if (!/[0-9]/.test(plain)) return { ok: false, reason: 'Au moins un chiffre.' };
  return { ok: true };
}
```

- [ ] **Step 4: Run test — doit passer**

Run: `npx jest tests/lib/password.test.ts`
Expected: PASS 4 tests

- [ ] **Step 5: Commit**

```bash
git add lib/password.ts tests/lib/password.test.ts
git commit -m "feat(team-invite): helper password bcrypt + validation force"
git push origin main
```

---

## Task 3 : Helper invitation token

**Files:**
- Create: `lib/invitation-token.ts`
- Test: `tests/lib/invitation-token.test.ts`

- [ ] **Step 1: Écrire le test**

```typescript
// tests/lib/invitation-token.test.ts
import { generateInvitationToken, computeInvitationExpiry, isInvitationExpired } from '@/lib/invitation-token';

describe('invitation token', () => {
  test('generateInvitationToken retourne UUID v4', () => {
    const token = generateInvitationToken();
    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  test('computeInvitationExpiry retourne ~48h dans le futur', () => {
    const expiry = computeInvitationExpiry();
    const deltaMs = new Date(expiry).getTime() - Date.now();
    expect(deltaMs).toBeGreaterThan(47 * 3600 * 1000);
    expect(deltaMs).toBeLessThan(49 * 3600 * 1000);
  });

  test('isInvitationExpired true si date passée', () => {
    expect(isInvitationExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
  });

  test('isInvitationExpired false si date future', () => {
    expect(isInvitationExpired(new Date(Date.now() + 3600000).toISOString())).toBe(false);
  });

  test('isInvitationExpired true si null', () => {
    expect(isInvitationExpired(null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — doit échouer**

Run: `npx jest tests/lib/invitation-token.test.ts`
Expected: FAIL module not found

- [ ] **Step 3: Implémenter le helper**

```typescript
// lib/invitation-token.ts
import { randomUUID } from 'crypto';

const INVITATION_TTL_HOURS = 48;

export function generateInvitationToken(): string {
  return randomUUID();
}

export function computeInvitationExpiry(): string {
  return new Date(Date.now() + INVITATION_TTL_HOURS * 3600 * 1000).toISOString();
}

export function isInvitationExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() < Date.now();
}
```

- [ ] **Step 4: Run test — doit passer**

Run: `npx jest tests/lib/invitation-token.test.ts`
Expected: PASS 5 tests

- [ ] **Step 5: Commit**

```bash
git add lib/invitation-token.ts tests/lib/invitation-token.test.ts
git commit -m "feat(team-invite): helper token invitation UUID + expiry 48h"
git push origin main
```

---

## Task 4 : Email invitation template

**Files:**
- Modify: `lib/email.ts` (ajouter fonction à la fin du fichier)
- Test: `tests/lib/email-team-invite.test.ts`

- [ ] **Step 1: Écrire le test**

```typescript
// tests/lib/email-team-invite.test.ts
import { sendTeamMemberInvite } from '@/lib/email';

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ data: { id: 'email-id' }, error: null }) },
  })),
}));

describe('sendTeamMemberInvite', () => {
  beforeAll(() => { process.env.EMAIL_SERVICE_API_KEY = 'test-key'; });

  test('envoie un email avec lien activation', async () => {
    const result = await sendTeamMemberInvite({
      to: 'test@example.com',
      prenom: 'Marie',
      structureName: 'MECS Les Oliviers',
      role: 'secretariat',
      activationUrl: 'https://app.groupeetdecouverte.fr/structure/activate?token=abc',
      invitedBy: 'direction@example.com',
    });
    expect(result).toBeDefined();
  });

  test('retourne null si pas de clé API', async () => {
    const old = process.env.EMAIL_SERVICE_API_KEY;
    delete process.env.EMAIL_SERVICE_API_KEY;
    const result = await sendTeamMemberInvite({
      to: 'x@y.fr', prenom: 'X', structureName: 'S', role: 'secretariat',
      activationUrl: 'https://x', invitedBy: 'd@e.f',
    });
    expect(result).toBeNull();
    process.env.EMAIL_SERVICE_API_KEY = old;
  });
});
```

- [ ] **Step 2: Run test — doit échouer**

Run: `npx jest tests/lib/email-team-invite.test.ts`
Expected: FAIL `sendTeamMemberInvite is not a function`

- [ ] **Step 3: Ajouter la fonction à la fin de `lib/email.ts`**

```typescript
// À ajouter à la fin de lib/email.ts

interface TeamInviteData {
  to: string;
  prenom: string;
  structureName: string;
  role: 'secretariat' | 'educateur';
  activationUrl: string;
  invitedBy: string;
}

export async function sendTeamMemberInvite(data: TeamInviteData) {
  if (!process.env.EMAIL_SERVICE_API_KEY || process.env.EMAIL_SERVICE_API_KEY === 'YOUR_EMAIL_API_KEY_HERE') {
    console.warn('[EMAIL] Clé API manquante — invitation équipe non envoyée');
    return null;
  }

  const roleLabel = data.role === 'secretariat' ? 'Secrétariat' : 'Éducateur';

  try {
    const result = await getResend().emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject: `Invitation ${data.structureName} — activation de votre accès`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2a383f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Groupe &amp; Découverte</h1>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #2a383f; margin-top: 0;">Bonjour ${htmlEscape(data.prenom)},</h2>
            <p>La direction de <strong>${htmlEscape(data.structureName)}</strong> vous invite à créer votre accès personnel pour le rôle <strong>${roleLabel}</strong>.</p>
            <p>Cliquez sur le bouton ci-dessous pour définir votre mot de passe :</p>
            <p style="text-align: center; margin: 24px 0;">
              <a href="${data.activationUrl}" style="background: #de7356; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Activer mon accès</a>
            </p>
            <p style="color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
              <strong>Ce lien est strictement personnel.</strong> Ne le transmettez à personne, même en cas d'absence.
              En cas d'empêchement, contactez la direction pour qu'une délégation ou réinvitation soit mise en place.
            </p>
            <p style="color: #9ca3af; font-size: 12px;">
              Lien envoyé par ${htmlEscape(data.invitedBy)} · valable 48h · usage unique
            </p>
          </div>
        </div>
      `,
    });
    return result;
  } catch (err) {
    console.error('[EMAIL] sendTeamMemberInvite error:', err);
    return null;
  }
}
```

- [ ] **Step 4: Run test — doit passer**

Run: `npx jest tests/lib/email-team-invite.test.ts`
Expected: PASS 2 tests

- [ ] **Step 5: Commit**

```bash
git add lib/email.ts tests/lib/email-team-invite.test.ts
git commit -m "feat(team-invite): email invitation équipe avec mention lien personnel"
git push origin main
```

---

## Task 5 : POST /api/structure/[code]/invite

**Files:**
- Create: `app/api/structure/[code]/invite/route.ts`
- Test: `tests/api/structure-invite.test.ts`

- [ ] **Step 1: Écrire le test**

```typescript
// tests/api/structure-invite.test.ts
import { POST } from '@/app/api/structure/[code]/invite/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/structure');
jest.mock('@/lib/supabase-server');
jest.mock('@/lib/email');
jest.mock('@/lib/rate-limit-structure', () => ({
  structureRateLimitGuard: jest.fn().mockResolvedValue(null),
  getStructureClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));
jest.mock('@/lib/audit-log', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

import { resolveCodeToStructure } from '@/lib/structure';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendTeamMemberInvite } from '@/lib/email';

const makeReq = (code: string, body: unknown) =>
  new NextRequest(`http://localhost/api/structure/${code}/invite`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

describe('POST /api/structure/[code]/invite', () => {
  beforeEach(() => jest.clearAllMocks());

  test('403 si code pas direction', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1', name: 'S' }, role: 'cds', roles: ['cds'], email: null,
    });
    const res = await POST(makeReq('ABC123', { email: 'x@y.fr', role: 'secretariat' }),
      { params: Promise.resolve({ code: 'ABC123' }) });
    expect(res.status).toBe(403);
  });

  test('400 si email invalide', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1', name: 'S' }, role: 'direction', roles: ['direction'], email: null,
    });
    const res = await POST(makeReq('ABCDEFGHIJ', { email: 'pas-email', role: 'secretariat' }),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ' }) });
    expect(res.status).toBe(400);
  });

  test('400 si rôle invalide', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1', name: 'S' }, role: 'direction', roles: ['direction'], email: null,
    });
    const res = await POST(makeReq('ABCDEFGHIJ', { email: 'x@y.fr', role: 'admin' }),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ' }) });
    expect(res.status).toBe(400);
  });

  test('409 si email déjà invité', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1', name: 'S' }, role: 'direction', roles: ['direction'], email: null,
    });
    const fromMock = jest.fn();
    (getSupabaseAdmin as jest.Mock).mockReturnValue({ from: fromMock });
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'existing' } }) }) }) }),
    });
    const res = await POST(makeReq('ABCDEFGHIJ', { email: 'x@y.fr', role: 'secretariat' }),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ' }) });
    expect(res.status).toBe(409);
  });

  test('201 happy path', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1', name: 'MECS Test' }, role: 'direction', roles: ['direction'], email: 'dir@x.fr',
    });
    const fromMock = jest.fn();
    (getSupabaseAdmin as jest.Mock).mockReturnValue({ from: fromMock });
    fromMock
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }) })
      .mockReturnValueOnce({ insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'new-id' }, error: null }) }) }) });
    (sendTeamMemberInvite as jest.Mock).mockResolvedValue({ id: 'email-id' });
    const res = await POST(makeReq('ABCDEFGHIJ', { email: 'marie@x.fr', prenom: 'Marie', role: 'secretariat' }),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ' }) });
    expect(res.status).toBe(201);
    expect(sendTeamMemberInvite).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — doit échouer**

Run: `npx jest tests/api/structure-invite.test.ts`
Expected: FAIL module not found

- [ ] **Step 3: Implémenter la route**

```typescript
// app/api/structure/[code]/invite/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { resolveCodeToStructure } from '@/lib/structure';
import { auditLog } from '@/lib/audit-log';
import { structureRateLimitGuard, getStructureClientIp } from '@/lib/rate-limit-structure';
import { generateInvitationToken, computeInvitationExpiry } from '@/lib/invitation-token';
import { sendTeamMemberInvite } from '@/lib/email';

const VALID_ROLES = ['secretariat', 'educateur'] as const;
type InviteRole = typeof VALID_ROLES[number];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const rateLimited = await structureRateLimitGuard(req);
    if (rateLimited) return rateLimited;

    const { code } = await params;
    if (!code || !/^[A-Z0-9]{10}$/i.test(code)) {
      return NextResponse.json({ error: { code: 'INVALID_CODE', message: 'Code directeur requis.' } }, { status: 400 });
    }

    const resolved = await resolveCodeToStructure(code);
    if (!resolved || resolved.role !== 'direction') {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Accès réservé au directeur.' } }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: { code: 'INVALID_BODY' } }, { status: 400 });

    const { email, role, prenom, nom } = body as { email?: string; role?: string; prenom?: string; nom?: string };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return NextResponse.json({ error: { code: 'INVALID_EMAIL', message: 'Email valide requis.' } }, { status: 400 });
    }
    if (!role || !VALID_ROLES.includes(role as InviteRole)) {
      return NextResponse.json({ error: { code: 'INVALID_ROLE', message: `Rôle doit être : ${VALID_ROLES.join(', ')}.` } }, { status: 400 });
    }

    const emailNorm = email.trim().toLowerCase();
    const structureId = resolved.structure.id as string;
    const supabase = getSupabaseAdmin();

    // Vérifier doublon
    const { data: existing } = await supabase
      .from('gd_structure_access_codes')
      .select('id')
      .eq('structure_id', structureId)
      .eq('email', emailNorm)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: { code: 'ALREADY_INVITED', message: 'Cet email est déjà invité sur cette structure.' } },
        { status: 409 }
      );
    }

    const invitationToken = generateInvitationToken();
    const invitationExpiresAt = computeInvitationExpiry();

    // Génération d'un code personnel 8 chars (distinct du code structure)
    const personalCode = Array.from({ length: 8 }, () =>
      'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789'.charAt(Math.floor(Math.random() * 33))
    ).join('');

    const { data: inserted, error: insertErr } = await supabase
      .from('gd_structure_access_codes')
      .insert({
        structure_id: structureId,
        code: personalCode,
        role,
        email: emailNorm,
        prenom: prenom?.trim() || null,
        nom: nom?.trim() || null,
        active: false,
        invitation_token: invitationToken,
        invitation_expires_at: invitationExpiresAt,
        invited_by_email: resolved.email || 'direction-code',
      })
      .select('id')
      .single();

    if (insertErr || !inserted) {
      // Violation UNIQUE (structure_id, email) → 409 explicite
      if (insertErr?.code === '23505') {
        return NextResponse.json(
          { error: { code: 'ALREADY_INVITED', message: 'Cet email est déjà invité sur cette structure.' } },
          { status: 409 }
        );
      }
      console.error('[invite] insert error:', insertErr?.message);
      return NextResponse.json({ error: { code: 'INSERT_ERROR' } }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'https://app.groupeetdecouverte.fr';
    const activationUrl = `${baseUrl}/structure/activate?token=${invitationToken}`;

    const emailResult = await sendTeamMemberInvite({
      to: emailNorm,
      prenom: prenom?.trim() || emailNorm.split('@')[0],
      structureName: (resolved.structure.name as string) || 'votre structure',
      role: role as InviteRole,
      activationUrl,
      invitedBy: resolved.email || 'Direction',
    });
    const emailSent = emailResult !== null;

    await auditLog(supabase, {
      action: 'create',
      resourceType: 'structure',
      resourceId: structureId,
      actorType: 'referent',
      actorId: resolved.email || `direction-code:${code.slice(0, 4)}…`,
      ipAddress: getStructureClientIp(req),
      metadata: { type: 'team_invite', invited_email: emailNorm, role, email_sent: emailSent },
    });

    return NextResponse.json({ ok: true, memberId: inserted.id, emailSent }, { status: 201 });
  } catch (err) {
    console.error('POST /structure/[code]/invite error:', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test — doit passer**

Run: `npx jest tests/api/structure-invite.test.ts`
Expected: PASS 5 tests

- [ ] **Step 5: Commit**

```bash
git add app/api/structure/[code]/invite/route.ts tests/api/structure-invite.test.ts
git commit -m "feat(team-invite): POST invite direction → crée row + envoie email activation"
git push origin main
```

---

## Task 6 : GET /api/structure/[code]/team

**Files:**
- Create: `app/api/structure/[code]/team/route.ts`
- Test: `tests/api/structure-team.test.ts`

- [ ] **Step 1: Écrire le test**

```typescript
// tests/api/structure-team.test.ts
import { GET } from '@/app/api/structure/[code]/team/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/structure');
jest.mock('@/lib/supabase-server');
jest.mock('@/lib/rate-limit-structure', () => ({
  structureRateLimitGuard: jest.fn().mockResolvedValue(null),
  getStructureClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));
jest.mock('@/lib/audit-log', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

import { resolveCodeToStructure } from '@/lib/structure';
import { getSupabaseAdmin } from '@/lib/supabase-server';

describe('GET /api/structure/[code]/team', () => {
  beforeEach(() => jest.clearAllMocks());

  test('403 si pas direction', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1' }, role: 'cds', roles: ['cds'], email: null,
    });
    const res = await GET(new NextRequest('http://localhost/api/structure/ABCDEFGHIJ/team'),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ' }) });
    expect(res.status).toBe(403);
  });

  test('200 liste membres pour direction', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1' }, role: 'direction', roles: ['direction'], email: 'd@x.fr',
    });
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({
              data: [
                { id: 'm1', email: 'sec@x.fr', role: 'secretariat', active: true, activated_at: '2026-04-17T10:00:00Z', prenom: 'Marie', nom: 'Dupont' },
                { id: 'm2', email: 'edu@x.fr', role: 'educateur', active: false, activated_at: null, prenom: null, nom: null, invitation_expires_at: '2026-04-19T10:00:00Z' },
              ],
              error: null,
            }),
          }),
        }),
      }),
    });
    const res = await GET(new NextRequest('http://localhost/api/structure/ABCDEFGHIJ/team'),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members).toHaveLength(2);
    expect(body.members[0].status).toBe('active');
    expect(body.members[1].status).toBe('pending');
  });
});
```

- [ ] **Step 2: Run test — doit échouer**

Run: `npx jest tests/api/structure-team.test.ts`
Expected: FAIL module not found

- [ ] **Step 3: Implémenter la route**

```typescript
// app/api/structure/[code]/team/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { resolveCodeToStructure } from '@/lib/structure';
import { auditLog } from '@/lib/audit-log';
import { structureRateLimitGuard, getStructureClientIp } from '@/lib/rate-limit-structure';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const rateLimited = await structureRateLimitGuard(req);
    if (rateLimited) return rateLimited;

    const { code } = await params;
    const resolved = await resolveCodeToStructure(code);
    if (!resolved || resolved.role !== 'direction') {
      return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('gd_structure_access_codes')
      .select('id, email, role, active, activated_at, prenom, nom, invitation_expires_at, invited_by_email, created_at')
      .eq('structure_id', resolved.structure.id as string)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[team GET] error:', error.message);
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
    }

    const now = Date.now();
    const members = (data ?? []).map((m) => ({
      id: m.id,
      email: m.email,
      role: m.role,
      prenom: m.prenom,
      nom: m.nom,
      invited_by_email: m.invited_by_email,
      created_at: m.created_at,
      activated_at: m.activated_at,
      status:
        !m.active && !m.activated_at && m.invitation_expires_at && new Date(m.invitation_expires_at).getTime() < now
          ? 'expired'
          : !m.active
          ? 'pending'
          : 'active',
    }));

    await auditLog(supabase, {
      action: 'read',
      resourceType: 'structure',
      resourceId: resolved.structure.id as string,
      actorType: 'referent',
      actorId: resolved.email || null,
      ipAddress: getStructureClientIp(req),
      metadata: { type: 'team_list' },
    });

    return NextResponse.json({ members });
  } catch (err) {
    console.error('GET /structure/[code]/team error:', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test — doit passer**

Run: `npx jest tests/api/structure-team.test.ts`
Expected: PASS 2 tests

- [ ] **Step 5: Commit**

```bash
git add app/api/structure/[code]/team/route.ts tests/api/structure-team.test.ts
git commit -m "feat(team-invite): GET liste équipe avec statuts pending/active/expired"
git push origin main
```

---

## Task 7 : POST /team/[memberId]/revoke

**Files:**
- Create: `app/api/structure/[code]/team/[memberId]/revoke/route.ts`
- Test: `tests/api/structure-team-revoke.test.ts`

- [ ] **Step 1: Écrire le test**

```typescript
// tests/api/structure-team-revoke.test.ts
import { POST } from '@/app/api/structure/[code]/team/[memberId]/revoke/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/structure');
jest.mock('@/lib/supabase-server');
jest.mock('@/lib/rate-limit-structure', () => ({
  structureRateLimitGuard: jest.fn().mockResolvedValue(null),
  getStructureClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));
jest.mock('@/lib/audit-log', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

import { resolveCodeToStructure } from '@/lib/structure';
import { getSupabaseAdmin } from '@/lib/supabase-server';

const mkReq = () => new NextRequest('http://localhost/x', { method: 'POST' });

describe('POST team/[memberId]/revoke', () => {
  beforeEach(() => jest.clearAllMocks());

  test('403 si pas direction', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1' }, role: 'cds', roles: ['cds'], email: null,
    });
    const res = await POST(mkReq(),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ', memberId: 'm1' }) });
    expect(res.status).toBe(403);
  });

  test('404 si member introuvable dans la structure', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1' }, role: 'direction', roles: ['direction'], email: 'd@x.fr',
    });
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }),
      }),
    });
    const res = await POST(mkReq(),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ', memberId: 'm-missing' }) });
    expect(res.status).toBe(404);
  });

  test('200 révoque le membre', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1' }, role: 'direction', roles: ['direction'], email: 'd@x.fr',
    });
    const fromMock = jest.fn();
    (getSupabaseAdmin as jest.Mock).mockReturnValue({ from: fromMock });
    fromMock
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'm1', email: 'sec@x.fr', role: 'secretariat' } }) }) }) }) })
      .mockReturnValueOnce({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) });
    const res = await POST(mkReq(),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ', memberId: 'm1' }) });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test — doit échouer**

Run: `npx jest tests/api/structure-team-revoke.test.ts`
Expected: FAIL module not found

- [ ] **Step 3: Implémenter la route**

```typescript
// app/api/structure/[code]/team/[memberId]/revoke/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { resolveCodeToStructure } from '@/lib/structure';
import { auditLog } from '@/lib/audit-log';
import { structureRateLimitGuard, getStructureClientIp } from '@/lib/rate-limit-structure';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; memberId: string }> }
) {
  try {
    const rateLimited = await structureRateLimitGuard(req);
    if (rateLimited) return rateLimited;

    const { code, memberId } = await params;

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(memberId)) {
      return NextResponse.json({ error: { code: 'INVALID_ID' } }, { status: 400 });
    }

    const resolved = await resolveCodeToStructure(code);
    if (!resolved || resolved.role !== 'direction') {
      return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const structureId = resolved.structure.id as string;

    const { data: member } = await supabase
      .from('gd_structure_access_codes')
      .select('id, email, role')
      .eq('id', memberId)
      .eq('structure_id', structureId)
      .maybeSingle();

    if (!member) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

    const { error: updateErr } = await supabase
      .from('gd_structure_access_codes')
      .update({ active: false, invitation_token: null, invitation_expires_at: null })
      .eq('id', memberId);

    if (updateErr) {
      console.error('[team revoke] error:', updateErr.message);
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
    }

    await auditLog(supabase, {
      action: 'update',
      resourceType: 'structure',
      resourceId: structureId,
      actorType: 'referent',
      actorId: resolved.email || null,
      ipAddress: getStructureClientIp(req),
      metadata: { type: 'team_revoke', member_email: member.email, member_role: member.role },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST revoke error:', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test — doit passer**

Run: `npx jest tests/api/structure-team-revoke.test.ts`
Expected: PASS 3 tests

- [ ] **Step 5: Commit**

```bash
git add app/api/structure/[code]/team/[memberId]/revoke/route.ts tests/api/structure-team-revoke.test.ts
git commit -m "feat(team-invite): POST revoke désactive membre + invalide token invitation"
git push origin main
```

---

## Task 8 : POST /team/[memberId]/reinvite

**Files:**
- Create: `app/api/structure/[code]/team/[memberId]/reinvite/route.ts`
- Test: `tests/api/structure-team-reinvite.test.ts`

- [ ] **Step 1: Écrire le test**

```typescript
// tests/api/structure-team-reinvite.test.ts
import { POST } from '@/app/api/structure/[code]/team/[memberId]/reinvite/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/structure');
jest.mock('@/lib/supabase-server');
jest.mock('@/lib/email');
jest.mock('@/lib/rate-limit-structure', () => ({
  structureRateLimitGuard: jest.fn().mockResolvedValue(null),
  getStructureClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));
jest.mock('@/lib/audit-log', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

import { resolveCodeToStructure } from '@/lib/structure';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendTeamMemberInvite } from '@/lib/email';

const mkReq = () => new NextRequest('http://localhost/x', { method: 'POST' });

describe('POST team/[memberId]/reinvite', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 si membre déjà activé', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1', name: 'S' }, role: 'direction', roles: ['direction'], email: 'd@x.fr',
    });
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({
        data: { id: 'm1', email: 'sec@x.fr', role: 'secretariat', activated_at: '2026-04-01T00:00:00Z', prenom: 'Marie' },
      }) }) }) }) }),
    });
    const res = await POST(mkReq(),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ', memberId: '00000000-0000-4000-8000-000000000001' }) });
    expect(res.status).toBe(400);
  });

  test('200 regen token + resend email', async () => {
    (resolveCodeToStructure as jest.Mock).mockResolvedValue({
      structure: { id: 's1', name: 'MECS' }, role: 'direction', roles: ['direction'], email: 'd@x.fr',
    });
    const fromMock = jest.fn();
    (getSupabaseAdmin as jest.Mock).mockReturnValue({ from: fromMock });
    fromMock
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({
        data: { id: 'm1', email: 'sec@x.fr', role: 'secretariat', activated_at: null, prenom: 'Marie' },
      }) }) }) }) })
      .mockReturnValueOnce({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) });
    (sendTeamMemberInvite as jest.Mock).mockResolvedValue({ id: 'eid' });
    const res = await POST(mkReq(),
      { params: Promise.resolve({ code: 'ABCDEFGHIJ', memberId: '00000000-0000-4000-8000-000000000001' }) });
    expect(res.status).toBe(200);
    expect(sendTeamMemberInvite).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — doit échouer**

Run: `npx jest tests/api/structure-team-reinvite.test.ts`
Expected: FAIL module not found

- [ ] **Step 3: Implémenter la route**

```typescript
// app/api/structure/[code]/team/[memberId]/reinvite/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { resolveCodeToStructure } from '@/lib/structure';
import { auditLog } from '@/lib/audit-log';
import { structureRateLimitGuard, getStructureClientIp } from '@/lib/rate-limit-structure';
import { generateInvitationToken, computeInvitationExpiry } from '@/lib/invitation-token';
import { sendTeamMemberInvite } from '@/lib/email';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; memberId: string }> }
) {
  try {
    const rateLimited = await structureRateLimitGuard(req);
    if (rateLimited) return rateLimited;

    const { code, memberId } = await params;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(memberId)) {
      return NextResponse.json({ error: { code: 'INVALID_ID' } }, { status: 400 });
    }

    const resolved = await resolveCodeToStructure(code);
    if (!resolved || resolved.role !== 'direction') {
      return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const structureId = resolved.structure.id as string;

    const { data: member } = await supabase
      .from('gd_structure_access_codes')
      .select('id, email, role, activated_at, prenom')
      .eq('id', memberId)
      .eq('structure_id', structureId)
      .maybeSingle();

    if (!member) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

    if (member.activated_at) {
      return NextResponse.json(
        { error: { code: 'ALREADY_ACTIVATED', message: 'Membre déjà activé. Utilisez "révoquer" pour retirer son accès.' } },
        { status: 400 }
      );
    }

    const newToken = generateInvitationToken();
    const newExpiry = computeInvitationExpiry();

    const { error: updateErr } = await supabase
      .from('gd_structure_access_codes')
      .update({ invitation_token: newToken, invitation_expires_at: newExpiry })
      .eq('id', memberId);

    if (updateErr) {
      console.error('[reinvite] update error:', updateErr.message);
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'https://app.groupeetdecouverte.fr';
    const activationUrl = `${baseUrl}/structure/activate?token=${newToken}`;

    await sendTeamMemberInvite({
      to: member.email as string,
      prenom: (member.prenom as string) || (member.email as string).split('@')[0],
      structureName: (resolved.structure.name as string) || 'votre structure',
      role: member.role as 'secretariat' | 'educateur',
      activationUrl,
      invitedBy: resolved.email || 'Direction',
    });

    await auditLog(supabase, {
      action: 'update',
      resourceType: 'structure',
      resourceId: structureId,
      actorType: 'referent',
      actorId: resolved.email || null,
      ipAddress: getStructureClientIp(req),
      metadata: { type: 'team_reinvite', member_email: member.email, member_role: member.role },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST reinvite error:', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test — doit passer**

Run: `npx jest tests/api/structure-team-reinvite.test.ts`
Expected: PASS 2 tests

- [ ] **Step 5: Commit**

```bash
git add app/api/structure/[code]/team/[memberId]/reinvite/route.ts tests/api/structure-team-reinvite.test.ts
git commit -m "feat(team-invite): POST reinvite regen token + resend email invitation"
git push origin main
```

---

## Task 9 : POST /api/auth/activate-invitation

**Files:**
- Create: `app/api/auth/activate-invitation/route.ts`
- Test: `tests/api/activate-invitation.test.ts`

- [ ] **Step 1: Écrire le test**

```typescript
// tests/api/activate-invitation.test.ts
import { POST } from '@/app/api/auth/activate-invitation/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/supabase-server');
jest.mock('@/lib/password');
jest.mock('@/lib/rate-limit', () => ({
  isRateLimited: jest.fn().mockResolvedValue(false),
  getClientIpFromHeaders: jest.fn().mockReturnValue('127.0.0.1'),
}));
jest.mock('@/lib/audit-log', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

import { getSupabaseAdmin } from '@/lib/supabase-server';
import { hashPassword, isPasswordStrong } from '@/lib/password';

const mkReq = (body: unknown) =>
  new NextRequest('http://localhost/api/auth/activate-invitation', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  });

describe('POST /api/auth/activate-invitation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isPasswordStrong as jest.Mock).mockReturnValue({ ok: true });
  });

  test('400 si token manquant', async () => {
    const res = await POST(mkReq({ password: 'abc' }));
    expect(res.status).toBe(400);
  });

  test('400 si password faible', async () => {
    (isPasswordStrong as jest.Mock).mockReturnValue({ ok: false, reason: 'trop court' });
    const res = await POST(mkReq({ token: '00000000-0000-4000-8000-000000000001', password: 'x' }));
    expect(res.status).toBe(400);
  });

  test('404 si token introuvable', async () => {
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }),
    });
    const res = await POST(mkReq({ token: '00000000-0000-4000-8000-000000000001', password: 'Password123!' }));
    expect(res.status).toBe(404);
  });

  test('410 si token expiré', async () => {
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({
        data: { id: 'm1', email: 'x@y.fr', invitation_expires_at: '2020-01-01T00:00:00Z', activated_at: null },
      }) }) }) }),
    });
    const res = await POST(mkReq({ token: '00000000-0000-4000-8000-000000000001', password: 'Password123!' }));
    expect(res.status).toBe(410);
  });

  test('200 activation réussie', async () => {
    const fromMock = jest.fn();
    (getSupabaseAdmin as jest.Mock).mockReturnValue({ from: fromMock });
    fromMock
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({
        data: {
          id: 'm1', email: 'x@y.fr', role: 'secretariat',
          invitation_expires_at: new Date(Date.now() + 3600_000).toISOString(),
          activated_at: null, structure_id: 's1',
        },
      }) }) }) })
      .mockReturnValueOnce({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) });
    (hashPassword as jest.Mock).mockResolvedValue('$2a$12$hash');
    const res = await POST(mkReq({ token: '00000000-0000-4000-8000-000000000001', password: 'Password123!', prenom: 'Marie', nom: 'Dupont' }));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test — doit échouer**

Run: `npx jest tests/api/activate-invitation.test.ts`
Expected: FAIL module not found

- [ ] **Step 3: Implémenter la route**

```typescript
// app/api/auth/activate-invitation/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { hashPassword, isPasswordStrong } from '@/lib/password';
import { isInvitationExpired } from '@/lib/invitation-token';
import { auditLog } from '@/lib/audit-log';
import { isRateLimited, getClientIpFromHeaders } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIpFromHeaders(req.headers);
    if (await isRateLimited('activate', ip, 10, 10)) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Trop de tentatives.' } },
        { status: 429, headers: { 'Retry-After': '600' } }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: { code: 'INVALID_BODY' } }, { status: 400 });

    const { token, password, prenom, nom } = body as {
      token?: string; password?: string; prenom?: string; nom?: string;
    };

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!token || typeof token !== 'string' || !UUID_RE.test(token)) {
      return NextResponse.json({ error: { code: 'INVALID_TOKEN' } }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: { code: 'PASSWORD_REQUIRED' } }, { status: 400 });
    }

    const strength = isPasswordStrong(password);
    if (!strength.ok) {
      return NextResponse.json({ error: { code: 'WEAK_PASSWORD', message: strength.reason } }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: member } = await supabase
      .from('gd_structure_access_codes')
      .select('id, email, role, invitation_expires_at, activated_at, structure_id, gd_structures!inner(status)')
      .eq('invitation_token', token)
      .maybeSingle();

    if (!member) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

    const structureStatus = (member as unknown as { gd_structures?: { status: string } }).gd_structures?.status;
    if (structureStatus !== 'active') {
      return NextResponse.json(
        { error: { code: 'STRUCTURE_INACTIVE', message: 'La structure associée n\'est plus active.' } },
        { status: 403 }
      );
    }

    if (member.activated_at) {
      return NextResponse.json({ error: { code: 'ALREADY_ACTIVATED' } }, { status: 409 });
    }

    if (isInvitationExpired(member.invitation_expires_at as string | null)) {
      return NextResponse.json(
        { error: { code: 'TOKEN_EXPIRED', message: 'Invitation expirée. Demandez une réinvitation à la direction.' } },
        { status: 410 }
      );
    }

    const passwordHash = await hashPassword(password);

    // UPDATE atomique : .eq('invitation_token', token) garantit qu'une requête concurrente
    // ayant déjà consommé le token ne puisse pas re-activer. count === 0 si token déjà null.
    const { data: updated, error: updateErr } = await supabase
      .from('gd_structure_access_codes')
      .update({
        password_hash: passwordHash,
        activated_at: new Date().toISOString(),
        active: true,
        invitation_token: null,
        invitation_expires_at: null,
        prenom: prenom?.trim() || null,
        nom: nom?.trim() || null,
      })
      .eq('id', member.id)
      .eq('invitation_token', token)
      .select('id');

    if (updateErr) {
      console.error('[activate] update error:', updateErr.message);
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: { code: 'TOKEN_ALREADY_CONSUMED', message: 'Cette invitation a déjà été utilisée.' } },
        { status: 409 }
      );
    }

    await auditLog(supabase, {
      action: 'update',
      resourceType: 'structure',
      resourceId: member.structure_id as string,
      actorType: 'referent',
      actorId: member.email as string,
      ipAddress: ip,
      metadata: { type: 'team_activate', role: member.role },
    });

    return NextResponse.json({ ok: true, email: member.email });
  } catch (err) {
    console.error('POST activate-invitation error:', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test — doit passer**

Run: `npx jest tests/api/activate-invitation.test.ts`
Expected: PASS 5 tests

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/activate-invitation/route.ts tests/api/activate-invitation.test.ts
git commit -m "feat(team-invite): POST activate-invitation — set password + active"
git push origin main
```

---

## Task 10 : POST /api/auth/structure-login (email + password)

**Files:**
- Create: `app/api/auth/structure-login/route.ts`
- Test: `tests/api/structure-login.test.ts`

- [ ] **Step 1: Écrire le test**

```typescript
// tests/api/structure-login.test.ts
import { POST } from '@/app/api/auth/structure-login/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/supabase-server');
jest.mock('@/lib/password');
jest.mock('@/lib/rate-limit', () => ({
  isRateLimited: jest.fn().mockResolvedValue(false),
  getClientIpFromHeaders: jest.fn().mockReturnValue('127.0.0.1'),
}));
jest.mock('@/lib/audit-log', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

import { getSupabaseAdmin } from '@/lib/supabase-server';
import { verifyPassword } from '@/lib/password';

const mkReq = (body: unknown) =>
  new NextRequest('http://localhost/api/auth/structure-login', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  });

describe('POST /api/auth/structure-login', () => {
  beforeAll(() => { process.env.NEXTAUTH_SECRET = 'test-secret-min-32-chars-long-xxxx'; });
  beforeEach(() => jest.clearAllMocks());

  test('400 si email invalide', async () => {
    const res = await POST(mkReq({ email: 'pas-email', password: 'x' }));
    expect(res.status).toBe(400);
  });

  test('401 si user introuvable', async () => {
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }) }),
    });
    const res = await POST(mkReq({ email: 'x@y.fr', password: 'abc' }));
    expect(res.status).toBe(401);
  });

  test('401 si password wrong', async () => {
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({
        data: {
          id: 'm1', email: 'x@y.fr', role: 'secretariat', password_hash: '$2a$12$xxx',
          activated_at: '2026-04-01T00:00:00Z', active: true,
          structure_id: 's1',
          gd_structures: { id: 's1', name: 'S', status: 'active' },
        },
      }) }) }) }) }),
    });
    (verifyPassword as jest.Mock).mockResolvedValue(false);
    const res = await POST(mkReq({ email: 'x@y.fr', password: 'wrong' }));
    expect(res.status).toBe(401);
  });

  test('200 + cookie si login OK', async () => {
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({
        data: {
          id: 'm1', email: 'x@y.fr', role: 'secretariat', password_hash: '$2a$12$xxx',
          activated_at: '2026-04-01T00:00:00Z', active: true,
          structure_id: 's1',
          gd_structures: { id: 's1', name: 'MECS', status: 'active' },
        },
      }) }) }) }) }),
    });
    (verifyPassword as jest.Mock).mockResolvedValue(true);
    const res = await POST(mkReq({ email: 'x@y.fr', password: 'good' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('gd_pro_session=');
  });
});
```

- [ ] **Step 2: Run test — doit échouer**

Run: `npx jest tests/api/structure-login.test.ts`
Expected: FAIL module not found

- [ ] **Step 3: Implémenter la route**

```typescript
// app/api/auth/structure-login/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { verifyPassword } from '@/lib/password';
import { auditLog } from '@/lib/audit-log';
import { isRateLimited, getClientIpFromHeaders } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIpFromHeaders(req.headers);
    if (await isRateLimited('struct-login', ip, 5, 15)) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Trop de tentatives. Réessayez dans 15 minutes.' } },
        { status: 429, headers: { 'Retry-After': '900' } }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: { code: 'INVALID_BODY' } }, { status: 400 });

    const { email, password } = body as { email?: string; password?: string };
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return NextResponse.json({ error: { code: 'INVALID_EMAIL' } }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: { code: 'PASSWORD_REQUIRED' } }, { status: 400 });
    }

    const emailNorm = email.trim().toLowerCase();
    const supabase = getSupabaseAdmin();

    const { data: member } = await supabase
      .from('gd_structure_access_codes')
      .select('id, email, role, code, password_hash, activated_at, active, structure_id, gd_structures!inner(id, name, status, code)')
      .eq('email', emailNorm)
      .eq('active', true)
      .maybeSingle();

    const memberWithStructure = member as {
      id: string; email: string; role: string; code: string; password_hash: string | null;
      activated_at: string | null; active: boolean; structure_id: string;
      gd_structures: { id: string; name: string; status: string; code: string };
    } | null;

    if (!memberWithStructure || !memberWithStructure.activated_at || memberWithStructure.gd_structures?.status !== 'active') {
      return NextResponse.json({ error: { code: 'INVALID_CREDENTIALS' } }, { status: 401 });
    }

    const passwordOk = await verifyPassword(password, memberWithStructure.password_hash);
    if (!passwordOk) {
      // RGPD #1 : pas d'email en clair dans metadata. Hash partiel pour corrélation IP-aware.
      const { createHash } = await import('crypto');
      const emailHash = createHash('sha256').update(emailNorm).digest('hex').slice(0, 16);
      await auditLog(supabase, {
        action: 'update',
        resourceType: 'structure',
        resourceId: memberWithStructure.structure_id,
        actorType: 'system',
        ipAddress: ip,
        metadata: { type: 'structure_login_failed', email_hash: emailHash },
      });
      return NextResponse.json({ error: { code: 'INVALID_CREDENTIALS' } }, { status: 401 });
    }

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error('[structure-login] NEXTAUTH_SECRET manquant');
      return NextResponse.json({ error: { code: 'CONFIG_ERROR' } }, { status: 500 });
    }

    // structureCode : code structure (pas code personnel) pour compat ProSessionPayload
    // utilisé par /api/inscriptions et /api/pro/propositions (callers existants).
    const structureCode = memberWithStructure.gd_structures.code;

    const encodedSecret = new TextEncoder().encode(secret);
    const token = await new SignJWT({
      role: 'pro',
      type: 'pro_session',
      email: memberWithStructure.email,
      structureCode,
      structureRole: memberWithStructure.role,
      structureId: memberWithStructure.structure_id,
      structureName: memberWithStructure.gd_structures.name,
      jti: crypto.randomUUID(),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('8h')
      .sign(encodedSecret);

    const response = NextResponse.json({
      ok: true,
      email: memberWithStructure.email,
      role: memberWithStructure.role,
      structureName: memberWithStructure.gd_structures.name,
    });

    response.cookies.set('gd_pro_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 8 * 3600,
    });

    await auditLog(supabase, {
      action: 'update',
      resourceType: 'structure',
      resourceId: memberWithStructure.structure_id,
      actorType: 'referent',
      actorId: memberWithStructure.email,
      ipAddress: ip,
      metadata: { type: 'structure_login_success', role: memberWithStructure.role },
    });

    return response;
  } catch (err) {
    console.error('POST structure-login error:', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test — doit passer**

Run: `npx jest tests/api/structure-login.test.ts`
Expected: PASS 4 tests

- [ ] **Step 5: Étendre ProSessionPayload (callers existants de verifyProSession)**

Lire `lib/auth-middleware.ts`, trouver l'interface `ProSessionPayload` et ajouter les champs optionnels :

```typescript
// Modification dans lib/auth-middleware.ts
export interface ProSessionPayload {
  role: 'pro';
  email: string;
  structureCode: string;
  structureName: string;
  type: 'pro_session';
  jti?: string;
  // Nouveau — team-invite login (optionnel pour préserver compat)
  structureRole?: 'secretariat' | 'educateur' | 'direction' | 'cds';
  structureId?: string;
}
```

Run: `npx tsc --noEmit`
Expected: 0 erreur (tous les callers existants de `verifyProSession` utilisent `structureCode` obligatoire, préservé)

- [ ] **Step 6: Commit**

```bash
git add app/api/auth/structure-login/route.ts tests/api/structure-login.test.ts lib/auth-middleware.ts
git commit -m "feat(team-invite): POST structure-login + extend ProSessionPayload"
git push origin main
```

---

## Task 11 : UI activation page

**Files:**
- Create: `app/structure/activate/page.tsx` (server wrapper)
- Create: `app/structure/activate/ActivateClient.tsx` (client component)

- [ ] **Step 1: Créer server wrapper**

```typescript
// app/structure/activate/page.tsx
export const dynamic = 'force-dynamic';
import ActivateClient from './ActivateClient';

export default function ActivatePage() {
  return <ActivateClient />;
}
```

- [ ] **Step 2: Créer client component**

```typescript
// app/structure/activate/ActivateClient.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function ActivateClient() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) setError('Lien invalide : token manquant.');
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 12) { setError('Au moins 12 caractères.'); return; }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/activate-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, prenom: prenom.trim() || undefined, nom: nom.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || 'Impossible d\'activer ce compte.');
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push('/structure/login'), 2000);
    } catch {
      setError('Erreur réseau. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-card p-8 max-w-md text-center">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-primary mb-2">Compte activé</h1>
          <p className="text-gray-600 mb-4">Vous allez être redirigé vers la connexion…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-card p-8 max-w-md w-full">
        <h1 className="text-xl font-bold text-primary mb-2">Activer votre accès</h1>
        <p className="text-sm text-gray-600 mb-6">Définissez un mot de passe personnel. Ne le partagez avec personne.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Prénom</label>
              <input type="text" value={prenom} onChange={e => setPrenom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Nom</label>
              <input type="text" value={nom} onChange={e => setNom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Mot de passe <span className="text-red-500">*</span></label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary" />
            <p className="text-xs text-gray-400 mt-1">12 caractères min, 1 majuscule, 1 minuscule, 1 chiffre.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Confirmer <span className="text-red-500">*</span></label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary" />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm" role="alert">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <button type="submit" disabled={loading || !token}
            className="w-full py-3 bg-secondary text-white rounded-pill font-medium hover:bg-secondary/90 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Activation…' : 'Activer mon compte'}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          Lien expiré ? <Link href="/structure/login" className="underline">Demandez une réinvitation</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build pour vérifier**

Run: `npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 4: Commit**

```bash
git add app/structure/activate/
git commit -m "feat(team-invite): UI activation avec validation password force"
git push origin main
```

---

## Task 12 : UI onglet Équipe dans dashboard direction

**Files:**
- Create: `components/structure/StructureTeamTab.tsx`
- Modify: `app/structure/[code]/page.tsx` (ajout onglet)

- [ ] **Step 1: Créer le composant StructureTeamTab**

```typescript
// components/structure/StructureTeamTab.tsx
'use client';

import { useEffect, useState } from 'react';
import { Loader2, UserPlus, Trash2, Send, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface Member {
  id: string;
  email: string;
  role: 'secretariat' | 'educateur';
  prenom: string | null;
  nom: string | null;
  status: 'pending' | 'active' | 'expired';
  activated_at: string | null;
  created_at: string;
}

interface Props {
  code: string;
}

export default function StructureTeamTab({ code }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePrenom, setInvitePrenom] = useState('');
  const [inviteRole, setInviteRole] = useState<'secretariat' | 'educateur'>('secretariat');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/structure/${code}/team`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.code || 'ERROR');
      setMembers(data.members || []);
    } catch {
      setError('Impossible de charger l\'équipe.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [code]);

  const invite = async () => {
    setInviting(true);
    setError('');
    try {
      const res = await fetch(`/api/structure/${code}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), prenom: invitePrenom.trim() || undefined, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || 'Erreur invitation');
        return;
      }
      setInviteEmail(''); setInvitePrenom(''); setInviteOpen(false);
      await load();
    } finally { setInviting(false); }
  };

  const revoke = async (id: string) => {
    if (!confirm('Révoquer cet accès ?')) return;
    const res = await fetch(`/api/structure/${code}/team/${id}/revoke`, { method: 'POST' });
    if (res.ok) await load();
  };

  const reinvite = async (id: string) => {
    const res = await fetch(`/api/structure/${code}/team/${id}/reinvite`, { method: 'POST' });
    if (res.ok) await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-primary">Équipe de la structure</h2>
        <button onClick={() => setInviteOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-secondary text-white rounded-pill text-sm font-medium hover:bg-secondary/90">
          <UserPlus className="w-4 h-4" /> Inviter
        </button>
      </div>

      {inviteOpen && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-primary">Nouvelle invitation</h3>
          <input type="email" placeholder="Email pro" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg" />
          <input type="text" placeholder="Prénom (optionnel)" value={invitePrenom} onChange={e => setInvitePrenom(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg" />
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value as 'secretariat' | 'educateur')}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg">
            <option value="secretariat">Secrétariat</option>
            <option value="educateur">Éducateur</option>
          </select>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setInviteOpen(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Annuler</button>
            <button onClick={invite} disabled={inviting || !inviteEmail}
              className="flex-1 py-2 bg-secondary text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {inviting ? 'Envoi…' : 'Envoyer l\'invitation'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : members.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">Aucun membre invité pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-4">
              <div>
                <p className="font-medium text-primary">
                  {m.prenom || m.nom ? `${m.prenom || ''} ${m.nom || ''}`.trim() : m.email}
                </p>
                <p className="text-xs text-gray-500">{m.email} · {m.role === 'secretariat' ? 'Secrétariat' : 'Éducateur'}</p>
              </div>
              <div className="flex items-center gap-3">
                {m.status === 'active' && <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full"><CheckCircle2 className="w-3 h-3" />Actif</span>}
                {m.status === 'pending' && <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-full"><Clock className="w-3 h-3" />En attente</span>}
                {m.status === 'expired' && <span className="flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-1 rounded-full"><XCircle className="w-3 h-3" />Expiré</span>}
                {m.status !== 'active' && (
                  <button onClick={() => reinvite(m.id)} title="Renvoyer invitation" className="text-primary hover:text-primary/80">
                    <Send className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => revoke(m.id)} title="Révoquer" className="text-red-600 hover:text-red-800">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2a: Lire le fichier pour identifier la structure exacte des Tabs**

```bash
Read /Users/laidhamoudi/Dev/GED_APP/app/structure/[code]/page.tsx
```

Repérer :
- Les imports `StructureAdminTab`, `StructureEduTab`, `StructureFacturesTab`
- Le composant `Tabs` (Radix ou équivalent) et ses `TabsTrigger` / `TabsContent`
- La variable de rôle (probablement `role` ou `userRole` — extraite de la réponse API)

- [ ] **Step 2b: Ajouter l'import StructureTeamTab**

Chercher la ligne `import StructureFacturesTab` et ajouter juste après :
```typescript
import StructureTeamTab from '@/components/structure/StructureTeamTab';
```

- [ ] **Step 2c: Ajouter le TabsTrigger conditionné au rôle direction**

Localiser l'endroit où les `TabsTrigger` sont rendus. Après le dernier `TabsTrigger` existant, ajouter :
```typescript
{role === 'direction' && (
  <TabsTrigger value="team">Équipe</TabsTrigger>
)}
```

- [ ] **Step 2d: Ajouter le TabsContent correspondant**

Localiser les `TabsContent`. Après le dernier, ajouter :
```typescript
{role === 'direction' && (
  <TabsContent value="team">
    <StructureTeamTab code={code} />
  </TabsContent>
)}
```

Note : si la variable dans le fichier s'appelle `userRole`, `resolvedRole`, etc., adapter. Si le code utilise un switcher différent (select, buttons) plutôt que Radix Tabs, adapter le pattern à la mise en forme existante tout en gardant la condition `role === 'direction'`.

- [ ] **Step 3: Build pour vérifier**

Run: `npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 4: Commit**

```bash
git add components/structure/StructureTeamTab.tsx app/structure/[code]/page.tsx
git commit -m "feat(team-invite): UI onglet Équipe direction — invite/revoke/reinvite"
git push origin main
```

---

## Task 13 : Test d'intégration runtime

**Files:**
- Tests runtime manuels via curl + MCP

- [ ] **Step 1: Démarrer dev server**

Run: `npm run dev`

- [ ] **Step 2: Récupérer un code directeur test**

Via MCP `execute_sql` :

```sql
SELECT s.code_directeur, s.name FROM gd_structures s
WHERE s.is_test = true AND s.code_directeur IS NOT NULL AND s.code_directeur_revoked_at IS NULL
LIMIT 1;
```

Noter la valeur de `code_directeur` (variable `DIRCODE`).

- [ ] **Step 3: Invite un membre de test**

```bash
RESP=$(curl -s -X POST "http://localhost:3000/api/structure/${DIRCODE}/invite" \
  -H "Content-Type: application/json" \
  -d '{"email":"test-team@example.com","prenom":"Marie","role":"secretariat"}')
echo "$RESP"
```

Expected: `{"ok":true,"memberId":"..."}` HTTP 201

- [ ] **Step 4: Vérifier la ligne DB**

Via MCP :

```sql
SELECT id, email, role, active, activated_at, invitation_token IS NOT NULL AS has_token
FROM gd_structure_access_codes
WHERE email = 'test-team@example.com';
```

Expected: `active=false`, `activated_at=null`, `has_token=true`

- [ ] **Step 5: Récupérer le token pour activer**

```sql
SELECT invitation_token FROM gd_structure_access_codes WHERE email = 'test-team@example.com';
```

Noter le token (variable `TOKEN`).

- [ ] **Step 6: Activer via route**

```bash
curl -s -X POST http://localhost:3000/api/auth/activate-invitation \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"${TOKEN}\",\"password\":\"TestPassword123!\",\"prenom\":\"Marie\",\"nom\":\"Dupont\"}"
```

Expected: `{"ok":true,"email":"test-team@example.com"}` HTTP 200

- [ ] **Step 7: Login via structure-login**

```bash
curl -s -c /tmp/team.txt -X POST http://localhost:3000/api/auth/structure-login \
  -H "Content-Type: application/json" \
  -d '{"email":"test-team@example.com","password":"TestPassword123!"}'
```

Expected: `{"ok":true,"email":"...","role":"secretariat","structureName":"..."}` HTTP 200 + cookie `gd_pro_session` posé

- [ ] **Step 8: Re-login avec mauvais password**

```bash
curl -s -X POST http://localhost:3000/api/auth/structure-login \
  -H "Content-Type: application/json" \
  -d '{"email":"test-team@example.com","password":"WRONG"}' \
  -w "\nHTTP=%{http_code}\n"
```

Expected: HTTP 401

- [ ] **Step 9: Révoquer via API direction**

```bash
# Récupérer memberId via DB, puis:
curl -s -X POST "http://localhost:3000/api/structure/${DIRCODE}/team/${MEMBER_ID}/revoke" \
  -w "\nHTTP=%{http_code}\n"
```

Expected: HTTP 200

- [ ] **Step 10: Vérifier révocation en DB**

```sql
SELECT active, invitation_token FROM gd_structure_access_codes WHERE id = '${MEMBER_ID}';
```

Expected: `active=false`, `invitation_token=null`

- [ ] **Step 11: Cleanup test data**

```sql
DELETE FROM gd_structure_access_codes WHERE email = 'test-team@example.com';
DELETE FROM gd_audit_log WHERE actor_id = 'test-team@example.com' OR metadata->>'invited_email' = 'test-team@example.com';
```

- [ ] **Step 12: Stop dev server**

Kill le process `npm run dev`

- [ ] **Step 13: Commit pas nécessaire (test runtime uniquement)**

Si tout vert, passer à la tâche suivante.

---

## Task 14 : Cross-review final + vérif non-régression

**Files:**
- Aucune modification

- [ ] **Step 1: Typecheck global**

Run: `npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 2: Run full test suite**

Run: `npm run test:unit`
Expected: All tests pass (y compris les tests existants non touchés)

- [ ] **Step 3: Build production**

Run: `npm run build`
Expected: Build réussit

- [ ] **Step 3bis: Test intégration cookie team-login vs callers de verifyProSession**

Runtime :
```bash
# Prérequis : structure test + invite + activate déjà fait via Task 13
# Récupérer cookie team
curl -s -c /tmp/team.txt -X POST http://localhost:3000/api/auth/structure-login \
  -H "Content-Type: application/json" \
  -d '{"email":"test-team@example.com","password":"TestPassword123!"}'

# Test 1 : POST /api/pro/propositions doit fonctionner avec cookie team
curl -s -b /tmp/team.txt -X POST http://localhost:3000/api/pro/propositions \
  -H "Content-Type: application/json" \
  -d '{"sejour_slug":"destination-soleil","session_date":"2026-07-04","city_departure":"toulon"}' \
  -w "\nHTTP=%{http_code}\n"
```

Expected : 201 (plus 400 si rate-limit déjà atteint — dans ce cas attendre 5 min et relancer)

```bash
# Test 2 : vérifier que la proposition créée a bien structure_nom non vide
# (si null → bug structureCode manquant → régression)
```

Via MCP execute_sql :
```sql
SELECT structure_nom, demandeur_email FROM gd_propositions_tarifaires
WHERE demandeur_email = 'test-team@example.com'
ORDER BY created_at DESC LIMIT 1;
```
Expected : `structure_nom` non vide, `demandeur_email = 'test-team@example.com'`

- [ ] **Step 4: Dispatch arch-impact-reviewer**

Lancer un agent `arch-impact-reviewer` avec le prompt :

```
Review des 13 tâches appliquées pour team-invitation-flow. Fichiers impactés :
- Migration 068_team_invitation_columns.sql
- lib/password.ts, lib/invitation-token.ts
- lib/email.ts (ajout sendTeamMemberInvite)
- app/api/structure/[code]/invite/route.ts
- app/api/structure/[code]/team/route.ts
- app/api/structure/[code]/team/[memberId]/revoke/route.ts
- app/api/structure/[code]/team/[memberId]/reinvite/route.ts
- app/api/auth/activate-invitation/route.ts
- app/api/auth/structure-login/route.ts
- app/structure/activate/page.tsx + ActivateClient.tsx
- components/structure/StructureTeamTab.tsx
- app/structure/[code]/page.tsx (ajout onglet)

Checks :
1. Pas de régression sur /api/structure/[code] GET existant (fallback code 6/10 toujours OK)
2. Cohérence resolveCodeToStructure — lit bien password_hash si présent ?
3. Verrouillage direction-only sur invite/team/revoke/reinvite
4. Audit log sur chaque action invite/activate/login
5. Rate-limit cohérent (struct-login 5/15, activate 10/10, invite via structureRateLimitGuard)
6. Gestion token expiré (410 vs 400 vs 404)
7. Password bcrypt rounds 12 (pas 10)
8. Cookie gd_pro_session 8h httpOnly secure sameSite strict

Green-light commit OUI/NON + liste exacte fixes si NON.
```

- [ ] **Step 5: Si green-light, annoncer fin de plan**

Si review OK, le plan est terminé. Toutes les tâches sont committées progressivement à chaque Task.

---

## Self-Review Notes

**Spec coverage** :
- ✅ Migration DB (Task 1)
- ✅ POST invite (Task 5)
- ✅ GET team (Task 6)
- ✅ POST revoke (Task 7)
- ✅ POST reinvite (Task 8)
- ✅ POST activate-invitation (Task 9)
- ✅ Login email+password (Task 10 — ajoute endpoint dédié au lieu de modifier resolveCodeToStructure pour préserver compat)
- ✅ UI onglet Équipe (Task 12)
- ✅ Email sendTeamMemberInvite (Task 4)
- ✅ Tests (dans chaque Task + Task 13 runtime + Task 14 arch review)

**Rôle par défaut** : `secretariat` + `educateur` uniquement invitables — CDS non couvert (reste via délégation existante comme indiqué dans le spec).

**RGPD** :
- Password bcrypt rounds 12 ✓
- Audit log sur invite/revoke/reinvite/activate/login ✓
- Rate-limit sur activate + structure-login ✓
- Mention "lien personnel" dans email ✓
- Cookie httpOnly + secure + sameSite strict ✓

**Non-régression** :
- `resolveCodeToStructure` non modifié → compat legacy préservée
- `/api/structure/[code]` GET inchangé
- `structure-login` est un nouveau endpoint, aucun caller existant

**Placeholder scan** : aucun "TODO", "TBD", "implement later" dans les steps. Tous les blocs de code sont complets.

**Type consistency** :
- `InviteRole = 'secretariat' | 'educateur'` utilisé cohéremment
- `VALID_ROLES` whitelist partout
- `member.role` cast explicite vers `InviteRole` dans les emails

**Effort estimé** : 1-1.5 jours pour un dev familier avec le repo. Chaque Task isolée et committable.
