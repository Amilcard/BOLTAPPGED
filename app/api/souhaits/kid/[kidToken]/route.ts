export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/souhaits/kid/[kidToken]
 * Retourne les souhaits d'un kid identifié par son token anonyme.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ kidToken: string }> }
) {
  try {
    const { kidToken } = await params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(kidToken)) {
      return NextResponse.json({ error: 'Token invalide.' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('gd_souhaits')
      .select('id, sejour_slug, sejour_titre, motivation, statut, commentaire, educateur_prenom, created_at, updated_at')
      .eq('kid_token', kidToken)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('GET /api/souhaits/kid error:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
