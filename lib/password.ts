// lib/password.ts
import bcrypt from 'bcryptjs';

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export function isPasswordStrong(plain: string): { ok: boolean; reason?: string } {
  if (plain.length < 12) return { ok: false, reason: 'Au moins 12 caractères.' };
  if (!/[a-z]/.test(plain)) return { ok: false, reason: 'Au moins une minuscule.' };
  if (!/[A-Z]/.test(plain)) return { ok: false, reason: 'Au moins une majuscule.' };
  if (!/[0-9]/.test(plain)) return { ok: false, reason: 'Au moins un chiffre.' };
  return { ok: true };
}
