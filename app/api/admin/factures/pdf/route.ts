export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireEditor } from '@/lib/auth-middleware';
import { generateFacturePdf } from '@/lib/facture-pdf';

/**
 * GET /api/admin/factures/pdf?id=UUID — Génération PDF d'une facture
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireEditor(req);
    if (!auth) {
      return NextResponse.json({ error: 'Accès réservé aux éditeurs et administrateurs.' }, { status: 403 });
    }

    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID manquant' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch facture + lignes + paiements in parallel
    const [factureRes, lignesRes, paiementsRes] = await Promise.all([
      supabase.from('gd_factures').select('*').eq('id', id).single(),
      supabase.from('gd_facture_lignes').select('*').eq('facture_id', id).order('created_at', { ascending: true }),
      supabase.from('gd_facture_paiements').select('*').eq('facture_id', id).order('date_paiement', { ascending: true }),
    ]);

    if (factureRes.error || !factureRes.data) {
      return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });
    }

    const pdfBytes = await generateFacturePdf(
      factureRes.data as Record<string, unknown>,
      (lignesRes.data || []) as Record<string, unknown>[],
      (paiementsRes.data || []) as Record<string, unknown>[]
    );

    const numero = (factureRes.data as Record<string, unknown>).numero || 'draft';
    const filename = `Facture_${numero}.pdf`;

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur generation PDF' },
      { status: 500 }
    );
  }
}
