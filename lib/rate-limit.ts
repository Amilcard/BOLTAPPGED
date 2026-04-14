import { getSupabaseAdmin } from '@/lib/supabase-server';

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
    const supabase = getSupabaseAdmin();
    const key = `${prefix}:${ip}`;

    // RPC atomique — une seule opération SQL, pas de race condition
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_minutes: windowMin,
    });

    if (error) {
      // Fallback legacy si RPC pas encore déployée
      return await isRateLimitedLegacy(key, limit, windowMin);
    }

    return data === true;
  } catch {
    return true; // fail-closed : bloquer si la DB est indisponible (sécurité ASE)
  }
}

/** Fallback non-atomique — utilisé uniquement si la RPC n'est pas encore déployée */
async function isRateLimitedLegacy(
  key: string,
  limit: number,
  windowMin: number
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
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
}

export function getClientIpFromHeaders(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
