/**
 * @jest-environment node
 *
 * Tests unitaires — POST /api/structure/[code]/inscriptions/[id]/submit
 *
 * Scénarios :
 *  S1. Staff (secrétariat) submit dossier complet → 200 + emails + auditLog BCC
 *  S2. Éducateur refusé → 403
 *  S3. Dossier incomplet → 400
 *  S4. Dossier déjà envoyé (ged_sent_at not null) → 409
 *  S5. Race concurrence (update renvoie 0 rows) → 409
 *  S6. Inscription d'une autre structure → 404
 *  S7. 4 blocs OK mais PJ optionnelles manquantes → 200 + partial_docs_missing
 *      (règle CEO 2026-04-19 — non-bloquant, relance GED post-envoi)
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-key!';

const mockFromChain = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(),
  single: jest.fn(),
};
const mockFrom = jest.fn(() => mockFromChain);

jest.mock('@/lib/supabase-server', () => ({
  getSupabase: () => ({ from: mockFrom }),
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

const mockResolve = jest.fn();
jest.mock('@/lib/structure', () => ({
  resolveCodeToStructure: (...args: unknown[]) => mockResolve(...args),
}));

const mockAuditLog = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/audit-log', () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
  getClientIp: () => '1.2.3.4',
}));

const mockSendComplet = jest.fn().mockResolvedValue({ id: 'email-1' });
const mockSendNotif = jest.fn().mockResolvedValue({ id: 'email-2' });
const mockSendArchive = jest.fn().mockResolvedValue({ id: 'email-3' });
jest.mock('@/lib/email', () => ({
  sendDossierCompletEmail: (...args: unknown[]) => mockSendComplet(...args),
  sendDossierGedAdminNotification: (...args: unknown[]) => mockSendNotif(...args),
  sendStructureArchivageEmail: (...args: unknown[]) => mockSendArchive(...args),
}));

jest.mock('@/lib/rate-limit-structure', () => ({
  structureRateLimitGuard: jest.fn().mockResolvedValue(null),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/structure/[code]/inscriptions/[id]/submit/route';

const STRUCTURE = { id: 'struct-1', name: 'MECS Test' };
const VALID_UUID = '11111111-2222-3333-4444-555555555555';

function req(): NextRequest {
  return new NextRequest('http://localhost:3000/api/structure/CODE/inscriptions/x/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

function params(id = VALID_UUID) {
  return Promise.resolve({ code: 'CODE1234AB', id });
}

function dossierComplete(gedSentAt: string | null = null) {
  return {
    id: 'dos-1',
    bulletin_completed: true,
    sanitaire_completed: true,
    liaison_completed: true,
    renseignements_completed: true,
    renseignements_required: false,
    documents_joints: [],
    ged_sent_at: gedSentAt,
  };
}

beforeEach(() => {
  // resetAllMocks purge AUSSI les queues mockResolvedValueOnce (vs clearAllMocks
  // qui ne touche qu'aux .mock.calls). Sans ça les valeurs d'un test précédent
  // fuitaient dans le suivant — causant des 400/409 surprise.
  jest.resetAllMocks();
  mockFrom.mockImplementation(() => mockFromChain);
  mockFromChain.select.mockReturnThis();
  mockFromChain.eq.mockReturnThis();
  mockFromChain.is.mockReturnThis();
  mockFromChain.update.mockReturnThis();
  mockSendComplet.mockResolvedValue({ id: 'email-1' });
  mockSendNotif.mockResolvedValue({ id: 'email-2' });
  mockSendArchive.mockResolvedValue({ id: 'email-3' });
  mockAuditLog.mockResolvedValue(undefined);
  // Rate limit default = null (pas de limitation)
  const rl = jest.requireMock('@/lib/rate-limit-structure') as { structureRateLimitGuard: jest.Mock };
  rl.structureRateLimitGuard.mockResolvedValue(null);
});

describe('POST /api/structure/[code]/inscriptions/[id]/submit', () => {
  it('S1 — secrétariat submit complet → 200 + emails + bcc + archivage structure', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'secretariat', email: 'sec@test.fr' });

    // Séquence des appels supabase.from (dans l'ordre du code route) :
    // 1. requireInscriptionInStructure : .from('gd_inscriptions').select.eq.eq.is.maybeSingle
    // 2. load dossier           : .from('gd_dossier_enfant').select.eq.single
    // 3. inscForStay            : .from('gd_inscriptions').select.eq.single
    // 4. stayForDocs            : .from('gd_stays').select.eq.maybeSingle
    // 5. UPDATE conditionnel    : .from('gd_dossier_enfant').update.eq.is.select → [{id}]
    // 6. insc (emails)          : .from('gd_inscriptions').select.eq.single (suivi_token inclus)
    // 7. structure email lookup : .from('gd_structures').select('email').eq.maybeSingle
    mockFromChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null }) // ownership
      .mockResolvedValueOnce({ data: { documents_requis: [] }, error: null }) // stay docs
      .mockResolvedValueOnce({ data: { email: 'archivage@struct.fr' }, error: null }); // structure email
    mockFromChain.single
      .mockResolvedValueOnce({ data: dossierComplete(), error: null }) // load dossier
      .mockResolvedValueOnce({ data: { sejour_slug: 'summer' }, error: null }) // inscForStay
      .mockResolvedValueOnce({ // insc (emails)
        data: {
          referent_email: 'ref@test.fr',
          referent_nom: 'Alice',
          jeune_prenom: 'Enfant',
          jeune_nom: 'Nom',
          dossier_ref: 'DOS-1',
          sejour_slug: 'summer',
          session_date: '2026-08-01',
          suivi_token: 'token-abc-123',
        },
        error: null,
      });

    // UPDATE conditionnel : le `.select('id')` final doit renvoyer 1 row.
    // Pattern : supabase.from('gd_dossier_enfant').update(X).eq.is.select('id')
    // On remplace le .select() final par un thenable pour cette séquence
    // précise — la route attend data = [{ id }].
    let selectCallCount = 0;
    mockFromChain.select = jest.fn((...args: unknown[]) => {
      selectCallCount++;
      // Le 5ème appel select est celui du update().select('id')
      // 1=dossier, 2=inscForStay, 3=stayForDocs ? Non stayForDocs via .select string.
      // Plus simple : détecter par l'argument 'id' string
      if (args[0] === 'id' && selectCallCount > 1) {
        // UPDATE ... .select('id')
        return Promise.resolve({ data: [{ id: 'dos-1' }], error: null }) as unknown as typeof mockFromChain;
      }
      return mockFromChain;
    }) as unknown as typeof mockFromChain.select;

    const res = await POST(req(), { params: params() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.partial_docs_missing).toEqual([]);
    expect(mockSendComplet).toHaveBeenCalledWith(
      expect.objectContaining({ bcc: 'sec@test.fr', referentEmail: 'ref@test.fr' }),
    );
    expect(mockSendNotif).toHaveBeenCalled();
    // Archivage structure : envoyé à gd_structures.email avec lien suivi_token
    expect(mockSendArchive).toHaveBeenCalledWith(
      expect.objectContaining({
        structureEmail: 'archivage@struct.fr',
        jeunePrenom: 'Enfant',
        jeuneNom: 'Nom',
        pdfLink: expect.stringContaining('token=token-abc-123'),
      }),
    );
    expect(mockSendArchive).toHaveBeenCalledWith(
      expect.objectContaining({
        pdfLink: expect.stringContaining('type=bulletin'),
      }),
    );
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'submit',
        metadata: expect.objectContaining({
          context: 'staff_submit_dossier',
          actor_role: 'secretariat',
          partial_docs: false,
          docs_missing_count: 0,
          structure_archive_sent: true,
        }),
      }),
    );
  });

  it('S8 — archivage structure : skip si gd_structures.email null', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });

    mockFromChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null }) // ownership
      .mockResolvedValueOnce({ data: { documents_requis: [] }, error: null }) // stay docs
      .mockResolvedValueOnce({ data: { email: null }, error: null }); // structure email = null
    mockFromChain.single
      .mockResolvedValueOnce({ data: dossierComplete(), error: null })
      .mockResolvedValueOnce({ data: { sejour_slug: 'summer' }, error: null })
      .mockResolvedValueOnce({
        data: {
          referent_email: 'ref@test.fr',
          referent_nom: 'Alice',
          jeune_prenom: 'Enfant',
          jeune_nom: 'Nom',
          dossier_ref: 'DOS-8',
          sejour_slug: 'summer',
          session_date: '2026-08-01',
          suivi_token: 'token-xyz',
        },
        error: null,
      });

    let selectCallCount = 0;
    mockFromChain.select = jest.fn((...args: unknown[]) => {
      selectCallCount++;
      if (args[0] === 'id' && selectCallCount > 1) {
        return Promise.resolve({ data: [{ id: 'dos-1' }], error: null }) as unknown as typeof mockFromChain;
      }
      return mockFromChain;
    }) as unknown as typeof mockFromChain.select;

    const res = await POST(req(), { params: params() });
    expect(res.status).toBe(200);
    expect(mockSendArchive).not.toHaveBeenCalled();
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: expect.objectContaining({ structure_archive_sent: false }),
      }),
    );
  });

  it('S9 — archivage structure : échec email NE BLOQUE PAS le 200 (fire-and-forget)', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'cds', email: 'cds@test.fr' });
    mockSendArchive.mockRejectedValueOnce(new Error('SMTP down'));

    mockFromChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null })
      .mockResolvedValueOnce({ data: { documents_requis: [] }, error: null })
      .mockResolvedValueOnce({ data: { email: 'archivage@struct.fr' }, error: null });
    mockFromChain.single
      .mockResolvedValueOnce({ data: dossierComplete(), error: null })
      .mockResolvedValueOnce({ data: { sejour_slug: 'summer' }, error: null })
      .mockResolvedValueOnce({
        data: {
          referent_email: 'ref@test.fr',
          referent_nom: 'Alice',
          jeune_prenom: 'Enfant',
          jeune_nom: 'Nom',
          dossier_ref: 'DOS-9',
          sejour_slug: 'summer',
          session_date: '2026-08-01',
          suivi_token: 'token-fail',
        },
        error: null,
      });

    let selectCallCount = 0;
    mockFromChain.select = jest.fn((...args: unknown[]) => {
      selectCallCount++;
      if (args[0] === 'id' && selectCallCount > 1) {
        return Promise.resolve({ data: [{ id: 'dos-1' }], error: null }) as unknown as typeof mockFromChain;
      }
      return mockFromChain;
    }) as unknown as typeof mockFromChain.select;

    const res = await POST(req(), { params: params() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('S2 — éducateur refusé (403)', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'educateur', email: 'educ@test.fr' });
    const res = await POST(req(), { params: params() });
    expect(res.status).toBe(403);
    expect(mockSendComplet).not.toHaveBeenCalled();
  });

  it('S3 — dossier incomplet → 400', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });
    mockFromChain.maybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });
    mockFromChain.single.mockResolvedValueOnce({
      data: { ...dossierComplete(), bulletin_completed: false },
      error: null,
    });
    const res = await POST(req(), { params: params() });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/incomplet/i);
  });

  it('S4 — dossier déjà envoyé → 409', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });
    mockFromChain.maybeSingle.mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null });
    mockFromChain.single.mockResolvedValueOnce({
      data: dossierComplete('2026-04-01T10:00:00Z'),
      error: null,
    });
    const res = await POST(req(), { params: params() });
    expect(res.status).toBe(409);
    expect(mockSendComplet).not.toHaveBeenCalled();
  });

  it('S6 — inscription autre structure → 404', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'cds', email: 'cds@test.fr' });
    mockFromChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const res = await POST(req(), { params: params() });
    expect(res.status).toBe(404);
  });

  it('S-invalid — ID non-UUID → 400', async () => {
    const res = await POST(req(), { params: params('not-a-uuid') });
    expect(res.status).toBe(400);
  });

  it('S7 — 4 blocs OK + PJ optionnelles manquantes → 200 + partial_docs_missing (règle CEO 2026-04-19)', async () => {
    mockResolve.mockResolvedValue({ structure: STRUCTURE, role: 'direction', email: 'dir@test.fr' });

    // Séquence identique à S1, mais stayForDocs retourne un doc requis
    // absent de documents_joints → doit passer en 200 + remonter dans la réponse.
    mockFromChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: VALID_UUID }, error: null }) // ownership
      .mockResolvedValueOnce({ data: { documents_requis: ['pass_nautique'] }, error: null }) // stay docs
      .mockResolvedValueOnce({ data: { email: 'archivage@struct.fr' }, error: null }); // structure email
    mockFromChain.single
      .mockResolvedValueOnce({ data: dossierComplete(), error: null }) // load dossier (documents_joints: [])
      .mockResolvedValueOnce({ data: { sejour_slug: 'nautique' }, error: null }) // inscForStay
      .mockResolvedValueOnce({
        data: {
          referent_email: 'ref@test.fr',
          referent_nom: 'Alice',
          jeune_prenom: 'Enfant',
          jeune_nom: 'Nom',
          dossier_ref: 'DOS-7',
          sejour_slug: 'nautique',
          session_date: '2026-08-01',
          suivi_token: 'token-s7',
        },
        error: null,
      });

    let selectCallCount = 0;
    mockFromChain.select = jest.fn((...args: unknown[]) => {
      selectCallCount++;
      if (args[0] === 'id' && selectCallCount > 1) {
        return Promise.resolve({ data: [{ id: 'dos-1' }], error: null }) as unknown as typeof mockFromChain;
      }
      return mockFromChain;
    }) as unknown as typeof mockFromChain.select;

    const res = await POST(req(), { params: params() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.partial_docs_missing).toContain('pass_nautique');
    expect(mockSendComplet).toHaveBeenCalled(); // envoi email OK malgré PJ manquante
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: expect.objectContaining({
          partial_docs: true,
          docs_missing_count: 1,
        }),
      }),
    );
  });
});
