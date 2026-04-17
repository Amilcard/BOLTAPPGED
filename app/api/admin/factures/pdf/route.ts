export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { generateFacturePdf } from '@/lib/pdf-facture';
import { auditLog, getClientIp } from '@/lib/audit-log';

export async function GET(req: NextRequest) {
  const auth = await requireEditor(req);
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const id = req.nextUrl.searchParams.get('id');
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: 'ID manquant ou invalide' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: facture } = await supabase
    .from('gd_factures')
    .select('*, gd_facture_lignes(*)')
    .eq('id', id)
    .single();

  if (!facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });

  await auditLog(supabase, {
    action: 'read',
    resourceType: 'facture',
    resourceId: id,
    actorType: 'admin',
    actorId: auth.email,
    ipAddress: getClientIp(req),
    metadata: { context: 'facture_pdf_download', numero: facture.numero },
  });

  const lignes = ((facture as Record<string, unknown>).gd_facture_lignes ?? []) as Parameters<typeof generateFacturePdf>[0]['lignes'];
  const pdfBytes = await generateFacturePdf({ ...facture, lignes });

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="facture-${facture.numero}.pdf"`,
    },
  });
}
