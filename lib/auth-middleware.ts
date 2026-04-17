import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export interface AuthPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
  jti?: string;
}

export async function verifyAuth(request: NextRequest): Promise<AuthPayload | null> {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : request.cookies.get('gd_session')?.value;

    if (!token) return null;

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return null; // Fail-safe: jamais valider sans secret
    const encodedSecret = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, encodedSecret);

    // Vérification révocation jti
    const jti = payload.jti;
    if (jti) {
      const { data: revoked } = await getSupabaseAdmin()
        .from('gd_revoked_tokens')
        .select('jti')
        .eq('jti', jti)
        .maybeSingle();
      if (revoked) return null;
    }

    return payload as unknown as AuthPayload;
  } catch {
    return null;
  }
}

export async function requireAdmin(request: NextRequest): Promise<AuthPayload | null> {
  const auth = await verifyAuth(request);
  if (!auth || auth.role !== 'ADMIN') return null;
  return auth;
}

export async function requireEditor(request: NextRequest): Promise<AuthPayload | null> {
  const auth = await verifyAuth(request);
  if (!auth || !['ADMIN', 'EDITOR'].includes(auth.role)) return null;
  return auth;
}

export type ProStructureRole = 'direction' | 'cds' | 'cds_delegated' | 'secretariat' | 'educateur';

export interface ProSessionPayload {
  role: 'pro';
  email: string;
  structureCode: string;
  structureName: string;
  structureRole: ProStructureRole;
  structureId: string;
  type: 'pro_session';
  jti?: string;
}

export async function verifyProSession(request: NextRequest): Promise<ProSessionPayload | null> {
  try {
    const token = request.cookies.get('gd_pro_session')?.value;
    if (!token) return null;

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return null;
    const encodedSecret = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, encodedSecret);

    if ((payload as Record<string, unknown>).type !== 'pro_session') return null;

    // Vérification révocation jti
    const jti = payload.jti;
    if (jti) {
      const { data: revoked } = await getSupabaseAdmin()
        .from('gd_revoked_tokens')
        .select('jti')
        .eq('jti', jti)
        .maybeSingle();
      if (revoked) return null;
    }

    // Fallback legacy : tokens émis avant 2026-04 peuvent manquer structureRole/structureId
    const raw = payload as Record<string, unknown>;
    if (!raw.structureRole || !raw.structureId) {
      const code = typeof raw.structureCode === 'string' ? raw.structureCode : null;
      if (!code) return null;
      const { resolveCodeToStructure } = await import('@/lib/structure');
      const resolved = await resolveCodeToStructure(code);
      if (!resolved) return null;
      raw.structureRole = resolved.role;
      raw.structureId = resolved.structure.id as string;
    }
    return raw as unknown as ProSessionPayload;
  } catch {
    return null;
  }
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
}

// ─────────────────────────────────────────────────────────────
// buildProSessionToken — factorisation JWT pro_session (#11)
// ─────────────────────────────────────────────────────────────

export interface BuildProSessionTokenInput {
  email: string;
  structureCode: string;
  structureName: string;
  structureRole: ProStructureRole;
  structureId: string;
  expiresIn: '30m' | '8h';
}

export interface BuildProSessionTokenOutput {
  token: string;
  jti: string;
  expiresAt: string; // ISO
}

/**
 * Factorise la création du JWT `pro_session` entre structure-login et pro-session.
 * Retourne null si NEXTAUTH_SECRET manquant.
 */
export async function buildProSessionToken(
  input: BuildProSessionTokenInput
): Promise<BuildProSessionTokenOutput | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error('[buildProSessionToken] NEXTAUTH_SECRET manquant');
    return null;
  }
  const encodedSecret = new TextEncoder().encode(secret);
  const jti = crypto.randomUUID();
  const ttlMs = input.expiresIn === '8h' ? 8 * 3600 * 1000 : 30 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const token = await new SignJWT({
    role: 'pro',
    type: 'pro_session',
    email: input.email,
    structureCode: input.structureCode,
    structureName: input.structureName,
    structureRole: input.structureRole,
    structureId: input.structureId,
    jti,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(input.expiresIn)
    .sign(encodedSecret);
  return { token, jti, expiresAt };
}
