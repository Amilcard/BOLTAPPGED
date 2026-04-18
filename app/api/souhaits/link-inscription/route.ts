export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireEditor } from '@/lib/auth-middleware';
import { auditLog } from '@/lib/audit-log';

/**
 * POST /api/souhaits/link-inscription
 * Lie un souhait validé à l'inscription créée.
 * Protégé par JWT — requireEditor (écriture sur inscriptions, CLAUDE.md règle 8).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireEditor(req);
    if (!auth) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 });
    }

    const { souhaitId, inscriptionId } = await req.json();

    if (!souhaitId || !inscriptionId) {
      return NextResponse.json({ error: 'Champs manquants.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Vérifier que le souhait est bien validé et pas déjà lié
    const { data: souhait } = await supabase
      .from('gd_souhaits')
      .select('id, status, inscription_id')
      .eq('id', souhaitId)
      .single();

    if (!souhait || souhait.status !== 'valide') {
      return NextResponse.json({ error: 'Souhait non valide.' }, { status: 400 });
    }

    if (souhait.inscription_id) {
      return NextResponse.json({ error: 'Souhait déjà lié.' }, { status: 409 });
    }

    const { error } = await supabase
      .from('gd_souhaits')
      .update({ inscription_id: inscriptionId })
      .eq('id', souhaitId)
      .eq('status', 'valide')
      .is('inscription_id', null);

    if (error) {
      console.error('POST /api/souhaits/link-inscription error:', error);
      return NextResponse.json({ error: 'Erreur mise à jour.' }, { status: 500 });
    }

    // RGPD — tracer liaison souhait ↔ inscription (mutation admin/editor)
    await auditLog(supabase, {
      action: 'update',
      resourceType: 'inscription',
      resourceId: souhaitId,
      inscriptionId,
      actorType: 'admin',
      actorId: auth.email,
      metadata: { route: '/api/souhaits/link-inscription', kind: 'souhait_link' },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/souhaits/link-inscription error:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
