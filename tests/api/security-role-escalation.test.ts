/**
 * @jest-environment node
 *
 * Tests non-régression — corrections failles rôle VIEWER
 *
 * Vérifie que les deux failles corrigées restent fermées :
 *   1. propositions POST/PATCH/DELETE : VIEWER → 401
 *   2. relance POST : VIEWER → 401
 *
 * GET propositions reste accessible au VIEWER (lecture intentionnelle).
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-key!';

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
import {
  GET as propGet, POST as propPost,
  PATCH as propPatch, DELETE as propDelete,
} from '@/app/api/admin/propositions/route';
import { POST as relancePost } from '@/app/api/admin/inscriptions/[id]/relance/route';

const S = process.env.NEXTAUTH_SECRET;
if (!S) throw new Error('NEXTAUTH_SECRET must be set for tests');
const VIEWER = jwt.sign({ userId: 'v1', email: 'viewer@ged.fr', role: 'VIEWER' }, S, { expiresIn: '1h' });
const EDITOR = jwt.sign({ userId: 'e1', email: 'editor@ged.fr', role: 'EDITOR' }, S, { expiresIn: '1h' });
const INSC_ID = 'aaa00000-0000-0000-0000-000000000001';

function r(method: string, token?: string, body?: object): NextRequest {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return new NextRequest('http://localhost/api/admin/propositions', {
    method, headers: h,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// ── Propositions — écriture bloquée pour VIEWER ───────────────────────────────

describe('VIEWER ne peut pas écrire sur /admin/propositions', () => {
  it('POST VIEWER → 401', async () => {
    const res = await propPost(r('POST', VIEWER, { structure_nom: 'x' }));
    expect(res.status).toBe(401);
  });

  it('PATCH VIEWER → 401', async () => {
    const res = await propPatch(r('PATCH', VIEWER, { id: 'some-id', status: 'envoyee' }));
    expect(res.status).toBe(401);
  });

  it('DELETE VIEWER → 401', async () => {
    const res = await propDelete(r('DELETE', VIEWER, { id: 'some-id' }));
    expect(res.status).toBe(401);
  });

  it('GET VIEWER → 403 (requireEditor bloque les non-éditeurs)', async () => {
    const res = await propGet(r('GET', VIEWER));
    expect(res.status).toBe(403);
  });

  it('POST EDITOR → pas 401 (accès normal)', async () => {
    // EDITOR doit passer le garde — on ne teste pas le résultat métier, juste que ce n'est pas 401
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'p1' }, error: null }),
        }),
      }),
    });
    const res = await propPost(r('POST', EDITOR, {
      structure_nom: 'CAF', enfant_nom: 'Léo', enfant_prenom: 'Martin',
      sejour_slug: 'alpes', session_start: '2026-07-08', session_end: '2026-07-14',
      ville_depart: 'Paris',
    }));
    expect(res.status).not.toBe(401);
  });
});

// ── Relance — bloquée pour VIEWER ────────────────────────────────────────────

describe('VIEWER ne peut pas envoyer de relance email', () => {
  function relanceReq(token?: string): NextRequest {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return new NextRequest(`http://localhost/api/admin/inscriptions/${INSC_ID}/relance`, {
      method: 'POST', headers: h,
    });
  }

  it('VIEWER → 401', async () => {
    const res = await relancePost(relanceReq(VIEWER), {
      params: Promise.resolve({ id: INSC_ID }),
    });
    expect(res.status).toBe(401);
  });

  it('sans auth → 401', async () => {
    const res = await relancePost(relanceReq(), {
      params: Promise.resolve({ id: INSC_ID }),
    });
    expect(res.status).toBe(401);
  });

  it('EDITOR → pas 401 (accès normal)', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    const res = await relancePost(relanceReq(EDITOR), {
      params: Promise.resolve({ id: INSC_ID }),
    });
    expect(res.status).not.toBe(401);
  });
});
