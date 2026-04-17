export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireStructureRole } from '@/lib/structure-guard';
import { auditLog } from '@/lib/audit-log';
import { structureRateLimitGuard } from '@/lib/rate-limit-structure';

/**
 * GET /api/structure/[code]/factures
 * Liste les factures de la structure. Educateur et secrétariat exclus.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const rateLimited = await structureRateLimitGuard(_req);
  if (rateLimited) return rateLimited;

  const { code } = await params;
  const guard = await requireStructureRole(_req, code, {
    excludeRoles: ['educateur', 'secretariat'],
  });
  if (!guard.ok) return guard.response;
  const resolved = guard.resolved;

  const supabase = getSupabaseAdmin();
  const structureId = resolved.structure.id as string;

  const { data: factures, error } = await supabase
    .from('gd_factures')
    .select('*')
    .eq('structure_id', structureId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[factures GET] error:', error.message);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }

  // Fetch lignes + paiements
  const ids = (factures || []).map((f: Record<string, unknown>) => f.id as string);

  let lignesMap: Record<string, unknown[]> = {};
  let paiementsMap: Record<string, unknown[]> = {};

  if (ids.length > 0) {
    const [lignesRes, paiementsRes] = await Promise.all([
      supabase.from('gd_facture_lignes').select('*').in('facture_id', ids).order('created_at', { ascending: true }),
      supabase.from('gd_facture_paiements').select('*').in('facture_id', ids).order('date_paiement', { ascending: true }),
    ]);

    if (lignesRes.data) {
      lignesMap = {};
      for (const l of lignesRes.data) {
        const fid = (l as Record<string, unknown>).facture_id as string;
        if (!lignesMap[fid]) lignesMap[fid] = [];
        lignesMap[fid].push(l);
      }
    }

    if (paiementsRes.data) {
      paiementsMap = {};
      for (const p of paiementsRes.data) {
        const fid = (p as Record<string, unknown>).facture_id as string;
        if (!paiementsMap[fid]) paiementsMap[fid] = [];
        paiementsMap[fid].push(p);
      }
    }
  }

  const result = (factures || []).map((f: Record<string, unknown>) => {
    const paiements = paiementsMap[f.id as string] || [];
    const montantPaye = paiements.reduce((sum: number, p: unknown) => sum + Number((p as Record<string, unknown>).montant || 0), 0);
    const montantTotal = Number(f.montant_total || 0);
    return {
      ...f,
      date: f.created_at,
      montant_paye: montantPaye,
      solde: montantTotal - montantPaye,
      lignes: lignesMap[f.id as string] || [],
      paiements,
    };
  });

  await auditLog(supabase, {
    action: 'read',
    resourceType: 'facture',
    resourceId: structureId,
    actorType: 'referent',
    actorId: resolved.email || undefined,
    metadata: { type: 'structure_factures_list', role: resolved.role, count: result.length },
  });

  return NextResponse.json({ factures: result });
}
