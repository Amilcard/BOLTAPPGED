export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { runRelanceInscription } from '@/lib/admin-inscriptions-relance';

/**
 * POST /api/admin/inscriptions/[id]/relance
 * Envoie un email de rappel dossier incomplet au référent.
 * Guard : refusé si gd_dossier_enfant.ged_sent_at IS NOT NULL (dossier déjà soumis).
 *
 * Route legacy conservée — délègue au helper partagé runRelanceInscription.
 * Nouvelle route body-based : POST /api/admin/inscriptions/relance.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const auth = await requireEditor(req);
    if (!auth) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const result = await runRelanceInscription(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, relance_at: result.relance_at });
  } catch (error) {
    console.error('POST /api/admin/inscriptions/[id]/relance error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
