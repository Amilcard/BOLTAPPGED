import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

const STRUCT_MAX_ATTEMPTS = 10;
const STRUCT_WINDOW_MINUTES = 15;

export function getStructureClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function isStructureRateLimited(ip: string): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const now = new Date();
    const windowStart = new Date(now.getTime() - STRUCT_WINDOW_MINUTES * 60 * 1000);

    const { data: entry } = await supabase
      .from('gd_login_attempts')
      .select('attempt_count, window_start')
      .eq('ip', `struct:${ip}`)
      .single();

    if (!entry || new Date(entry.window_start) < windowStart) {
      await supabase
        .from('gd_login_attempts')
        .upsert(
          { ip: `struct:${ip}`, attempt_count: 1, window_start: now.toISOString() },
          { onConflict: 'ip' }
        );
      return false;
    }

    if (entry.attempt_count >= STRUCT_MAX_ATTEMPTS) {
      return true;
    }

    await supabase
      .from('gd_login_attempts')
      .update({ attempt_count: entry.attempt_count + 1 })
      .eq('ip', `struct:${ip}`);

    return false;
  } catch {
    // fail-closed : données enfants ASE — bloquer en cas d'erreur
    return true;
  }
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
