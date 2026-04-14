export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited, getClientIpFromHeaders } from '@/lib/rate-limit';
import { resolveCodeToStructure } from '@/lib/structure';

/**
 * GET /api/structures/verify/[code]
 *
 * Vérifie un code structure (6 ou 10 caractères).
 * Si valide : retourne les infos de la structure (nom, ville, CP, type).
 * Si invalide : retourne { valid: false }.
 *
 * Utilisé dans BookingFlow (onBlur du champ code) et dans /suivi/[token].
 * Passe par resolveCodeToStructure pour honorer la migration gd_structure_access_codes.
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

  // Validation format : 6 ou 10 caractères alphanum
  if (!code || !/^[A-Z0-9]{6,10}$/.test(code.toUpperCase())) {
    return NextResponse.json({ valid: false, error: 'Format invalide' });
  }

  try {
    const resolved = await resolveCodeToStructure(code);

    if (!resolved) {
      return NextResponse.json({ valid: false });
    }

    const s = resolved.structure;
    return NextResponse.json({
      valid: true,
      name: s.name,
      city: s.city,
      postalCode: s.postal_code,
      type: s.type,
      address: s.address ?? null,
    });
  } catch (err) {
    console.error('[structures/verify] error:', err);
    return NextResponse.json({ valid: false, error: 'Erreur serveur' });
  }
}
