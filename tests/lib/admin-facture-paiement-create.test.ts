/**
 * @jest-environment node
 *
 * Tests unitaires — runCreatePaiement.
 * Valide : UUID, méthode whitelistée, guard facture annulée, INSERT, sync statut, auditLog.
 * auditLog est déjà mocké globalement via jest.setup.js.
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-key';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-key!';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

import { auditLog } from '@/lib/audit-log';
import { runCreatePaiement } from '@/lib/admin-facture-paiement-create';

const FACTURE_ID = '44444444-4444-4444-4444-444444444444';
const VALID_BASE = {
  factureId: FACTURE_ID,
  date_paiement: '2026-04-15',
  montant: 100,
  methode: 'virement',
  actorEmail: 'admin@gd.fr',
};

type BuilderOpts = {
  facture?: { id: string; statut: string } | null;
  insertResult?: { data: unknown; error: { message: string } | null };
  syncPaiements?: { montant: number }[];
  syncFacture?: { montant_total: number; statut: string } | null;
};

/**
 * Sequencing attendu pour un happy path :
 *   1. from('gd_factures').select().eq().single()        -> guard facture
 *   2. from('gd_facture_paiements').insert().select().single() -> insert
 *   3. from('gd_factures').select().eq().single()        -> syncStatutFacture (facture)
 *   4. from('gd_facture_paiements').select().eq()        -> syncStatutFacture (paiements)
 *   5. from('gd_factures').update().eq()                 -> syncStatutFacture (update si change)
 */
function buildMock(opts: BuilderOpts) {
  let factureSelectCalls = 0;
  const updateEq = jest.fn().mockResolvedValue({ error: null });
  const updateFn = jest.fn().mockReturnValue({ eq: updateEq });

  const insertSingle = jest.fn().mockResolvedValue(
    opts.insertResult ?? {
      data: { id: 'paiement-uuid-xxx' },
      error: null,
    }
  );
  const insertSelect = jest.fn().mockReturnValue({ single: insertSingle });
  const insertFn = jest.fn().mockReturnValue({ select: insertSelect });

  // pour syncStatut → select montant des paiements
  const paiementsEq = jest.fn().mockResolvedValue({
    data: opts.syncPaiements ?? [{ montant: 100 }],
    error: null,
  });
  const paiementsSelect = jest.fn().mockReturnValue({ eq: paiementsEq });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'gd_factures') {
      factureSelectCalls += 1;
      if (factureSelectCalls === 1) {
        // 1er select : guard facture initial
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest
                .fn()
                .mockResolvedValue({ data: opts.facture ?? null, error: null }),
            }),
          }),
          update: updateFn,
        };
      }
      // 2e+ select : dans syncStatutFacture
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data:
                opts.syncFacture ??
                { montant_total: 100, statut: 'envoyee' },
              error: null,
            }),
          }),
        }),
        update: updateFn,
      };
    }
    if (table === 'gd_facture_paiements') {
      return {
        insert: insertFn,
        select: paiementsSelect,
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { insertFn, insertSingle, updateFn, updateEq };
}

describe('runCreatePaiement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('happy path — insert + syncStatutFacture (payee) + auditLog', async () => {
    const { insertFn, updateFn } = buildMock({
      facture: { id: FACTURE_ID, statut: 'envoyee' },
      insertResult: { data: { id: 'paiement-1' }, error: null },
      syncFacture: { montant_total: 100, statut: 'envoyee' },
      syncPaiements: [{ montant: 100 }],
    });

    const res = await runCreatePaiement(VALID_BASE);

    expect('paiement' in res && res.paiement).toEqual({ id: 'paiement-1' });
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        facture_id: FACTURE_ID,
        date_paiement: '2026-04-15',
        montant: 100,
        methode: 'virement',
      })
    );
    // statut passe envoyee → payee (total = montant_total)
    expect(updateFn).toHaveBeenCalledWith({ statut: 'payee' });
    expect(auditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'create',
        resourceType: 'paiement',
        resourceId: FACTURE_ID,
      })
    );
  });

  test('ID non-UUID → 400', async () => {
    const res = await runCreatePaiement({ ...VALID_BASE, factureId: 'bad' });
    expect(res).toEqual({ error: 'ID invalide', status: 400 });
    expect(auditLog).not.toHaveBeenCalled();
  });

  test('méthode hors whitelist → 400', async () => {
    const res = await runCreatePaiement({ ...VALID_BASE, methode: 'bitcoin' });
    expect('error' in res && res.status).toBe(400);
    expect('error' in res && res.error).toMatch(/methode invalide/i);
  });

  test('montant <= 0 → 400', async () => {
    const res = await runCreatePaiement({ ...VALID_BASE, montant: 0 });
    expect(res).toEqual({ error: 'montant doit être > 0', status: 400 });
  });

  test('facture introuvable → 404', async () => {
    buildMock({ facture: null });
    const res = await runCreatePaiement(VALID_BASE);
    expect(res).toEqual({ error: 'Facture introuvable', status: 404 });
    expect(auditLog).not.toHaveBeenCalled();
  });

  test('facture annulée → 400 (pas d\'insert, pas d\'audit)', async () => {
    const { insertFn } = buildMock({
      facture: { id: FACTURE_ID, statut: 'annulee' },
    });
    const res = await runCreatePaiement(VALID_BASE);
    expect('error' in res && res.status).toBe(400);
    expect('error' in res && res.error).toMatch(/annulée/i);
    expect(insertFn).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  test('erreur DB lors de l\'insert → 500 (pas d\'audit)', async () => {
    buildMock({
      facture: { id: FACTURE_ID, statut: 'envoyee' },
      insertResult: { data: null, error: { message: 'db down' } },
    });
    const res = await runCreatePaiement(VALID_BASE);
    expect(res).toEqual({ error: 'Erreur enregistrement paiement', status: 500 });
    expect(auditLog).not.toHaveBeenCalled();
  });
});
