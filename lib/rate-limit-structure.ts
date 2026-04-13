import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited, getClientIpFromHeaders } from '@/lib/rate-limit';

const STRUCT_MAX_ATTEMPTS = 50;
const STRUCT_WINDOW_MINUTES = 15;

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
