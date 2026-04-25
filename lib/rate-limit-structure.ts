import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited, getClientIpFromHeaders } from '@/lib/rate-limit';

// F2 fix (Thanh field test 2026-04-25) — buckets différenciés selon le verbe HTTP.
// Avant : 20 req/15min partagés entre TOUS les /api/structure/[code]/* → un staff
// qui ouvre son dashboard (8-10 GET en parallèle pour incidents+medical+calls+notes
// +team+dossier+factures+propositions) atteignait la limite très vite et voyait
// "Trop de tentatives" sur l'ouverture des modales de complétion de dossier.
//
// Après : auto-routing via req.method.
//   - GET / HEAD            → bucket 'struct-read' (100/15min, navigation normale)
//   - POST/PATCH/PUT/DELETE → bucket 'struct-write' (50/15min, modéré)
//   - invite/reinvite/revoke restent sur structureRateLimitGuardStrict (5/15min)
//
// L'API publique (signature du guard) reste identique → zéro changement dans les
// ~20 routes existantes. Aucune régression brute-force : les writes restent
// limités, les buckets sont séparés (un GET ne consomme pas le quota write).
const STRUCT_READ_MAX_ATTEMPTS = 100;
const STRUCT_READ_WINDOW_MINUTES = 15;
const STRUCT_WRITE_MAX_ATTEMPTS = 50;
const STRUCT_WRITE_WINDOW_MINUTES = 15;

// P2.2 — bucket séparé pour actions à risque d'abus (invite/reinvite/revoke).
// Limite serrée (5/15min) pour éviter le spam d'invitations / révocations massives.
const STRUCT_STRICT_MAX_ATTEMPTS = 5;
const STRUCT_STRICT_WINDOW_MINUTES = 15;

export function getStructureClientIp(req: NextRequest): string {
  return getClientIpFromHeaders(req.headers);
}

/** Conservé pour rétrocompat — utilise le bucket read par défaut (méthode GET implicite). */
export async function isStructureRateLimited(ip: string): Promise<boolean> {
  return isRateLimited('struct-read', ip, STRUCT_READ_MAX_ATTEMPTS, STRUCT_READ_WINDOW_MINUTES);
}

/**
 * Guard réutilisable pour toutes les routes structure.
 * Auto-route selon req.method : reads (GET/HEAD) lax, writes (POST/PATCH/PUT/DELETE) modéré.
 * Retourne une NextResponse 429 si rate limité, ou null si OK.
 */
export async function structureRateLimitGuard(req: NextRequest): Promise<NextResponse | null> {
  const ip = getStructureClientIp(req);
  const method = (req.method ?? 'GET').toUpperCase();
  const isRead = method === 'GET' || method === 'HEAD';
  const bucket = isRead ? 'struct-read' : 'struct-write';
  const maxAttempts = isRead ? STRUCT_READ_MAX_ATTEMPTS : STRUCT_WRITE_MAX_ATTEMPTS;
  const windowMinutes = isRead ? STRUCT_READ_WINDOW_MINUTES : STRUCT_WRITE_WINDOW_MINUTES;

  if (await isRateLimited(bucket, ip, maxAttempts, windowMinutes)) {
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
