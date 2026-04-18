/**
 * @jest-environment node
 *
 * Tests unitaires — runDeleteSession.
 * Helper minimal : delete `gd_stay_sessions` par id. Pas de validation UUID (cf. doc legacy).
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-key';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-key!';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

import { runDeleteSession } from '@/lib/admin-session-delete';

const SESSION_ID = '11111111-1111-1111-1111-111111111111';

function setupDelete(opts: { error?: { message: string } | null }) {
  const deleteEq = jest.fn().mockResolvedValue({ error: opts.error ?? null });
  const deleteFn = jest.fn().mockReturnValue({ eq: deleteEq });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'gd_stay_sessions') {
      return { delete: deleteFn };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { deleteFn, deleteEq };
}

describe('runDeleteSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('happy path — supprime la session et retourne success', async () => {
    const { deleteFn, deleteEq } = setupDelete({ error: null });

    const res = await runDeleteSession(SESSION_ID);

    expect(res).toEqual({ success: true });
    expect(deleteFn).toHaveBeenCalledTimes(1);
    expect(deleteEq).toHaveBeenCalledWith('id', SESSION_ID);
  });

  test('filtre uniquement par id session (staySlug ignoré par design)', async () => {
    const { deleteEq } = setupDelete({ error: null });
    await runDeleteSession(SESSION_ID);
    // legacy ne filtre QUE par id — on vérifie donc un seul `.eq` avec 'id'
    expect(deleteEq).toHaveBeenCalledTimes(1);
    expect(deleteEq).toHaveBeenCalledWith('id', SESSION_ID);
  });

  test('erreur Supabase → { error, status 500 }', async () => {
    setupDelete({ error: { message: 'FK violation' } });

    const res = await runDeleteSession(SESSION_ID);

    expect(res).toEqual({ error: 'Erreur serveur', status: 500 });
  });

  test('exception synchrone depuis getSupabaseAdmin → { error, status 500 }', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('boom');
    });

    const res = await runDeleteSession(SESSION_ID);

    expect(res).toEqual({ error: 'Erreur serveur', status: 500 });
  });
});
