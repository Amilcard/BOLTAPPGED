import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited, getClientIpFromHeaders } from '@/lib/rate-limit';

const STRUCT_MAX_ATTEMPTS = 20;
const STRUCT_WINDOW_MINUTES = 15;

// P2.2 — bucket séparé pour actions à risque d'abus (invite/reinvite/revoke).
// Limite serrée (5/15min) pour éviter le spam d'invitations / révocations massives.
const STRUCT_STRICT_MAX_ATTEMPTS = 5;
const STRUCT_STRICT_WINDOW_MINUTES = 15;

export function getStructureClientIp(req: NextRequest): string {
  return getClientIpFromHeaders(req.headers);
}

export async function isStructureRateLimited(ip: string): Promise<boolean> {
  return isRateLimited('struct', ip, STRUCT_MAX_ATTEMPTS, STRUCT_WINDOW_MINUTES);
}

/**
 * Guard réutilisable pour toutes les routes structure.
 * Retourne une NextResponse 429 si rate limité, ou null si OK.
 */
export async function structureRateLimitGuard(req: NextRequest): Promise<NextResponse | null> {
  const ip = getStructureClientIp(req);
  if (await isStructureRateLimited(ip)) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Trop de tentatives. Réessayez dans quelques minutes.' } },
      { status: 429, headers: { 'Retry-After': '900' } }
    );
  }
  return null;
}

/**
 * P2.2 — Guard strict pour actions d'abus potentiel : invite, reinvite, revoke.
 * Bucket `struct-strict` séparé du bucket `struct` partagé → ne pollue pas les
 * reads/mutations normales. 5 tentatives / 15min par IP.
 */
export async function structureRateLimitGuardStrict(req: NextRequest): Promise<NextResponse | null> {
  const ip = getStructureClientIp(req);
  if (await isRateLimited('struct-strict', ip, STRUCT_STRICT_MAX_ATTEMPTS, STRUCT_STRICT_WINDOW_MINUTES)) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Trop de tentatives. Réessayez dans quelques minutes.' } },
      { status: 429, headers: { 'Retry-After': '900' } }
    );
  }
  return null;
}
