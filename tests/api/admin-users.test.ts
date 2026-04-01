/**
 * @jest-environment node
 *
 * Tests intégration API — GET+POST /api/admin/users
 *
 * Endpoint ADMIN-only : liste et création de comptes admin.
 * Sécurité critique : EDITOR ne doit pas pouvoir créer/voir les comptes.
 *
 * Scénarios :
 *  1. GET sans auth → 403
 *  2. GET EDITOR → 403 (admin seulement)
 *  3. GET ADMIN → 200 + liste utilisateurs
 *  4. POST sans auth → 403
 *  5. POST EDITOR → 403
 *  6. POST champs manquants → 400
 *  7. POST rôle invalide → 400
 *  8. POST ADMIN → 201 + id + role
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-key';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-key!';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockListUsers = jest.fn();
const mockCreateUser = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  getSupabase: () => ({}),
  getSupabaseAdmin: () => ({
    auth: {
      admin: {
        listUsers: mockListUsers,
        createUser: mockCreateUser,
      },
    },
  }),
}));

import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/admin/users/route';

const SECRET = process.env.NEXTAUTH_SECRET!;

const ADMIN_TOKEN = jwt.sign({ userId: 'admin-1', email: 'admin@ged.fr', role: 'ADMIN' }, SECRET, { expiresIn: '1h' });
const EDITOR_TOKEN = jwt.sign({ userId: 'editor-1', email: 'editor@ged.fr', role: 'EDITOR' }, SECRET, { expiresIn: '1h' });

function req(method: string, token?: string, body?: object): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new NextRequest('http://localhost:3000/api/admin/users', {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const MOCK_USER = {
  id: 'user-uuid-1',
  email: 'editor@ged.fr',
  created_at: '2026-01-01T00:00:00Z',
  app_metadata: { role: 'EDITOR' },
};

describe('GET /api/admin/users', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne 403 sans auth', async () => {
    const res = await GET(req('GET'));
    expect(res.status).toBe(403);
  });

  it('retourne 403 si EDITOR (réservé ADMIN)', async () => {
    const res = await GET(req('GET', EDITOR_TOKEN));
    expect(res.status).toBe(403);
  });

  it('retourne 200 avec liste utilisateurs si ADMIN', async () => {
    mockListUsers.mockResolvedValue({ data: { users: [MOCK_USER] }, error: null });
    const res = await GET(req('GET', ADMIN_TOKEN));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].email).toBe('editor@ged.fr');
    expect(body[0].role).toBe('EDITOR');
    // Ne jamais exposer app_metadata raw
    expect(body[0].app_metadata).toBeUndefined();
  });
});

describe('POST /api/admin/users', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne 403 sans auth', async () => {
    const res = await POST(req('POST', undefined, { email: 'x@y.fr', password: 'pass', role: 'EDITOR' }));
    expect(res.status).toBe(403);
  });

  it('retourne 403 si EDITOR (réservé ADMIN)', async () => {
    const res = await POST(req('POST', EDITOR_TOKEN, { email: 'x@y.fr', password: 'pass', role: 'EDITOR' }));
    expect(res.status).toBe(403);
  });

  it('retourne 400 si champs manquants', async () => {
    const res = await POST(req('POST', ADMIN_TOKEN, { email: 'x@y.fr' }));
    expect(res.status).toBe(400);
  });

  it('retourne 400 si rôle invalide', async () => {
    const res = await POST(req('POST', ADMIN_TOKEN, { email: 'x@y.fr', password: 'pass', role: 'SUPERADMIN' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/rôle/i);
  });

  it('retourne 201 avec id + role si ADMIN crée un utilisateur', async () => {
    mockCreateUser.mockResolvedValue({
      data: {
        user: {
          id: 'new-user-uuid',
          email: 'nouveau@ged.fr',
          created_at: '2026-03-31T00:00:00Z',
        },
      },
      error: null,
    });
    const res = await POST(req('POST', ADMIN_TOKEN, { email: 'nouveau@ged.fr', password: 'StrongPass1!', role: 'EDITOR' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('new-user-uuid');
    expect(body.role).toBe('EDITOR');
  });
});
