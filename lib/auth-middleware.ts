import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export interface AuthPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
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

export interface ProSessionPayload {
  role: 'pro';
  email: string;
  structureCode: string;
  structureName: string;
  type: 'pro_session';
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

    return payload as unknown as ProSessionPayload;
  } catch {
    return null;
  }
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
}
