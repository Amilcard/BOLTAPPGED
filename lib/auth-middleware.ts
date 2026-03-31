import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
}

export function verifyAuth(request: NextRequest): AuthPayload | null {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : request.cookies.get('gd_session')?.value;

    if (!token) return null;

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return null; // Fail-safe: jamais valider sans secret
    const payload = jwt.verify(token, secret) as AuthPayload;

    return payload;
  } catch {
    return null;
  }
}

export function requireAdmin(request: NextRequest): AuthPayload | null {
  const auth = verifyAuth(request);
  if (!auth || auth.role !== 'ADMIN') return null;
  return auth;
}

export function requireEditor(request: NextRequest): AuthPayload | null {
  const auth = verifyAuth(request);
  if (!auth || !['ADMIN', 'EDITOR'].includes(auth.role)) return null;
  return auth;
}

export function unauthorizedResponse() {
  return new (require('next/server').NextResponse)(
    JSON.stringify({ error: 'Non autorisé' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );
}
