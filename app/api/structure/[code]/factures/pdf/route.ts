export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireStructureRole } from '@/lib/structure-guard';
import { generateFacturePdf } from '@/lib/facture-pdf';
import { structureRateLimitGuard } from '@/lib/rate-limit-structure';

/**
 * GET /api/structure/[code]/factures/pdf?id=UUID
 * PDF d'une facture pour la structure. Educateur et secrétariat exclus.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const rateLimited = await structureRateLimitGuard(req);
    if (rateLimited) return rateLimited;

    const { code } = await params;
    const guard = await requireStructureRole(req, code, {
      excludeRoles: ['educateur', 'secretariat'],
    });
    if (!guard.ok) return guard.response;
    const resolved = guard.resolved;

    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID manquant' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const structureId = resolved.structure.id as string;

    // Fetch facture and verify it belongs to this structure
    const { data: facture, error: fetchErr } = await supabase
      .from('gd_factures')
      .select('*')
      .eq('id', id)
      .eq('structure_id', structureId)
      .single();

    if (fetchErr || !facture) {
      return NextResponse.json({ error: 'Facture introuvable pour cette structure.' }, { status: 404 });
    }

    // Fetch lignes + paiements in parallel
    const [lignesRes, paiementsRes] = await Promise.all([
      supabase.from('gd_facture_lignes').select('*').eq('facture_id', id).order('created_at', { ascending: true }),
      supabase.from('gd_facture_paiements').select('*').eq('facture_id', id).order('date_paiement', { ascending: true }),
    ]);

    const pdfBytes = await generateFacturePdf(
      facture as Record<string, unknown>,
      (lignesRes.data || []) as Record<string, unknown>[],
      (paiementsRes.data || []) as Record<string, unknown>[]
    );

    const numero = (facture as Record<string, unknown>).numero || 'draft';
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
