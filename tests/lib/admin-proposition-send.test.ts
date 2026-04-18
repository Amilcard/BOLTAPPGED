/**
 * @jest-environment node
 *
 * Tests unitaires — runSendProposition.
 * Mocks : supabase (SELECT + UPDATE .in), email, PDF, auditLog (global).
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-key';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-key!';

const mockFrom = jest.fn();
const mockSendProposition = jest.fn().mockResolvedValue(undefined);
const mockGeneratePdf = jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));

jest.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

jest.mock('@/lib/email', () => ({
  sendPropositionEmail: (...args: unknown[]) => mockSendProposition(...args),
}));

jest.mock('@/lib/pdf-proposition', () => ({
  generatePropositionPdf: (...args: unknown[]) => mockGeneratePdf(...args),
}));

import { auditLog } from '@/lib/audit-log';
import { runSendProposition } from '@/lib/admin-proposition-send';

const PROP_ID = '55555555-5555-5555-5555-555555555555';

function sampleProp(overrides: Record<string, unknown> = {}) {
  return {
    id: PROP_ID,
    status: 'brouillon',
    demandeur_email: 'educ@structure.fr',
    demandeur_nom: 'Alice Dupont',
    sejour_titre: 'Séjour Montagne',
    sejour_slug: 'montagne-ete',
    ...overrides,
  };
}

function setupSupabase(opts: {
  prop: ReturnType<typeof sampleProp> | null;
  updateError?: { message: string } | null;
  /** Nombre de rows retournées par UPDATE .select() — 0 = course gagnée par autre worker (409) */
  updateRows?: number;
}) {
  const rows = Array.from(
    { length: opts.updateRows ?? 1 },
    () => ({ id: PROP_ID }),
  );
  // UPDATE chain : update(payload).eq('id', id).in('status', [...]).select('id')
  const updateSelect = jest.fn().mockResolvedValue({
    data: opts.updateError ? null : rows,
    error: opts.updateError ?? null,
  });
  const updateIn = jest.fn().mockReturnValue({ select: updateSelect });
  const updateEq = jest.fn().mockReturnValue({ in: updateIn });
  const updateFn = jest.fn().mockReturnValue({ eq: updateEq });

  const single = jest.fn().mockResolvedValue({ data: opts.prop, error: null });
  const selectEq = jest.fn().mockReturnValue({ single });
  const selectFn = jest.fn().mockReturnValue({ eq: selectEq });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'gd_propositions_tarifaires') {
      return { select: selectFn, update: updateFn };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { updateFn, updateEq, updateIn, updateSelect, selectFn };
}

describe('runSendProposition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('happy path — PDF + email + audit + UPDATE status=envoyee (ok=true)', async () => {
    const { updateFn, updateIn } = setupSupabase({ prop: sampleProp() });

    const res = await runSendProposition({
      id: PROP_ID,
      actorEmail: 'admin@gd.fr',
      ip: '1.2.3.4',
    });

    expect(res).toEqual({ ok: true });
    expect(mockGeneratePdf).toHaveBeenCalledTimes(1);
    expect(mockSendProposition).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'educ@structure.fr',
        destinataireNom: 'Alice Dupont',
        sejourTitre: 'Séjour Montagne',
      })
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'submit',
        resourceType: 'proposition',
        resourceId: PROP_ID,
      })
    );
    expect(updateFn).toHaveBeenCalledWith({ status: 'envoyee' });
    expect(updateIn).toHaveBeenCalledWith('status', ['brouillon', 'demandee']);
  });

  test('ID non-UUID → 400 (aucun effet de bord)', async () => {
    const res = await runSendProposition({
      id: 'not-uuid',
      actorEmail: 'admin@gd.fr',
    });
    expect(res).toEqual({ ok: false, error: 'ID invalide', status: 400 });
    expect(mockGeneratePdf).not.toHaveBeenCalled();
    expect(mockSendProposition).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  test('overrideEmail invalide → 400', async () => {
    const res = await runSendProposition({
      id: PROP_ID,
      overrideEmail: 'pas-un-email',
      actorEmail: 'admin@gd.fr',
    });
    expect(res).toEqual({
      ok: false,
      error: 'Email destinataire invalide.',
      status: 400,
    });
  });

  test('proposition introuvable → 404', async () => {
    setupSupabase({ prop: null });
    const res = await runSendProposition({
      id: PROP_ID,
      actorEmail: 'admin@gd.fr',
    });
    expect(res).toEqual({ ok: false, error: 'Proposition introuvable', status: 404 });
    expect(mockSendProposition).not.toHaveBeenCalled();
  });

  test('déjà envoyée → 400 (idempotence)', async () => {
    setupSupabase({ prop: sampleProp({ status: 'envoyee' }) });
    const res = await runSendProposition({
      id: PROP_ID,
      actorEmail: 'admin@gd.fr',
    });
    expect(res).toEqual({
      ok: false,
      error: 'Proposition déjà envoyée.',
      status: 400,
    });
    expect(mockSendProposition).not.toHaveBeenCalled();
  });

  test('aucun email destinataire → 400', async () => {
    setupSupabase({ prop: sampleProp({ demandeur_email: null }) });
    const res = await runSendProposition({
      id: PROP_ID,
      actorEmail: 'admin@gd.fr',
    });
    expect('error' in res && res.status).toBe(400);
    expect('error' in res && res.error).toMatch(/email destinataire/i);
  });

  test('overrideEmail utilisé quand demandeur_email absent + backfill dans UPDATE', async () => {
    const { updateFn } = setupSupabase({
      prop: sampleProp({ demandeur_email: null }),
    });

    const res = await runSendProposition({
      id: PROP_ID,
      overrideEmail: 'fallback@ex.fr',
      actorEmail: 'admin@gd.fr',
    });

    expect(res).toEqual({ ok: true });
    expect(mockSendProposition).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'fallback@ex.fr' })
    );
    expect(updateFn).toHaveBeenCalledWith({
      status: 'envoyee',
      demandeur_email: 'fallback@ex.fr',
    });
  });

  test('UPDATE statut échoue → 500 ET email PAS envoyé (update-first pattern)', async () => {
    setupSupabase({
      prop: sampleProp(),
      updateError: { message: 'race condition' },
    });

    const res = await runSendProposition({
      id: PROP_ID,
      actorEmail: 'admin@gd.fr',
    });

    expect(res).toEqual({
      ok: false,
      error: 'Statut proposition non mis à jour.',
      status: 500,
    });
    // Pattern anti-doublon : l'email N'EST PAS déclenché si le UPDATE rate.
    expect(mockSendProposition).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  test('UPDATE 0 rows (course concurrente) → 409 ET email PAS envoyé', async () => {
    setupSupabase({
      prop: sampleProp(),
      updateRows: 0,
    });

    const res = await runSendProposition({
      id: PROP_ID,
      actorEmail: 'admin@gd.fr',
    });

    expect(res).toEqual({
      ok: false,
      error: 'Proposition déjà envoyée.',
      status: 409,
    });
    expect(mockSendProposition).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  test('Email échoue après UPDATE → 502 + auditLog avec email_status=failed', async () => {
    setupSupabase({ prop: sampleProp() });
    mockSendProposition.mockRejectedValueOnce(new Error('SMTP timeout'));

    const res = await runSendProposition({
      id: PROP_ID,
      actorEmail: 'admin@gd.fr',
    });

    expect(res).toEqual({
      ok: false,
      error: 'Statut mis à jour mais envoi email échoué.',
      status: 502,
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'submit',
        metadata: expect.objectContaining({ email_status: 'failed' }),
      }),
    );
    // Reset pour tests suivants
    mockSendProposition.mockResolvedValue(undefined);
  });
});
