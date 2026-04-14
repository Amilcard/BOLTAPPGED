export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { verifyEducateurAggregateToken } from '@/lib/educateur-token';

/**
 * GET /api/educateur/souhaits/[token]
 * Liste tous les souhaits reçus par un éducateur (token JWT agrégé).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const email = await verifyEducateurAggregateToken(token);
    if (!email) {
      return NextResponse.json({ error: 'Lien invalide ou expiré.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('gd_souhaits')
      .select('id, kid_prenom, kid_prenom_referent, sejour_slug, sejour_titre, motivation, status, reponse_educateur, reponse_date, educateur_prenom, choix_mode, created_at')
      .eq('educateur_email', email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('GET /api/educateur/souhaits error:', error);
      return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
    }

    return NextResponse.json({
      email,
      souhaits: data || [],
      count: data?.length || 0,
    });
  } catch (err) {
    console.error('GET /api/educateur/souhaits error:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
