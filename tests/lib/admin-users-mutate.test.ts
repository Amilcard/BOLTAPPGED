/**
 * @jest-environment node
 *
 * Tests unitaires — runUpdateUser + runDeleteUser (admin-users-mutate).
 * Ces helpers utilisent `supabase.auth.admin.*` (pas `from`).
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-key';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-key!';

const mockUpdateUserById = jest.fn();
const mockDeleteUser = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => ({
    auth: {
      admin: {
        updateUserById: (...args: unknown[]) => mockUpdateUserById(...args),
        deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
      },
    },
  }),
}));

import { runUpdateUser, runDeleteUser } from '@/lib/admin-users-mutate';

const USER_ID = '22222222-2222-2222-2222-222222222222';
const ACTOR_ID = '33333333-3333-3333-3333-333333333333';

describe('runUpdateUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('happy path — met à jour email + role + password, retourne user normalisé', async () => {
    mockUpdateUserById.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          email: 'nouveau@example.com',
          app_metadata: { role: 'EDITOR' },
          created_at: '2026-01-01T00:00:00Z',
        },
      },
      error: null,
    });

    const res = await runUpdateUser(USER_ID, {
      email: 'nouveau@example.com',
      role: 'EDITOR',
      password: 'NewPass123!',
    });

    expect('data' in res && res.data).toEqual({
      id: USER_ID,
      email: 'nouveau@example.com',
      role: 'EDITOR',
      createdAt: '2026-01-01T00:00:00Z',
    });
    expect(mockUpdateUserById).toHaveBeenCalledWith(USER_ID, {
      email: 'nouveau@example.com',
      password: 'NewPass123!',
      app_metadata: { role: 'EDITOR' },
    });
  });

  test('ID non-UUID → { error: "ID invalide", status: 400 } (pas d\'appel Supabase)', async () => {
    const res = await runUpdateUser('not-a-uuid', { email: 'x@y.fr' });
    expect(res).toEqual({ error: 'ID invalide', status: 400 });
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  test('rôle non whitelisté → { error: "Rôle invalide", status: 400 }', async () => {
    const res = await runUpdateUser(USER_ID, { role: 'SUPERADMIN' });
    expect(res).toEqual({ error: 'Rôle invalide', status: 400 });
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  test('erreur Supabase → { error: "Erreur serveur", status: 500 }', async () => {
    mockUpdateUserById.mockResolvedValue({ data: null, error: { message: 'db down' } });
    const res = await runUpdateUser(USER_ID, { email: 'x@y.fr' });
    expect(res).toEqual({ error: 'Erreur serveur', status: 500 });
  });

  test('role par défaut VIEWER si app_metadata.role manquant', async () => {
    mockUpdateUserById.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          email: 'sans-role@example.com',
          app_metadata: {},
          created_at: '2026-01-01T00:00:00Z',
        },
      },
      error: null,
    });

    const res = await runUpdateUser(USER_ID, { email: 'sans-role@example.com' });
    expect('data' in res && res.data?.role).toBe('VIEWER');
  });
});

describe('runDeleteUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('happy path — supprime l\'utilisateur et retourne success', async () => {
    mockDeleteUser.mockResolvedValue({ error: null });
    const res = await runDeleteUser(USER_ID, ACTOR_ID);
    expect(res).toEqual({ success: true });
    expect(mockDeleteUser).toHaveBeenCalledWith(USER_ID);
  });

  test('ID non-UUID → { error: "ID invalide", status: 400 }', async () => {
    const res = await runDeleteUser('bad', ACTOR_ID);
    expect(res).toEqual({ error: 'ID invalide', status: 400 });
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  test('anti self-delete — id === actorUserId → 400', async () => {
    const res = await runDeleteUser(USER_ID, USER_ID);
    expect(res).toEqual({
      error: 'Impossible de supprimer votre propre compte.',
      status: 400,
    });
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  test('erreur Supabase → { error: "Erreur serveur", status: 500 }', async () => {
    mockDeleteUser.mockResolvedValue({ error: { message: 'db down' } });
    const res = await runDeleteUser(USER_ID, ACTOR_ID);
    expect(res).toEqual({ error: 'Erreur serveur', status: 500 });
  });
});
