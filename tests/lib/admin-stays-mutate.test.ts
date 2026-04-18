/**
 * @jest-environment node
 *
 * Tests unitaires — runUpdateStay + runDeleteStay (admin-stays-mutate).
 * Identifiant = slug (pas UUID).
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-key';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-key!';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

import { runUpdateStay, runDeleteStay } from '@/lib/admin-stays-mutate';

const SLUG = 'sejour-montagne-ete';

function setupUpdate(opts: {
  data?: unknown;
  error?: { message?: string; code?: string } | null;
}) {
  const single = jest.fn().mockResolvedValue({
    data: opts.data ?? null,
    error: opts.error ?? null,
  });
  const select = jest.fn().mockReturnValue({ single });
  const eq = jest.fn().mockReturnValue({ select });
  const update = jest.fn().mockReturnValue({ eq });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'gd_stays') return { update };
    throw new Error(`Unexpected table: ${table}`);
  });

  return { update, eq, select, single };
}

function setupDelete(opts: { error?: { message?: string; code?: string } | null }) {
  const eq = jest.fn().mockResolvedValue({ error: opts.error ?? null });
  const deleteFn = jest.fn().mockReturnValue({ eq });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'gd_stays') return { delete: deleteFn };
    throw new Error(`Unexpected table: ${table}`);
  });

  return { deleteFn, eq };
}

describe('runUpdateStay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('happy path — UPDATE avec whitelist + mapping title→marketing_title', async () => {
    const { update, eq } = setupUpdate({
      data: { slug: SLUG, title: 'Nouveau titre' },
    });

    const res = await runUpdateStay(SLUG, {
      title: 'Nouveau titre',
      priceFrom: 499,
      geography: 'Alpes',
      extraChampNonWhitelisté: 'ignoré',
      programme: ['J1', 'J2'],
    });

    expect('data' in res && res.data).toEqual({ slug: SLUG, title: 'Nouveau titre' });
    expect(update).toHaveBeenCalledTimes(1);
    const updatePayload = update.mock.calls[0][0];
    expect(updatePayload).toEqual({
      title: 'Nouveau titre',
      marketing_title: 'Nouveau titre', // mapping legacy
      price_from: 499,
      location_region: 'Alpes',
      programme: ['J1', 'J2'],
    });
    expect(eq).toHaveBeenCalledWith('slug', SLUG);
  });

  test('slug invalide → { error, code: VALIDATION_ERROR, status: 400 }', async () => {
    const res = await runUpdateStay('-bad-slug', { title: 'x' });
    expect(res).toEqual({
      error: 'Slug invalide',
      code: 'VALIDATION_ERROR',
      status: 400,
    });
  });

  test('aucun champ whitelisté → { error: "Aucun champ à mettre à jour", 400 }', async () => {
    const res = await runUpdateStay(SLUG, { fakeField: 'x' });
    expect(res).toEqual({
      error: 'Aucun champ à mettre à jour',
      code: 'VALIDATION_ERROR',
      status: 400,
    });
  });

  test('programme non-array → null (sanitize)', async () => {
    const { update } = setupUpdate({ data: { slug: SLUG } });
    await runUpdateStay(SLUG, { programme: 'pas un array' });
    expect(update.mock.calls[0][0]).toEqual({ programme: null });
  });

  test('erreur DB → { error: "Erreur serveur", code: INTERNAL_ERROR, 500 }', async () => {
    setupUpdate({ error: { message: 'db down' } });
    const res = await runUpdateStay(SLUG, { title: 'x' });
    expect(res).toEqual({
      error: 'Erreur serveur',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
  });
});

describe('runDeleteStay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('happy path — DELETE + success', async () => {
    const { deleteFn, eq } = setupDelete({ error: null });
    const res = await runDeleteStay(SLUG);
    expect(res).toEqual({ success: true });
    expect(deleteFn).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith('slug', SLUG);
  });

  test('slug invalide → VALIDATION_ERROR 400', async () => {
    const res = await runDeleteStay('');
    expect(res).toEqual({
      error: 'Slug invalide',
      code: 'VALIDATION_ERROR',
      status: 400,
    });
  });

  test('FK violation (23503) → message friendly + 409', async () => {
    setupDelete({ error: { code: '23503', message: 'FK' } });
    const res = await runDeleteStay(SLUG);
    expect('error' in res && res).toEqual({
      error:
        'Séjour référencé par des sessions, inscriptions ou souhaits. Annulez-les avant de supprimer.',
      code: '23503',
      status: 409,
    });
  });

  test('erreur DB générique → INTERNAL_ERROR 500', async () => {
    setupDelete({ error: { code: '42000', message: 'db down' } });
    const res = await runDeleteStay(SLUG);
    expect(res).toEqual({
      error: 'Erreur serveur',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
  });
});
