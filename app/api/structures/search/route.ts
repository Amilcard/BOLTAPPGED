export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

/**
 * GET /api/structures/search?cp=76600
 *
 * Cherche les structures existantes par code postal.
 * Retourne nom + ville + type (PAS le code, pour sécurité).
 * Utilisé dans BookingFlow pour détecter les doublons.
 */
export async function GET(req: NextRequest) {
  const cp = req.nextUrl.searchParams.get('cp');

  if (!cp || !/^\d{5}$/.test(cp)) {
    return NextResponse.json(
      { error: 'Code postal invalide (5 chiffres requis).' },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('gd_structures')
      .select('name, city, type, email')
      .eq('postal_code', cp)
      .eq('status', 'active')
      .order('name');

    if (error) throw error;

    // Ne PAS retourner le code ni l'id — l'éducateur doit le demander à ses collègues
    const structures = (data || []).map((s: any) => ({
      name: s.name,
      city: s.city,
      type: s.type,
      // Email masqué partiellement : m****@croix-rouge.fr
      contactHint: s.email ? maskEmail(s.email) : null,
    }));

    return NextResponse.json({ structures });
  } catch (err) {
    console.error('[structures/search] error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***';
  const masked = local[0] + '****';
  return `${masked}@${domain}`;
}
