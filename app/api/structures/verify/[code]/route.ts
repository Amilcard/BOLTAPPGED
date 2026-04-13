export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { isRateLimited, getClientIpFromHeaders } from '@/lib/rate-limit';

/**
 * GET /api/structures/verify/[code]
 *
 * Vérifie un code structure 6 caractères.
 * Si valide : retourne les infos de la structure (nom, ville, CP, type).
 * Si invalide : retourne { valid: false }.
 *
 * Utilisé dans BookingFlow (onBlur du champ code) et dans /suivi/[token].
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const ip = getClientIpFromHeaders(req.headers);
  if (await isRateLimited('struct-verify', ip, 15, 5)) {
    return NextResponse.json(
      { valid: false, error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
      { status: 429, headers: { 'Retry-After': '300' } }
    );
  }

  const { code } = await params;

  // Validation format : 6 caractères alphanum majuscules
  if (!code || !/^[A-Z0-9]{6}$/.test(code.toUpperCase())) {
    return NextResponse.json({ valid: false, error: 'Format invalide' });
  }

  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('gd_structures')
      .select('id, name, city, postal_code, type, address')
      .eq('code', code.toUpperCase())
      .eq('status', 'active')
      .single();

    if (error || !data) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({
      valid: true,
      name: data.name,
      city: data.city,
      postalCode: data.postal_code,
      type: data.type,
      address: data.address,
    });
  } catch (err) {
    console.error('[structures/verify] error:', err);
    return NextResponse.json({ valid: false, error: 'Erreur serveur' });
  }
}
