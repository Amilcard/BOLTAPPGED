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
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.slice(7);
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
