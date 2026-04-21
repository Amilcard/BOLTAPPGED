/**
 * @jest-environment node
 *
 * Tests unitaires — helper runRelanceInscription
 *
 * Scénarios idempotence (guard 30 min) :
 *  1. last_relance_at = null          → success + UPDATE last_relance_at
 *  2. last_relance_at < 30 min ago    → 409 "Relance déjà envoyée"
 *  3. last_relance_at > 30 min ago    → success + UPDATE last_relance_at
 *
 * NB : vérifie aussi que le guard ged_sent_at reste prioritaire ailleurs (cf tests legacy).
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-key';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-key!';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockFrom = jest.fn();
const mockSendRappel = jest.fn().mockResolvedValue({ sent: true, messageId: 'mock-id' });
const mockSendAdminNotif = jest.fn().mockResolvedValue({ sent: true, messageId: 'mock-id' });

jest.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

jest.mock('@/lib/email', () => ({
  sendRappelDossierIncomplet: (...args: unknown[]) => mockSendRappel(...args),
  sendRelanceAdminNotification: (...args: unknown[]) => mockSendAdminNotif(...args),
}));

import { runRelanceInscription } from '@/lib/admin-inscriptions-relance';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const INSCRIPTION_ID = 'aaa00000-0000-0000-0000-000000000099';

function inscriptionRow(lastRelanceAt: string | null) {
  return {
    id: INSCRIPTION_ID,
    referent_email: 'ref@structure.fr',
    referent_nom: 'Alice',
    dossier_ref: 'DOS-42',
    suivi_token: 'tok-abc-123',
    organisation: 'Foyer Test',
    last_relance_at: lastRelanceAt,
  };
}

/**
 * Prépare le mock pour 3 appels successifs à `from` :
 *   1. SELECT gd_inscriptions (single)
 *   2. SELECT gd_dossier_enfant (maybeSingle)
 *   3. UPDATE gd_inscriptions (eq) — appelé uniquement si pas 409
 */
function setupSupabase(opts: {
  inscription: ReturnType<typeof inscriptionRow> | null;
  gedSentAt?: string | null;
}) {
  const updateEq = jest.fn().mockResolvedValue({ error: null });
  const updateFn = jest.fn().mockReturnValue({ eq: updateEq });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'gd_inscriptions') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: opts.inscription,
              error: opts.inscription ? null : { message: 'not found' },
            }),
          }),
        }),
        update: updateFn,
      };
    }
    if (table === 'gd_dossier_enfant') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: opts.gedSentAt !== undefined ? { ged_sent_at: opts.gedSentAt } : null,
              error: null,
            }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { updateFn, updateEq };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('runRelanceInscription — guard idempotence 30 min', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('1. last_relance_at = null → success + UPDATE last_relance_at', async () => {
    const { updateFn, updateEq } = setupSupabase({
      inscription: inscriptionRow(null),
      gedSentAt: null,
    });

    const res = await runRelanceInscription(INSCRIPTION_ID);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.relance_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ last_relance_at: expect.stringMatching(/^\d{4}-/) })
    );
    expect(updateEq).toHaveBeenCalledWith('id', INSCRIPTION_ID);
    expect(mockSendRappel).toHaveBeenCalledTimes(1);
    expect(mockSendAdminNotif).toHaveBeenCalledTimes(1);
  });

  test('2. last_relance_at < 30 min ago → 409 + aucun UPDATE, aucun email', async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { updateFn } = setupSupabase({
      inscription: inscriptionRow(fiveMinutesAgo),
      gedSentAt: null,
    });

    const res = await runRelanceInscription(INSCRIPTION_ID);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(409);
      expect(res.error).toMatch(/patientez|30 minutes/i);
    }
    expect(updateFn).not.toHaveBeenCalled();
    expect(mockSendRappel).not.toHaveBeenCalled();
    expect(mockSendAdminNotif).not.toHaveBeenCalled();
  });

  test('3. last_relance_at > 30 min ago → success + UPDATE last_relance_at', async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { updateFn, updateEq } = setupSupabase({
      inscription: inscriptionRow(oneHourAgo),
      gedSentAt: null,
    });

    const res = await runRelanceInscription(INSCRIPTION_ID);

    expect(res.ok).toBe(true);
    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(updateEq).toHaveBeenCalledWith('id', INSCRIPTION_ID);
    expect(mockSendRappel).toHaveBeenCalledTimes(1);
    expect(mockSendAdminNotif).toHaveBeenCalledTimes(1);
  });

  test('4. ged_sent_at déjà défini → 409 prioritaire (pas d\'UPDATE relance)', async () => {
    const { updateFn } = setupSupabase({
      inscription: inscriptionRow(null),
      gedSentAt: '2026-04-01T10:00:00Z',
    });

    const res = await runRelanceInscription(INSCRIPTION_ID);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(409);
      expect(res.error).toMatch(/dossier déjà envoyé/i);
    }
    expect(updateFn).not.toHaveBeenCalled();
    expect(mockSendRappel).not.toHaveBeenCalled();
  });
});
