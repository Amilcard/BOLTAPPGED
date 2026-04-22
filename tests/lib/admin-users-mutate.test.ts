/**
 * @jest-environment node
 *
 * Tests unitaires — runCreateUser + runUpdateUser + runDeleteUser
 * (admin-users-mutate). Ces helpers utilisent `supabase.auth.admin.*`
 * (pas `from`) et appellent `auditLog()` pour tracer (RGPD Art. 9
 * non concerné ici, mais règle #15 CLAUDE.md : toute route admin
 * accédant à des données nominatives doit auditer).
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-key';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-key!';

const mockCreateUser = jest.fn();
const mockUpdateUserById = jest.fn();
const mockDeleteUser = jest.fn();
const mockAuditLog = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => ({
    auth: {
      admin: {
        createUser: (...args: unknown[]) => mockCreateUser(...args),
        updateUserById: (...args: unknown[]) => mockUpdateUserById(...args),
        deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
      },
    },
  }),
}));

jest.mock('@/lib/audit-log', () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
}));

import { runCreateUser, runUpdateUser, runDeleteUser } from '@/lib/admin-users-mutate';

const USER_ID = '22222222-2222-2222-2222-222222222222';
const ACTOR_ID = '33333333-3333-3333-3333-333333333333';
const ACTOR_EMAIL = 'admin@gd.fr';

describe('runCreateUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('happy path — crée utilisateur, retourne user normalisé + status 201', async () => {
    mockCreateUser.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          email: 'new@gd.fr',
          app_metadata: { role: 'EDITOR' },
          created_at: '2026-04-22T00:00:00Z',
        },
      },
      error: null,
    });

    const res = await runCreateUser(
      { email: 'new@gd.fr', password: 'Pass!123', role: 'EDITOR' },
      ACTOR_EMAIL,
    );

    expect('data' in res && res.data).toEqual({
      id: USER_ID,
      email: 'new@gd.fr',
      role: 'EDITOR',
      createdAt: '2026-04-22T00:00:00Z',
    });
    expect(res.status).toBe(201);
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@gd.fr',
        password: 'Pass!123',
        app_metadata: { role: 'EDITOR' },
        email_confirm: true,
      }),
    );
  });

  test('email manquant → 400, pas d\'appel Supabase, pas d\'audit', async () => {
    const res = await runCreateUser(
      { password: 'pw', role: 'VIEWER' } as never,
      ACTOR_EMAIL,
    );
    expect(res.status).toBe(400);
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  test('password manquant → 400', async () => {
    const res = await runCreateUser(
      { email: 'x@y.fr', role: 'VIEWER' } as never,
      ACTOR_EMAIL,
    );
    expect(res.status).toBe(400);
  });

  test('role manquant → 400', async () => {
    const res = await runCreateUser(
      { email: 'x@y.fr', password: 'pw' } as never,
      ACTOR_EMAIL,
    );
    expect(res.status).toBe(400);
  });

  test('rôle non whitelisté → 400', async () => {
    const res = await runCreateUser(
      { email: 'x@y.fr', password: 'pw', role: 'GOD' },
      ACTOR_EMAIL,
    );
    expect(res.status).toBe(400);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  test('T1 guard : auth admin retourne user:null → 500 + pas d\'audit (échec silencieux capté)', async () => {
    mockCreateUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await runCreateUser(
      { email: 'x@y.fr', password: 'pw', role: 'VIEWER' },
      ACTOR_EMAIL,
    );
    expect(res.status).toBe(500);
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  test('erreur Supabase → 500 + pas d\'audit', async () => {
    mockCreateUser.mockResolvedValue({
      data: null,
      error: { message: 'duplicate email' },
    });
    const res = await runCreateUser(
      { email: 'dup@gd.fr', password: 'pw', role: 'VIEWER' },
      ACTOR_EMAIL,
    );
    expect(res.status).toBe(500);
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  test('auditLog appelé avec action=create, resourceType=admin_user, actorId=actorEmail', async () => {
    mockCreateUser.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          email: 'new@gd.fr',
          app_metadata: { role: 'EDITOR' },
          created_at: '2026-04-22T00:00:00Z',
        },
      },
      error: null,
    });
    await runCreateUser(
      { email: 'new@gd.fr', password: 'pw', role: 'EDITOR' },
      ACTOR_EMAIL,
    );
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    const entry = mockAuditLog.mock.calls[0][1];
    expect(entry.action).toBe('create');
    expect(entry.resourceType).toBe('admin_user');
    expect(entry.resourceId).toBe(USER_ID);
    expect(entry.actorType).toBe('admin');
    expect(entry.actorId).toBe(ACTOR_EMAIL);
  });

  test('auditLog metadata NE contient JAMAIS le password brut', async () => {
    mockCreateUser.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          email: 'new@gd.fr',
          app_metadata: { role: 'EDITOR' },
          created_at: '2026-04-22T00:00:00Z',
        },
      },
      error: null,
    });
    const password = 'Sup3r$ecret-DO-NOT-LOG';
    await runCreateUser(
      { email: 'new@gd.fr', password, role: 'EDITOR' },
      ACTOR_EMAIL,
    );
    const entry = mockAuditLog.mock.calls[0][1];
    expect(JSON.stringify(entry.metadata)).not.toContain(password);
  });

  test('auditLog metadata contient role + has_password_set + has_email_set', async () => {
    mockCreateUser.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          email: 'new@gd.fr',
          app_metadata: { role: 'ADMIN' },
          created_at: '2026-04-22T00:00:00Z',
        },
      },
      error: null,
    });
    await runCreateUser(
      { email: 'new@gd.fr', password: 'pw', role: 'ADMIN' },
      ACTOR_EMAIL,
    );
    const entry = mockAuditLog.mock.calls[0][1];
    expect(entry.metadata).toEqual(
      expect.objectContaining({
        role: 'ADMIN',
        has_password_set: true,
        has_email_set: true,
      }),
    );
  });
});

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

    const res = await runUpdateUser(
      USER_ID,
      {
        email: 'nouveau@example.com',
        role: 'EDITOR',
        password: 'NewPass123!',
      },
      ACTOR_EMAIL,
    );

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

  test('ID non-UUID → 400, pas d\'appel Supabase, pas d\'audit', async () => {
    const res = await runUpdateUser('not-a-uuid', { email: 'x@y.fr' }, ACTOR_EMAIL);
    expect(res).toEqual({ error: 'ID invalide', status: 400 });
    expect(mockUpdateUserById).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  test('rôle non whitelisté → 400', async () => {
    const res = await runUpdateUser(USER_ID, { role: 'SUPERADMIN' }, ACTOR_EMAIL);
    expect(res).toEqual({ error: 'Rôle invalide', status: 400 });
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  test('T1 guard : auth admin retourne user:null → 500 + pas d\'audit', async () => {
    mockUpdateUserById.mockResolvedValue({ data: { user: null }, error: null });
    const res = await runUpdateUser(USER_ID, { role: 'EDITOR' }, ACTOR_EMAIL);
    expect(res.status).toBe(500);
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  test('erreur Supabase → 500 + pas d\'audit', async () => {
    mockUpdateUserById.mockResolvedValue({ data: null, error: { message: 'db down' } });
    const res = await runUpdateUser(USER_ID, { email: 'x@y.fr' }, ACTOR_EMAIL);
    expect(res).toEqual({ error: 'Erreur serveur', status: 500 });
    expect(mockAuditLog).not.toHaveBeenCalled();
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

    const res = await runUpdateUser(
      USER_ID,
      { email: 'sans-role@example.com' },
      ACTOR_EMAIL,
    );
    expect('data' in res && res.data?.role).toBe('VIEWER');
  });

  test('auditLog appelé avec action=update, actorId=actorEmail', async () => {
    mockUpdateUserById.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          email: 'new@gd.fr',
          app_metadata: { role: 'EDITOR' },
          created_at: '2026-04-22T00:00:00Z',
        },
      },
      error: null,
    });
    await runUpdateUser(USER_ID, { role: 'EDITOR' }, ACTOR_EMAIL);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    const entry = mockAuditLog.mock.calls[0][1];
    expect(entry.action).toBe('update');
    expect(entry.resourceType).toBe('admin_user');
    expect(entry.resourceId).toBe(USER_ID);
    expect(entry.actorType).toBe('admin');
    expect(entry.actorId).toBe(ACTOR_EMAIL);
  });

  test('auditLog metadata expose *_changed booléens, pas les valeurs brutes', async () => {
    mockUpdateUserById.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          email: 'leak-candidate@gd.fr',
          app_metadata: { role: 'ADMIN' },
          created_at: '2026-04-22T00:00:00Z',
        },
      },
      error: null,
    });
    const password = 'NEVER-log-THIS-1234';
    const newEmail = 'leak-candidate@gd.fr';
    await runUpdateUser(
      USER_ID,
      { email: newEmail, role: 'ADMIN', password },
      ACTOR_EMAIL,
    );
    const entry = mockAuditLog.mock.calls[0][1];
    expect(entry.metadata).toEqual(
      expect.objectContaining({
        email_changed: true,
        role_changed: true,
        password_changed: true,
        new_role: 'ADMIN',
      }),
    );
    const json = JSON.stringify(entry.metadata);
    expect(json).not.toContain(password);
    expect(json).not.toContain(newEmail);
  });

  test('auditLog metadata reporte false pour les champs non fournis', async () => {
    mockUpdateUserById.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          email: 'existing@gd.fr',
          app_metadata: { role: 'EDITOR' },
          created_at: '2026-04-22T00:00:00Z',
        },
      },
      error: null,
    });
    await runUpdateUser(USER_ID, { role: 'EDITOR' }, ACTOR_EMAIL);
    const entry = mockAuditLog.mock.calls[0][1];
    expect(entry.metadata).toEqual(
      expect.objectContaining({
        email_changed: false,
        role_changed: true,
        password_changed: false,
      }),
    );
  });
});

describe('runDeleteUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('happy path — supprime l\'utilisateur et retourne success', async () => {
    mockDeleteUser.mockResolvedValue({ error: null });
    const res = await runDeleteUser(USER_ID, ACTOR_ID, ACTOR_EMAIL);
    expect(res).toEqual({ success: true });
    expect(mockDeleteUser).toHaveBeenCalledWith(USER_ID);
  });

  test('ID non-UUID → 400 + pas d\'audit', async () => {
    const res = await runDeleteUser('bad', ACTOR_ID, ACTOR_EMAIL);
    expect(res).toEqual({ error: 'ID invalide', status: 400 });
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  test('anti self-delete — id === actorUserId → 400 + pas d\'audit', async () => {
    const res = await runDeleteUser(USER_ID, USER_ID, ACTOR_EMAIL);
    expect(res).toEqual({
      error: 'Impossible de supprimer votre propre compte.',
      status: 400,
    });
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  test('erreur Supabase → 500 + pas d\'audit', async () => {
    mockDeleteUser.mockResolvedValue({ error: { message: 'db down' } });
    const res = await runDeleteUser(USER_ID, ACTOR_ID, ACTOR_EMAIL);
    expect(res).toEqual({ error: 'Erreur serveur', status: 500 });
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  test('auditLog appelé avec action=delete, actorId=actorEmail', async () => {
    mockDeleteUser.mockResolvedValue({ error: null });
    await runDeleteUser(USER_ID, ACTOR_ID, ACTOR_EMAIL);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    const entry = mockAuditLog.mock.calls[0][1];
    expect(entry.action).toBe('delete');
    expect(entry.resourceType).toBe('admin_user');
    expect(entry.resourceId).toBe(USER_ID);
    expect(entry.actorType).toBe('admin');
    expect(entry.actorId).toBe(ACTOR_EMAIL);
  });
});
