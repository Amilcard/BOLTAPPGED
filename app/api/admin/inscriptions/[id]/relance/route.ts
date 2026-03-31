export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getSupabase } from '@/lib/supabase-server';
import { sendRappelDossierIncomplet, sendRelanceAdminNotification } from '@/lib/email';
/**
 * POST /api/admin/inscriptions/[id]/relance
 * Envoie un email de rappel dossier incomplet au référent.
 * Guard : refusé si gd_dossier_enfant.ged_sent_at IS NOT NULL (dossier déjà soumis).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    const auth = requireEditor(req);
    if (!auth) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Charger les infos référent depuis gd_inscriptions
    const { data: insc, error: inscErr } = await supabase
      .from('gd_inscriptions')
      .select('id, referent_email, referent_nom, dossier_ref, suivi_token, organisation')
      .eq('id', id)
      .single();

    if (inscErr || !insc) {
      return NextResponse.json(
        { error: 'Inscription non trouvée' },
        { status: 404 }
      );
    }

    if (!insc.referent_email || !insc.suivi_token) {
      return NextResponse.json(
        { error: 'Données insuffisantes pour envoyer le rappel (email ou token manquant).' },
        { status: 422 }
      );
    }

    // Vérifier ged_sent_at depuis gd_dossier_enfant (c'est là qu'il est défini)
    const { data: dossier } = await supabase
      .from('gd_dossier_enfant')
      .select('ged_sent_at')
      .eq('inscription_id', id)
      .maybeSingle();

    if (dossier?.ged_sent_at) {
      return NextResponse.json(
        { error: 'Dossier déjà envoyé, relance inutile.' },
        { status: 409 }
      );
    }

    // Fire-and-forget — on ne bloque pas la réponse sur l'envoi email
    sendRappelDossierIncomplet({
      referentEmail: insc.referent_email,
      referentNom: insc.referent_nom || 'Référent',
      dossierRef: insc.dossier_ref ?? undefined,
      suiviToken: insc.suivi_token,
    }).catch(() => {
      // Erreur loguée dans sendRappelDossierIncomplet, pas de crash ici
    });

    // Notification admin GED — fire-and-forget
    sendRelanceAdminNotification({
      referentNom: insc.referent_nom || 'Référent',
      referentEmail: insc.referent_email,
      structureNom: insc.organisation ?? undefined,
      dossierRef: insc.dossier_ref ?? undefined,
      inscriptionId: id,
    }).catch(() => {
      // Erreur loguée dans sendRelanceAdminNotification, pas de crash ici
    });

    return NextResponse.json({ success: true, relance_at: new Date().toISOString() });
  } catch (error) {
    console.error('POST /api/admin/inscriptions/[id]/relance error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
