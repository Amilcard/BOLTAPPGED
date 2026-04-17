export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { UUID_RE } from '@/lib/validators';
/**
 * GET /api/souhaits/kid/[kidToken]
 * Retourne les souhaits d'un kid via son kid_session_token (localStorage).
 * Colonnes retournées : id, sejour_slug, sejour_titre, status, reponse_educateur, kid_prenom_referent, created_at, updated_at
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ kidToken: string }> }
) {
  try {
    const { kidToken } = await params;

    if (!UUID_RE.test(kidToken)) {
      return NextResponse.json({ error: 'Token invalide.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('gd_souhaits')
      .select('id, sejour_slug, sejour_titre, status, reponse_educateur, kid_prenom_referent, created_at, updated_at')
      .eq('kid_session_token', kidToken)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('GET /api/souhaits/kid error:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
