/**
 * @jest-environment node
 *
 * Tests de régression ciblés — GET /api/dossier-enfant/[inscriptionId]/pdf
 *
 * Défauts confirmés couverts uniquement :
 *  1. dates segmentées : les dates restent rendues comme chaînes complètes DD/MM/YYYY
 *  2. cases cochées : les bons "X" sont posés pour les choix booléens
 *  3. champs sensibles bulletin / sanitaire / liaison : les données attendues sont projetées
 *  4. non-régression triviale sur Content-Type et nom de fichier
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake';

type DrawTextCall = {
  pageIndex: number;
  text: string;
  options: { x: number; y: number; size?: number; font?: unknown; color?: unknown };
};

const drawTextCalls: DrawTextCall[] = [];

function makePage(pageIndex: number) {
  return {
    getSize: () => ({ width: 595, height: 842 }),
    drawText: jest.fn((text: string, options: DrawTextCall['options']) => {
      drawTextCalls.push({ pageIndex, text, options });
    }),
    drawImage: jest.fn(),
  };
}

const pdfPages = [makePage(0), makePage(1), makePage(2)];
const pdfDocMock = {
  getPages: jest.fn(() => pdfPages),
  embedFont: jest.fn(async (fontName: string) => fontName),
  embedPng: jest.fn(async () => ({ width: 120, height: 25 })),
  save: jest.fn(async () => new Uint8Array([0x25, 0x50, 0x44, 0x46])),
};

const pdfLoadMock = jest.fn(async (..._args: unknown[]) => pdfDocMock);

jest.mock('pdf-lib', () => ({
  PDFDocument: { load: (...args: unknown[]) => pdfLoadMock(...args) },
  StandardFonts: { Helvetica: 'Helvetica', HelveticaBold: 'HelveticaBold' },
  rgb: (...args: number[]) => ({ rgb: args }),
}));

const readFileMock = jest.fn(async (..._args: unknown[]) => Buffer.from('%PDF-template'));
jest.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => readFileMock(...args),
}));

const verifyOwnershipMock = jest.fn();
jest.mock('@/lib/verify-ownership', () => ({
  verifyOwnership: (...args: unknown[]) => verifyOwnershipMock(...args),
}));

const auditLogMock = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/audit-log', () => ({
  auditLog: (...args: unknown[]) => auditLogMock(...args),
}));

const mockFrom = jest.fn();
jest.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/dossier-enfant/[inscriptionId]/pdf/route';

const INSCRIPTION_ID = '11111111-2222-4333-8444-555555555555';
const TOKEN = 'aaaaaaa1-bbbb-4ccc-8ddd-eeeeeeeeeeee';

function makeReq(type: 'bulletin' | 'sanitaire' | 'liaison'): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/dossier-enfant/${INSCRIPTION_ID}/pdf?token=${TOKEN}&type=${type}`,
    { method: 'GET' },
  );
}

function makeParams() {
  return { params: Promise.resolve({ inscriptionId: INSCRIPTION_ID }) };
}

function setupSupabase(opts: {
  inscription?: Record<string, unknown>;
  dossier?: Record<string, unknown>;
  stay?: Record<string, unknown> | null;
}) {
  const inscription = {
    referent_email: 'parent@example.test',
    jeune_prenom: 'Lea',
    jeune_nom: 'Martin',
    jeune_date_naissance: '2012-08-14',
    jeune_sexe: 'F',
    sejour_slug: 'sejour-ocean',
    session_date: '2026-07-21',
    referent_nom: 'Mme Martin',
    organisation: 'MECS Horizon',
    city_departure: 'Lyon',
    ...opts.inscription,
  };

  const dossier = {
    created_at: '2026-04-20T09:30:00.000Z',
    bulletin_complement: {},
    fiche_sanitaire: {},
    fiche_liaison_jeune: {},
    ...opts.dossier,
  };

  const stay = {
    marketing_title: 'Cap Ocean',
    ...opts.stay,
  };

  mockFrom.mockImplementation((table: string) => {
    if (table === 'gd_inscriptions') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: inscription, error: null }),
          }),
        }),
      };
    }

    if (table === 'gd_dossier_enfant') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: dossier, error: null }),
          }),
        }),
      };
    }

    if (table === 'gd_stays') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: stay, error: null }),
          }),
        }),
      };
    }

    throw new Error(`Unexpected table ${table}`);
  });
}

function findText(text: string, pageIndex?: number) {
  return drawTextCalls.find((call) => call.text === text && (pageIndex === undefined || call.pageIndex === pageIndex));
}

function findX(x: number, yFromTop: number, pageIndex: number) {
  const expectedBottomY = 842 - yFromTop;
  return drawTextCalls.find((call) =>
    call.pageIndex === pageIndex
    && call.text === 'X'
    && call.options.x === x
    && call.options.y === expectedBottomY,
  );
}

function findAnyText(parts: string[], pageIndex?: number) {
  return parts.every((part) => findText(part, pageIndex));
}

beforeEach(() => {
  jest.clearAllMocks();
  drawTextCalls.length = 0;
  verifyOwnershipMock.mockResolvedValue({
    ok: true,
    status: 200,
    code: 'OK',
    message: 'ok',
    referentEmail: 'parent@example.test',
  });
});

describe('GET /api/dossier-enfant/[inscriptionId]/pdf', () => {
  it('bulletin: place les coches dans les bonnes colonnes, injecte le nom de l’enfant et segmente la date de signature', async () => {
    setupSupabase({
      dossier: {
        created_at: '2026-04-20T09:30:00.000Z',
        bulletin_complement: {
          nom_famille: 'Martin',
          adresse_permanente: '12 rue des Lilas',
          mail: 'famille.martin@example.test',
          envoi_fiche_liaison: 'depart',
          financement_ase: true,
          financement_famille: false,
          soussigne_nom: 'Claire Martin',
          autorisation_fait_a: 'Paris',
          date_signature: '22/04/2026',
        },
        fiche_sanitaire: {
          sexe: 'fille',
          resp1_tel_portable: '0601020304',
        },
      },
    });

    const res = await GET(makeReq('bulletin'), makeParams());

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain("Bulletin_Inscription_Lea_Martin.pdf");

    expect(findText('14/08/2012', 0)).toBeTruthy();
    expect(findText('21/07/2026', 0)).toBeTruthy();
    expect(findText('Claire Martin', 0)).toBeTruthy();
    expect(findText('Lea Martin', 0)).toBeTruthy();
    expect(findText('0601020304', 0)).toBeTruthy();
    expect(findText('famille.martin@example.test', 0)).toBeTruthy();
    expect(findText('22/04/2026', 0)).toBeFalsy();
    // L'année "/ 2026" est imprimée par le template PDF (cf. commit 4d6c335).
    // Le code n'écrit que jour + mois pour éviter le doublon visuel.
    expect(findAnyText(['22', '04'], 0)).toBeTruthy();

    expect(findX(150, 397, 0)).toBeFalsy();
    expect(findX(265, 397, 0)).toBeTruthy();
    expect(findX(150, 375, 0)).toBeFalsy();
    expect(findX(35, 580, 0)).toBeFalsy();
    expect(findX(175, 580, 0)).toBeTruthy();
    expect(findX(35, 612, 0)).toBeFalsy();
  });

  it('sanitaire: segmente la date de naissance, place les coches dans les cases et évite le texte combiné dans allergies', async () => {
    setupSupabase({
      inscription: {
        jeune_prenom: 'Nora',
        jeune_nom: 'Diallo',
        jeune_date_naissance: '2011-02-03',
      },
      dossier: {
        fiche_sanitaire: {
          classe: '6e B',
          sexe: 'fille',
          pai: true,
          aeeh: false,
          resp1_nom: 'Diallo',
          resp1_prenom: 'Aminata',
          resp1_tel_portable: '0611223344',
          traitement_en_cours: true,
          traitement_detail: 'Ventoline matin et soir',
          allergie_asthme: 'oui',
          allergie_detail: 'Crise a l effort',
          autorisation_soins_soussigne: 'Aminata Diallo',
          fait_a: 'Roubaix',
          date_signature: '24/04/2026',
        },
      },
    });

    const res = await GET(makeReq('sanitaire'), makeParams());

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain("Fiche_Sanitaire_Nora_Diallo.pdf");

    expect(findText('03/02/2011', 0)).toBeFalsy();
    expect(findAnyText(['03', '02', '2011'], 0)).toBeTruthy();
    expect(findText('0611223344', 0)).toBeTruthy();
    expect(findText('Ventoline matin et soir', 1)).toBeTruthy();
    expect(findText('Asthme — Crise a l effort', 1)).toBeFalsy();
    expect(findText('Crise a l effort', 1)).toBeTruthy();

    expect(findX(412, 187, 0)).toBeTruthy();
    expect(findX(350, 187, 0)).toBeFalsy();
    expect(findX(166, 250, 0)).toBeTruthy();
    expect(findX(472, 258, 1)).toBeFalsy();
    expect(findX(520, 258, 1)).toBeTruthy();
  });

  it('liaison: coche les bonnes cases, respecte la date fournie et conserve un nom de fichier liaison', async () => {
    setupSupabase({
      inscription: {
        jeune_prenom: 'Yanis',
        jeune_nom: 'Benali',
        jeune_date_naissance: '2010-11-09',
        session_date: '2026-08-05',
      },
      dossier: {
        fiche_liaison_jeune: {
          etablissement_nom: 'MECS du Parc',
          etablissement_adresse: '8 avenue du Parc',
          etablissement_cp: '59000',
          etablissement_ville: 'Lille',
          resp_etablissement_nom: 'Durand',
          resp_etablissement_prenom: 'Lucie',
          resp_etablissement_tel1: '0320123456',
          resp_etablissement_tel2: '0699887766',
          choix_seul: 'oui',
          choix_ami: 'non',
          choix_educateur: 'oui',
          deja_parti: 'non',
          deja_parti_detail: 'Sejour neige 2025',
          pourquoi_ce_sejour: 'Prendre confiance et decouvrir la voile.',
          fiche_technique_lue: 'oui',
          signature_fait_a: 'Lille',
          date_signature: '20/04/2026',
        },
      },
    });

    const res = await GET(makeReq('liaison'), makeParams());

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain("Fiche_Liaison_Yanis_Benali.pdf");

    expect(findText('09/11/2010', 0)).toBeTruthy();
    expect(findText('05/08/2026', 0)).toBeTruthy();
    expect(findText('20/04/2026', 0)).toBeTruthy();
    expect(findText('0320123456', 0)).toBeTruthy();
    expect(findText('0699887766', 0)).toBeTruthy();
    expect(findText('Prendre confiance et decouvrir la voile.', 0)).toBeTruthy();

    expect(findX(76, 511, 0)).toBeFalsy();
    expect(findX(90, 511, 0)).toBeTruthy();
    expect(findX(274, 511, 0)).toBeFalsy();
    expect(findX(290, 511, 0)).toBeTruthy();
    expect(findX(496, 511, 0)).toBeFalsy();
    expect(findX(524, 511, 0)).toBeTruthy();
    expect(findX(259, 530, 0)).toBeFalsy();
    expect(findX(273, 530, 0)).toBeTruthy();
    expect(findX(303, 617, 0)).toBeFalsy();
    expect(findX(375, 617, 0)).toBeTruthy();
  });
});
