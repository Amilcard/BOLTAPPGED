export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendPropositionEmail } from '@/lib/email';
import { generatePropositionPdf } from '@/lib/pdf-proposition';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEditor(req);
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const { id } = await params;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: prop } = await supabase
    .from('gd_propositions_tarifaires')
    .select('*')
    .eq('id', id)
    .single();

  if (!prop) return NextResponse.json({ error: 'Proposition introuvable' }, { status: 404 });

  if (!prop.demandeur_email) {
    return NextResponse.json(
      { error: "Pas d'email destinataire — proposition créée manuellement sans demandeur." },
      { status: 400 }
    );
  }

  const pdfBytes = await generatePropositionPdf(prop as Record<string, unknown>);

  await sendPropositionEmail({
    to:              prop.demandeur_email,
    destinataireNom: prop.demandeur_nom || prop.demandeur_email,
    sejourTitre:     prop.sejour_titre || prop.sejour_slug,
    dossierRef:      prop.id.slice(0, 8).toUpperCase(),
    pdfBuffer:       pdfBytes,
  });

  await supabase
    .from('gd_propositions_tarifaires')
    .update({ status: 'envoyee' })
    .eq('id', id)
    .in('status', ['brouillon', 'demandee']);

  return NextResponse.json({ ok: true });
}
