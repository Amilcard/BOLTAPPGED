/**
 * @jest-environment node
 *
 * Tests sécurité — Contrôles d'accès admin (rôle insuffisant / session absente)
 *
 * Matrice :
 *  1. POST structures/merge sans auth → 403
 *  2. POST structures/merge EDITOR → 403 (ADMIN only)
 *  3. POST structures/merge VIEWER → 403 (ADMIN only)
 *  4. PATCH structures/link sans auth → 403
 *  5. PATCH structures/link VIEWER → 403 (EDITOR+ only)
 *  6. POST inscriptions/[id]/relance sans auth → 401
 *  7. GET admin/propositions sans auth → 401
 *  8. POST admin/propositions sans auth → 401
 *  9. PATCH admin/propositions sans auth → 401
 * 10. DELETE admin/propositions sans auth → 401
 * 11. POST structures/merge payload identique sourceId=targetId → 400 (auto-fusion interdite)
 * 12. POST structures/merge UUIDs invalides → 400 (injection UUID)
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-key';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-key!';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockFrom = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  getSupabase: () => ({ from: mockFrom }),
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

jest.mock('@/lib/email', () => ({
  sendRappelDossierIncomplet: jest.fn().mockResolvedValue(undefined),
  sendRelanceAdminNotification: jest.fn().mockResolvedValue(undefined),
}));

import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { POST as mergePost } from '@/app/api/admin/structures/merge/route';
import { PATCH as linkPatch } from '@/app/api/admin/structures/link/route';
import { POST as relancePost } from '@/app/api/admin/inscriptions/[id]/relance/route';
import { GET as propGet, POST as propPost, PATCH as propPatch, DELETE as propDelete } from '@/app/api/admin/propositions/route';

// ── Tokens ────────────────────────────────────────────────────────────────────

const SECRET = process.env.NEXTAUTH_SECRET!;
const ADMIN_TOKEN = jwt.sign({ userId: 'a', email: 'admin@ged.fr', role: 'ADMIN' }, SECRET, { expiresIn: '1h' });
const EDITOR_TOKEN = jwt.sign({ userId: 'e', email: 'editor@ged.fr', role: 'EDITOR' }, SECRET, { expiresIn: '1h' });
const VIEWER_TOKEN = jwt.sign({ userId: 'v', email: 'viewer@ged.fr', role: 'VIEWER' }, SECRET, { expiresIn: '1h' });

const UUID_1 = 'aaa00000-0000-0000-0000-000000000001';
const UUID_2 = 'bbb00000-0000-0000-0000-000000000002';
const INSCRIPTION_ID = 'ccc00000-0000-0000-0000-000000000003';

// ── Helpers ───────────────────────────────────────────────────────────────────

function req(url: string, opts: { method?: string; token?: string; body?: object } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  return new NextRequest(`http://localhost${url}`, {
    method: opts.method ?? 'GET',
    headers,
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
}

// ── Tests — POST /api/admin/structures/merge ──────────────────────────────────

describe('POST /api/admin/structures/merge — ADMIN only', () => {
  const BODY = { sourceId: UUID_1, targetId: UUID_2 };

  it('1. sans auth → 403', async () => {
    const res = await mergePost(req('/api/admin/structures/merge', { method: 'POST', body: BODY }));
    expect(res.status).toBe(403);
  });

  it('2. EDITOR → 403 (cette action est réservée ADMIN)', async () => {
    const res = await mergePost(req('/api/admin/structures/merge', { method: 'POST', token: EDITOR_TOKEN, body: BODY }));
    expect(res.status).toBe(403);
  });

  it('3. VIEWER → 403', async () => {
    const res = await mergePost(req('/api/admin/structures/merge', { method: 'POST', token: VIEWER_TOKEN, body: BODY }));
    expect(res.status).toBe(403);
  });

  it('11. sourceId === targetId → 400 (auto-fusion interdite)', async () => {
    const res = await mergePost(req('/api/admin/structures/merge', {
      method: 'POST', token: ADMIN_TOKEN,
      body: { sourceId: UUID_1, targetId: UUID_1 },
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('SAME_ID');
  });

  it('12. UUIDs invalides dans le payload → 400 (injection UUID)', async () => {
    const res = await mergePost(req('/api/admin/structures/merge', {
      method: 'POST', token: ADMIN_TOKEN,
      body: { sourceId: '../../etc/passwd', targetId: UUID_1 },
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_ID');
  });
});

// ── Tests — PATCH /api/admin/structures/link ──────────────────────────────────

describe('PATCH /api/admin/structures/link — EDITOR+ only', () => {
  const BODY = { inscriptionId: INSCRIPTION_ID, structureId: UUID_1 };

  it('4. sans auth → 403', async () => {
    const res = await linkPatch(req('/api/admin/structures/link', { method: 'PATCH', body: BODY }));
    expect(res.status).toBe(403);
  });

  it('5. VIEWER → 403 (EDITOR minimum requis)', async () => {
    const res = await linkPatch(req('/api/admin/structures/link', { method: 'PATCH', token: VIEWER_TOKEN, body: BODY }));
    expect(res.status).toBe(403);
  });
});

// ── Tests — POST /api/admin/inscriptions/[id]/relance ────────────────────────

describe('POST /api/admin/inscriptions/[id]/relance — auth requise', () => {
  it('6. sans auth → 401', async () => {
    const res = await relancePost(
      req(`/api/admin/inscriptions/${INSCRIPTION_ID}/relance`, { method: 'POST' }),
      { params: Promise.resolve({ id: INSCRIPTION_ID }) }
    );
    expect(res.status).toBe(401);
  });
});

// ── Tests — /api/admin/propositions — auth requise sur toutes les méthodes ───

describe('/api/admin/propositions — toutes les méthodes requièrent auth', () => {
  it('7. GET sans auth → 401', async () => {
    const res = await propGet(req('/api/admin/propositions'));
    expect(res.status).toBe(401);
  });

  it('8. POST sans auth → 401', async () => {
    const res = await propPost(req('/api/admin/propositions', {
      method: 'POST',
      body: { structure_nom: 'test' },
    }));
    expect(res.status).toBe(401);
  });

  it('9. PATCH sans auth → 401', async () => {
    const res = await propPatch(req('/api/admin/propositions', {
      method: 'PATCH',
      body: { id: UUID_1 },
    }));
    expect(res.status).toBe(401);
  });

  it('10. DELETE sans auth → 401', async () => {
    const res = await propDelete(req('/api/admin/propositions', {
      method: 'DELETE',
      body: { id: UUID_1 },
    }));
    expect(res.status).toBe(401);
  });
});
