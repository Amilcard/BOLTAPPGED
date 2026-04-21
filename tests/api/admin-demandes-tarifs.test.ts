/**
 * @jest-environment node
 *
 * Tests intégration API — Admin demandes-tarifs (leads price-inquiry).
 *
 * GET    /api/admin/demandes-tarifs           — liste EDITOR+
 * GET    /api/admin/demandes-tarifs/[id]      — détail + auditLog read (PII)
 * PATCH  /api/admin/demandes-tarifs/[id]      — toggle traité (crm_synced_at)
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-key';
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-key!';

const mockFrom = jest.fn();
const mockAuditLog = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/audit-log', () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));

jest.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const SECRET = process.env.NEXTAUTH_SECRET;
if (!SECRET) throw new Error('NEXTAUTH_SECRET must be set for tests');

const ADMIN_TOKEN = jwt.sign({ userId: 'admin-1', email: 'admin@ged.fr', role: 'ADMIN' }, SECRET, { expiresIn: '1h' });
const EDITOR_TOKEN = jwt.sign({ userId: 'editor-1', email: 'editor@ged.fr', role: 'EDITOR' }, SECRET, { expiresIn: '1h' });
const VIEWER_TOKEN = jwt.sign({ userId: 'viewer-1', email: 'viewer@ged.fr', role: 'VIEWER' }, SECRET, { expiresIn: '1h' });

const LEAD_ID = 'aaa00000-0000-0000-0000-000000000042';

const SAMPLE = {
  id: LEAD_ID,
  contact_email: 'educ@mecs.fr',
  contact_phone: null,
  referent_organization: 'MECS Les Alpes',
  inclusion_level: 'adapté',
  child_age: 12,
  interests: ['sport'],
  urgence_48h: false,
  handicap: false,
  qf: 800,
  qpv: false,
  suggested_stays: [{ slug: 'alpes-ete', title: 'Alpes Été' }],
  alert_priority: 'HOT_LEAD',
  submitted_at: '2026-04-20T10:00:00Z',
  crm_synced_at: null,
  crm_lead_id: null,
  consent_at: '2026-04-20T10:00:00Z',
  user_agent: 'Mozilla/5.0',
};

function req(url: string, opts: { method?: string; token?: string; body?: object } = {}): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  return new NextRequest(`http://localhost:3000${url}`, {
    method: opts.method ?? 'GET',
    headers,
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
}

import { GET as listGET } from '@/app/api/admin/demandes-tarifs/route';
import { GET as detailGET, PATCH as detailPATCH } from '@/app/api/admin/demandes-tarifs/[id]/route';

// ─────────────────────────────────────────────────────────────
// GET /api/admin/demandes-tarifs (liste)
// ─────────────────────────────────────────────────────────────

describe('GET /api/admin/demandes-tarifs', () => {
  beforeEach(() => {
    mockAuditLog.mockClear();
    mockFrom.mockReset();
  });

  /**
   * Chaîne builder Supabase renvoyée par .from():
   *   .select(...).order(...).range(...).ilike(...).ilike(...).gte(...)
   * On renvoie un proxy qui accepte n'importe quel .ilike/.gte/.is/.not
   * et termine sur un thenable résolvant { data, count, error }.
   */
  const chainResolve = (result: { data: unknown[]; count: number; error: null | object }) => {
    const thenable = {
      ilike: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      then: (resolve: (r: typeof result) => unknown) => resolve(result),
    };
    return thenable;
  };

  const wireList = (result: { data: unknown[]; count: number; error: null | object }) => {
    const chain = chainResolve(result);
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          range: jest.fn().mockReturnValue(chain),
        }),
      }),
    });
    return chain;
  };

  it('retourne 401 sans auth', async () => {
    wireList({ data: [SAMPLE], count: 1, error: null });
    const res = await listGET(req('/api/admin/demandes-tarifs'));
    expect(res.status).toBe(401);
  });

  it('retourne 401 si rôle VIEWER', async () => {
    wireList({ data: [SAMPLE], count: 1, error: null });
    const res = await listGET(req('/api/admin/demandes-tarifs', { token: VIEWER_TOKEN }));
    expect(res.status).toBe(401);
  });

  it('retourne 200 + liste si EDITOR', async () => {
    wireList({ data: [SAMPLE], count: 1, error: null });
    const res = await listGET(req('/api/admin/demandes-tarifs', { token: EDITOR_TOKEN }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
  });

  it('applique ilike quand filtre email fourni', async () => {
    const chain = wireList({ data: [], count: 0, error: null });
    await listGET(req('/api/admin/demandes-tarifs?email=mecs', { token: EDITOR_TOKEN }));
    expect(chain.ilike).toHaveBeenCalledWith('contact_email', '%mecs%');
  });

  it('applique gte quand window=30d', async () => {
    const chain = wireList({ data: [], count: 0, error: null });
    await listGET(req('/api/admin/demandes-tarifs?window=30d', { token: ADMIN_TOKEN }));
    expect(chain.gte).toHaveBeenCalledWith('submitted_at', expect.any(String));
  });

  it('rejette limit > 100 (Zod max)', async () => {
    wireList({ data: [], count: 0, error: null });
    const res = await listGET(req('/api/admin/demandes-tarifs?limit=500', { token: ADMIN_TOKEN }));
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/demandes-tarifs/[id] (détail + auditLog)
// ─────────────────────────────────────────────────────────────

describe('GET /api/admin/demandes-tarifs/[id]', () => {
  beforeEach(() => {
    mockAuditLog.mockClear();
    mockFrom.mockReset();
  });

  const wireDetail = (data: unknown, error: object | null = null) => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data, error }),
        }),
      }),
    });
  };

  it('retourne 401 sans auth', async () => {
    wireDetail(SAMPLE);
    const res = await detailGET(req(`/api/admin/demandes-tarifs/${LEAD_ID}`), {
      params: Promise.resolve({ id: LEAD_ID }),
    });
    expect(res.status).toBe(401);
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it('retourne 400 si id non UUID', async () => {
    wireDetail(SAMPLE);
    const res = await detailGET(req('/api/admin/demandes-tarifs/not-uuid', { token: EDITOR_TOKEN }), {
      params: Promise.resolve({ id: 'not-uuid' }),
    });
    expect(res.status).toBe(400);
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it('retourne 404 si lead inexistant', async () => {
    wireDetail(null);
    const res = await detailGET(req(`/api/admin/demandes-tarifs/${LEAD_ID}`, { token: EDITOR_TOKEN }), {
      params: Promise.resolve({ id: LEAD_ID }),
    });
    expect(res.status).toBe(404);
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it('retourne 200 + déclenche auditLog read sur consultation (PII)', async () => {
    wireDetail(SAMPLE);
    const res = await detailGET(req(`/api/admin/demandes-tarifs/${LEAD_ID}`, { token: EDITOR_TOKEN }), {
      params: Promise.resolve({ id: LEAD_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(LEAD_ID);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    const [, entry] = mockAuditLog.mock.calls[0];
    expect(entry.action).toBe('read');
    expect(entry.resourceType).toBe('smart_form_submission');
    expect(entry.resourceId).toBe(LEAD_ID);
    expect(entry.actorType).toBe('admin');
    expect(entry.actorId).toBe('editor@ged.fr');
  });
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/demandes-tarifs/[id] (toggle traité)
// ─────────────────────────────────────────────────────────────

describe('PATCH /api/admin/demandes-tarifs/[id]', () => {
  beforeEach(() => {
    mockAuditLog.mockClear();
    mockFrom.mockReset();
  });

  const wireUpdate = (data: unknown, error: object | null = null) => {
    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data, error }),
          }),
        }),
      }),
    });
  };

  it('retourne 401 sans auth', async () => {
    wireUpdate({ id: LEAD_ID });
    const res = await detailPATCH(
      req(`/api/admin/demandes-tarifs/${LEAD_ID}`, { method: 'PATCH', body: { treated: true } }),
      { params: Promise.resolve({ id: LEAD_ID }) }
    );
    expect(res.status).toBe(401);
  });

  it('retourne 400 si body invalide', async () => {
    wireUpdate({ id: LEAD_ID });
    const res = await detailPATCH(
      req(`/api/admin/demandes-tarifs/${LEAD_ID}`, {
        method: 'PATCH',
        token: EDITOR_TOKEN,
        body: { treated: 'yes' },
      }),
      { params: Promise.resolve({ id: LEAD_ID }) }
    );
    expect(res.status).toBe(400);
  });

  it('retourne 200 + auditLog update quand treated=true (EDITOR)', async () => {
    wireUpdate({ id: LEAD_ID, crm_synced_at: new Date().toISOString(), crm_lead_id: null });
    const res = await detailPATCH(
      req(`/api/admin/demandes-tarifs/${LEAD_ID}`, {
        method: 'PATCH',
        token: EDITOR_TOKEN,
        body: { treated: true },
      }),
      { params: Promise.resolve({ id: LEAD_ID }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    const [, entry] = mockAuditLog.mock.calls[0];
    expect(entry.action).toBe('update');
    expect(entry.resourceType).toBe('smart_form_submission');
    expect(entry.metadata.treated).toBe(true);
  });
});
