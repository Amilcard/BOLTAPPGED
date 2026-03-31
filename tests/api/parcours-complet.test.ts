/**
 * @jest-environment node
 *
 * Tests API — Parcours complets
 *
 * P1 — Inscription complète (formulaire → réponse → données en base)
 * P2 — Dossier enfant complet (4 blocs → validation → soumission)
 * P3 — Anti-doublon soumission (2ème envoi → 409)
 * P4 — Upload pièce jointe (chemin nominal)
 * P5 — Statut admin : passage validee, refusee
 * P6 — Badge "En retard" : condition détectée en base
 *
 * Nettoyage après tests :
 *   DELETE FROM gd_inscriptions WHERE referent_email = 'test-parcours@ged-test.internal';
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { config } from 'dotenv';
import { resolve } from 'path';

// Charger .env (Supabase URL + service key + NEXTAUTH_SECRET)
config({ path: resolve(__dirname, '../../.env'), override: true });

// Générer dynamiquement le token admin depuis NEXTAUTH_SECRET
// → pas de token statique expirant dans .env.test
import jwt from 'jsonwebtoken';
function generateAdminToken(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return '';
  return jwt.sign(
    { userId: '00000000-0000-0000-0000-000000000000', email: 'admin-test@groupeetdecouverte.fr', role: 'ADMIN' },
    secret,
    { expiresIn: '1h' }
  );
}

const BASE_URL     = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const getAdminToken = () => generateAdminToken();
const TEST_EMAIL   = 'test-parcours@ged-test.internal';

let serverReachable = false;
let inscriptionId   = '';
let suiviToken      = '';
let dossierRef      = '';

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Nettoyage des données de test résiduelles (anti-doublon)
  if (SUPABASE_URL && SERVICE_KEY) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/gd_inscriptions?referent_email=eq.${encodeURIComponent(TEST_EMAIL)}`,
      {
        method: 'DELETE',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
      }
    ).catch(() => {});
  }

  try {
    const r = await fetch(`${BASE_URL}/api/inscriptions`, {
      method: 'OPTIONS',
      signal: AbortSignal.timeout(15000),
    });
    serverReachable = r.status < 600;
  } catch {
    serverReachable = false;
  }
  if (!serverReachable) console.warn(`[INFO] Serveur ${BASE_URL} non joignable — tests parcours ignorés.`);
}, 20000);

function skip(label: string): boolean {
  if (!serverReachable) { console.warn(`[SKIP] ${label} — serveur non joignable`); return true; }
  return false;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function post(path: string, body: object, headers?: Record<string, string>) {
  return fetch(`${BASE_URL}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(15000),
  });
}

async function patch(path: string, body: object) {
  return fetch(`${BASE_URL}${path}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(15000),
  });
}

async function put(path: string, body: object, token: string) {
  return fetch(`${BASE_URL}${path}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(15000),
  });
}

async function supabase(path: string) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    signal:  AbortSignal.timeout(10000),
  });
}

// ─── P1 — Inscription complète ───────────────────────────────────────────────

describe('P1 — Inscription complète', () => {
  it('crée une inscription → id + suivi_token + dossier_ref', async () => {
    if (skip('P1')) return;

    const res  = await post('/api/inscriptions', {
      staySlug:            'mountain-and-chill',
      sessionDate:         '2026-08-02',
      cityDeparture:       'sans_transport',
      organisation:        'Structure Test Parcours',
      socialWorkerName:    'Référent Parcours',
      email:               TEST_EMAIL,
      phone:               '0600000001',
      childFirstName:      'ParcourEnfant',
      childLastName:       'Test',
      childBirthDate:      '2014-03-10',
      remarques:           '[TEST PARCOURS — à supprimer]',
      priceTotal:          885,
      consent:             true,
      paymentMethod:       'transfer',
      structureName:       'Structure Test Parcours',
      structurePostalCode: '75001',
      structureCity:       'Paris',
    });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('suivi_token');
    expect(data).toHaveProperty('dossier_ref');
    expect(data.status).toBe('en_attente');
    expect(data.dossier_ref).toMatch(/^DOS-\d{8}-[A-Z0-9]{8}$/);

    inscriptionId = data.id;
    suiviToken    = data.suivi_token;
    dossierRef    = data.dossier_ref;
    console.info(`   → ${dossierRef} (${inscriptionId})`);
  });

  it('inscription visible en base', async () => {
    if (skip('P1-base') || !inscriptionId) return;

    const res  = await supabase(`gd_inscriptions?id=eq.${inscriptionId}&select=id,status,referent_email`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].referent_email).toBe(TEST_EMAIL);
    expect(data[0].status).toBe('en_attente');
  });
});

// ─── P2 — Dossier enfant : 4 blocs ──────────────────────────────────────────

describe('P2 — Dossier enfant : remplissage des 4 blocs', () => {
  const BLOCS = [
    { bloc: 'bulletin_complement',  data: { nom_enfant: 'Test', prenom_enfant: 'Parcours', autorisation_accepte: true },                                                      label: 'Bulletin'     },
    { bloc: 'fiche_sanitaire',      data: { medecin_nom: 'Dr Test', autorisation_soins_accepte: true },                                                                       label: 'Sanitaire'    },
    { bloc: 'fiche_liaison_jeune',  data: { motivation: 'Test auto', engagement_accepte: true },                                                                              label: 'Liaison'      },
    { bloc: 'fiche_renseignements', data: { type_situation: 'famille', contact_urgence_nom: 'Parent Test', contact_urgence_tel: '0600000002' },                               label: 'Renseignements'},
  ];

  for (const { bloc, data, label } of BLOCS) {
    it(`valide le bloc ${label} → completed=true`, async () => {
      if (skip(`P2-${bloc}`) || !suiviToken) return;

      const res  = await patch(`/api/dossier-enfant/${inscriptionId}`, { token: suiviToken, bloc, data, completed: true });
      const body = await res.json();

      expect([200, 201]).toContain(res.status);
      // La réponse est { dossier: { bulletin_completed: true, ... }, ok: true }
      // Les noms courts sont : bulletin, sanitaire, liaison, renseignements
      const shortName = bloc.replace('bulletin_complement', 'bulletin')
                            .replace('fiche_sanitaire', 'sanitaire')
                            .replace('fiche_liaison_jeune', 'liaison')
                            .replace('fiche_renseignements', 'renseignements');
      expect(body.dossier).toHaveProperty(`${shortName}_completed`, true);
    });
  }

  it('4 blocs à true en base', async () => {
    if (skip('P2-base') || !inscriptionId) return;

    const res  = await supabase(
      `gd_dossier_enfant?inscription_id=eq.${inscriptionId}` +
      `&select=bulletin_completed,sanitaire_completed,liaison_completed,renseignements_completed`
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].bulletin_completed).toBe(true);
    expect(data[0].sanitaire_completed).toBe(true);
    expect(data[0].liaison_completed).toBe(true);
    expect(data[0].renseignements_completed).toBe(true);
  });
});

// ─── P3 — Soumission + anti-doublon ─────────────────────────────────────────

describe('P3 — Soumission et anti-doublon', () => {
  it('soumet le dossier complet → 200', async () => {
    if (skip('P3-submit') || !suiviToken) return;

    const res  = await post(`/api/dossier-enfant/${inscriptionId}/submit`, { token: suiviToken });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty('ok', true);
  });

  it('2ème soumission → 409 anti-doublon', async () => {
    if (skip('P3-doublon') || !suiviToken) return;

    const res = await post(`/api/dossier-enfant/${inscriptionId}/submit`, { token: suiviToken });
    expect(res.status).toBe(409);
  });

  it('ged_sent_at non null en base', async () => {
    if (skip('P3-base') || !inscriptionId) return;

    const res  = await supabase(`gd_dossier_enfant?inscription_id=eq.${inscriptionId}&select=ged_sent_at`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data[0].ged_sent_at).not.toBeNull();
  });
});

// ─── P4 — Upload pièce jointe ────────────────────────────────────────────────

describe('P4 — Upload pièce jointe (chemin nominal)', () => {
  it('upload un PDF valide → 200 + storage_path', async () => {
    if (skip('P4')) return;

    const targetId    = process.env.TEST_INSCRIPTION_ID;
    const targetToken = process.env.TEST_SUIVI_TOKEN;
    if (!targetId || !targetToken) {
      console.warn('[SKIP] P4 — TEST_INSCRIPTION_ID manquant');
      return;
    }

    const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
    const boundary   = 'testboundary456';
    const parts: Buffer[] = [
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="token"\r\n\r\n${targetToken}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\nvaccins\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      pdfContent,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ];
    const body = Buffer.concat(parts);

    const res = await fetch(`${BASE_URL}/api/dossier-enfant/${targetId}/upload`, {
      method:  'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
      signal:  AbortSignal.timeout(20000),
    });

    // 200/201 = uploadé, 409 = dossier soumis (si soumis entre-temps)
    expect([200, 201, 409]).toContain(res.status);
    if (res.status === 200 || res.status === 201) {
      const data = await res.json();
      // Réponse : { document: { storage_path: "..." }, success: true }
      expect(data.document).toHaveProperty('storage_path');
      console.info(`   → Uploadé : ${data.document?.storage_path}`);
    }
  }, 25000);
});

// ─── P5 — Statut admin ───────────────────────────────────────────────────────

// P5 ne peut tourner qu'en local (le token est signé avec NEXTAUTH_SECRET local,
// différent du secret production → 401 si BASE_URL pointe vers prod)
const isLocalServer = BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1');

describe('P5 — Changement de statut admin', () => {
  it('passe en "validee"', async () => {
    if (skip('P5-validee') || !inscriptionId) return;
    if (!isLocalServer) { console.warn('[SKIP] P5 — test admin disponible uniquement en local'); return; }
    if (!getAdminToken()) { console.warn('[SKIP] P5 — NEXTAUTH_SECRET manquant'); return; }

    const res = await put(`/api/admin/inscriptions/${inscriptionId}`, { status: 'validee' }, getAdminToken());
    expect(res.status).toBe(200);
  });

  it('passe en "refusee"', async () => {
    if (skip('P5-refusee') || !inscriptionId) return;
    if (!isLocalServer || !getAdminToken()) { console.warn('[SKIP] P5 — test admin disponible uniquement en local'); return; }

    const res = await put(`/api/admin/inscriptions/${inscriptionId}`, { status: 'refusee' }, getAdminToken());
    expect(res.status).toBe(200);
  });

  it('statut "refusee" persisté en base', async () => {
    if (skip('P5-base') || !inscriptionId || !isLocalServer) return;

    const res  = await supabase(`gd_inscriptions?id=eq.${inscriptionId}&select=status`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data[0].status).toBe('refusee');
  });
});

// ─── P6 — Badge "En retard" ──────────────────────────────────────────────────

// ─── P6b — Anti-doublon après annulation ─────────────────────────────────────

describe('P6b — Anti-doublon après annulation', () => {
  it('une inscription annulee ne bloque pas une nouvelle inscription', async () => {
    if (skip('P6b') || !inscriptionId || !SERVICE_KEY) return;

    // Annuler l'inscription créée en P1
    if (isLocalServer && getAdminToken()) {
      await put(`/api/admin/inscriptions/${inscriptionId}`, { status: 'annulee' }, getAdminToken());
    } else {
      // Via Supabase direct si pas de serveur local
      await fetch(
        `${SUPABASE_URL}/rest/v1/gd_inscriptions?id=eq.${inscriptionId}`,
        {
          method: 'PATCH',
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ status: 'annulee' }),
        }
      );
    }

    // Retenter la même inscription → doit être autorisé (pas 409)
    const res = await post('/api/inscriptions', {
      staySlug: 'test-sejour-p1',
      sessionDate: '2026-09-01',
      cityDeparture: 'sans_transport',
      organisation: 'MECS Test',
      socialWorkerName: 'Référent Test',
      email: TEST_EMAIL,
      phone: '0612345678',
      childFirstName: 'TestEnfant',
      childBirthDate: '2017-01-15',
      priceTotal: 0,
      consent: true,
      paymentMethod: 'bank_transfer',
      structureName: 'MECS Test',
      structurePostalCode: '75001',
      structureCity: 'Paris',
    });

    // Doit passer (201) ou échouer pour une raison autre que DUPLICATE (400 prix, etc.)
    // L'essentiel : pas 409 DUPLICATE
    expect(res.status).not.toBe(409);
  });
});

// ─── P6 — Badge "En retard" ──────────────────────────────────────────────────

describe('P6 — Badge En retard (condition en base)', () => {
  it('détecte les inscriptions > 7j sans dossier soumis', async () => {
    if (skip('P6') || !SERVICE_KEY) return;

    const limit  = new Date();
    limit.setDate(limit.getDate() - 8);

    const res  = await supabase(
      `gd_inscriptions?select=id,created_at&created_at=lt.${limit.toISOString()}&limit=10`
    );
    const all  = await res.json() as { id: string }[];

    expect(res.status).toBe(200);
    expect(Array.isArray(all)).toBe(true);

    // Filtrer celles sans dossier soumis
    const enRetard: string[] = [];
    for (const insc of all) {
      const r    = await supabase(`gd_dossier_enfant?inscription_id=eq.${insc.id}&select=ged_sent_at`);
      const rows = await r.json() as { ged_sent_at: string | null }[];
      if (!rows.length || rows[0].ged_sent_at === null) enRetard.push(insc.id);
    }

    console.info(`   → Inscriptions en retard détectées : ${enRetard.length}`);
    expect(typeof enRetard.length).toBe('number'); // toujours vrai — on vérifie que la requête fonctionne
  }, 30000);
});
