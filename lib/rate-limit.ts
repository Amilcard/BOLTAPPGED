import { createHmac } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-server';

/**
 * Hash HMAC-SHA256 d'une clé rate-limit avant stockage.
 * RGPD Art. 5.1.c (minimisation) : certaines routes utilisent un email comme
 * discriminant (login-email, struct-login-email, priceiq) — ne jamais le persister
 * en clair dans gd_login_attempts.
 *
 * Préfixe 'h:' = permet de distinguer les entrées hashées (nouvelles) des legacy.
 * Si RATE_LIMIT_HMAC_SECRET absent (dev / tests), fallback sur clé brute avec warning.
 */
function hashRateLimitKey(raw: string): string {
  const secret = process.env.RATE_LIMIT_HMAC_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[rate-limit] RATE_LIMIT_HMAC_SECRET manquant en prod — clés non-hashées');
    }
    return raw;
  }
  return 'h:' + createHmac('sha256', secret).update(raw).digest('hex').slice(0, 32);
}

/**
 * Rate limiter DB-backed via gd_login_attempts.
 * Persiste entre cold starts — complément du rate limiter in-memory du middleware.
 *
 * @param prefix   Préfixe de clé (ex: 'insc', 'wish') — permet le namespacing par route
 * @param ip       IP client (ou clé composée email+ip pour routes auth)
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
    const key = hashRateLimitKey(`${prefix}:${ip}`);

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
