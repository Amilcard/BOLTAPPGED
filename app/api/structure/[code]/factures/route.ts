export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { resolveCodeToStructure } from '@/lib/structure';
import { auditLog } from '@/lib/audit-log';

/**
 * GET /api/structure/[code]/factures
 * Liste les factures de la structure. Educateur et secrétariat exclus.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const resolved = await resolveCodeToStructure(code);
  if (!resolved || resolved.role === 'educateur' || resolved.role === 'secretariat') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  const supabase = getSupabase();
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

  const result = (factures || []).map((f: Record<string, unknown>) => ({
    ...f,
    lignes: lignesMap[f.id as string] || [],
    paiements: paiementsMap[f.id as string] || [],
  }));

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
