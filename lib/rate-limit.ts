import { getSupabase } from '@/lib/supabase-server';

/**
 * Rate limiter DB-backed via gd_login_attempts.
 * Persiste entre cold starts — complément du rate limiter in-memory du middleware.
 *
 * @param prefix   Préfixe de clé (ex: 'insc', 'wish') — permet le namespacing par route
 * @param ip       IP client
 * @param limit    Nombre max de requêtes dans la fenêtre
 * @param windowMin Durée de la fenêtre en minutes
 * @returns true si rate limited (bloquer), false sinon
 */
export async function isRateLimited(
  prefix: string,
  ip: string,
  limit: number,
  windowMin: number
): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const key = `${prefix}:${ip}`;
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMin * 60 * 1000);

    const { data: entry } = await supabase
      .from('gd_login_attempts')
      .select('attempt_count, window_start')
      .eq('ip', key)
      .single();

    if (!entry || new Date(entry.window_start) < windowStart) {
      await supabase
        .from('gd_login_attempts')
        .upsert({ ip: key, attempt_count: 1, window_start: now.toISOString() }, { onConflict: 'ip' });
      return false;
    }

    if (entry.attempt_count >= limit) return true;

    await supabase
      .from('gd_login_attempts')
      .update({ attempt_count: entry.attempt_count + 1 })
      .eq('ip', key);
    return false;
  } catch {
    return true; // fail-closed : bloquer si la DB est indisponible (sécurité ASE)
  }
}

export function getClientIpFromHeaders(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
