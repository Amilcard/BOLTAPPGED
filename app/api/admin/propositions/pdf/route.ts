export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireEditor } from '@/lib/auth-middleware';
import { generatePropositionPdf } from '@/lib/pdf-proposition';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireEditor(req);
    if (!auth) return NextResponse.json({ error: 'Accès réservé aux éditeurs et administrateurs.' }, { status: 403 });

    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 });

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: prop } = await supabase
      .from('gd_propositions_tarifaires')
      .select('*')
      .eq('id', id)
      .single();

    if (!prop) return NextResponse.json({ error: 'Proposition introuvable' }, { status: 404 });

    const p = prop as Record<string, unknown>;
    const pdfBytes = await generatePropositionPdf(p);

    const enfantNom = String(p.enfant_nom ?? '').replace(/[^\w\s-]/g, '') || 'inconnu';
    const enfantPrenom = String(p.enfant_prenom ?? '').replace(/[^\w\s-]/g, '') || 'inconnu';
    const filename = `Proposition_${enfantNom}_${enfantPrenom}.pdf`;

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    console.error('PDF generation error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur generation PDF' }, { status: 500 });
  }
}
