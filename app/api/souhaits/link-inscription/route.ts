export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

/**
 * POST /api/souhaits/link-inscription
 * Lie un souhait validé à l'inscription créée.
 * Appelé en fire-and-forget par le booking flow.
 */
export async function POST(req: NextRequest) {
  try {
    const { souhaitId, inscriptionId } = await req.json();

    if (!souhaitId || !inscriptionId) {
      return NextResponse.json({ error: 'Champs manquants.' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from('gd_souhaits')
      .update({ inscription_id: inscriptionId })
      .eq('id', souhaitId)
      .eq('status', 'valide');

    if (error) {
      console.error('POST /api/souhaits/link-inscription error:', error);
      return NextResponse.json({ error: 'Erreur mise à jour.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/souhaits/link-inscription error:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
