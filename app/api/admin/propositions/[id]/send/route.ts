export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendPropositionEmail } from '@/lib/email';
import { generatePropositionPdf } from '@/lib/pdf-proposition';
import { auditLog, getClientIp } from '@/lib/audit-log';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEditor(req);
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const { id } = await params;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });

  const body = await req.json().catch(() => ({})) as { demandeurEmail?: string };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const overrideEmail = typeof body.demandeurEmail === 'string' && body.demandeurEmail.trim()
    ? body.demandeurEmail.trim()
    : null;
  if (overrideEmail && !emailRegex.test(overrideEmail)) {
    return NextResponse.json({ error: 'Email destinataire invalide.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: prop } = await supabase
    .from('gd_propositions_tarifaires')
    .select('*')
    .eq('id', id)
    .single();

  if (!prop) return NextResponse.json({ error: 'Proposition introuvable' }, { status: 404 });

  if (prop.status === 'envoyee') {
    return NextResponse.json({ error: 'Proposition déjà envoyée.' }, { status: 400 });
  }

  const destEmail = prop.demandeur_email || overrideEmail;
  if (!destEmail) {
    return NextResponse.json(
      { error: "Pas d'email destinataire. Renseignez 'demandeurEmail' dans la requête." },
      { status: 400 }
    );
  }

  const pdfBytes = await generatePropositionPdf(prop as Record<string, unknown>);

  await sendPropositionEmail({
    to:              destEmail,
    destinataireNom: prop.demandeur_nom || destEmail,
    sejourTitre:     prop.sejour_titre || prop.sejour_slug,
    dossierRef:      prop.id.slice(0, 8).toUpperCase(),
    pdfBuffer:       pdfBytes,
  });

  await auditLog(supabase, {
    action: 'submit',
    resourceType: 'inscription',
    resourceId: id,
    actorType: 'admin',
    actorId: auth.email,
    ipAddress: getClientIp(req),
    metadata: { context: 'proposition_send', demandeur_email: destEmail, sejour_titre: prop.sejour_titre },
  });

  const updatePayload: Record<string, unknown> = { status: 'envoyee' };
  if (!prop.demandeur_email && overrideEmail) updatePayload.demandeur_email = overrideEmail;

  const { error: updateErr } = await supabase
    .from('gd_propositions_tarifaires')
    .update(updatePayload)
    .eq('id', id)
    .in('status', ['brouillon', 'demandee']);

  if (updateErr) {
    console.error('[propositions/send] update status failed:', updateErr.message);
    return NextResponse.json({ error: 'Email envoyé mais statut non mis à jour.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
