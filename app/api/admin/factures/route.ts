export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { auditLog } from '@/lib/audit-log';
import { UUID_RE } from '@/lib/validators';

const VALID_STATUTS = ['brouillon','envoyee','payee_partiel','payee','annulee'] as const;
type FactureStatut = typeof VALID_STATUTS[number];

export async function GET(req: NextRequest) {
  const auth = await requireEditor(req);
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const url = new URL(req.url);
  const page  = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') ?? '50'));
  const from  = (page - 1) * limit;
  const to    = from + limit - 1;

  const { data, count, error } = await supabase
    .from('gd_factures')
    .select('*, gd_facture_lignes(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('[factures GET]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const factures = (data ?? []).map(f => ({
    ...f,
    status: f.statut,
    lignes: (f as Record<string, unknown>).gd_facture_lignes ?? [],
  }));

  return NextResponse.json({ factures, total: count ?? 0, page, limit });
}

export async function POST(req: NextRequest) {
  const auth = await requireEditor(req);
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }); }

  const { structure_nom, structure_adresse, structure_cp, structure_ville, lignes, montant_total } = body;

  if (!structure_nom || typeof structure_nom !== 'string' || !structure_nom.trim()) {
    return NextResponse.json({ error: 'structure_nom est requis' }, { status: 400 });
  }
  if (!Array.isArray(lignes) || lignes.length === 0) {
    return NextResponse.json({ error: 'Au moins une ligne enfant est requise' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: facture, error: factureErr } = await supabase
    .from('gd_factures')
    .insert({
      structure_nom:     String(structure_nom).trim(),
      structure_adresse: String(structure_adresse ?? ''),
      structure_cp:      String(structure_cp ?? ''),
      structure_ville:   String(structure_ville ?? ''),
      montant_total:     Number(montant_total) || 0,
      statut:            'brouillon',
      created_by:        auth.email,
    })
    .select('id, numero')
    .single();

  if (factureErr || !facture) {
    console.error('[factures POST]', factureErr?.message);
    return NextResponse.json({ error: 'Erreur création facture' }, { status: 500 });
  }

  interface LigneInput {
    enfant_prenom: string; enfant_nom: string; sejour_titre: string;
    session_start: string; session_end: string; ville_depart: string;
    prix_sejour: number; prix_transport: number; prix_encadrement: number;
    inscription_id?: string;
  }
  const lignesRows = (lignes as LigneInput[]).map(l => ({
    facture_id:       facture.id,
    enfant_prenom:    String(l.enfant_prenom ?? ''),
    enfant_nom:       String(l.enfant_nom ?? ''),
    sejour_titre:     String(l.sejour_titre ?? ''),
    session_start:    l.session_start || null,
    session_end:      l.session_end || null,
    ville_depart:     String(l.ville_depart ?? ''),
    prix_sejour:      Number(l.prix_sejour) || 0,
    prix_transport:   Number(l.prix_transport) || 0,
    prix_encadrement: Number(l.prix_encadrement) || 0,
    prix_ligne_total: (Number(l.prix_sejour) || 0) + (Number(l.prix_transport) || 0) + (Number(l.prix_encadrement) || 0),
    inscription_id:   l.inscription_id || null,
  }));

  const { error: lignesErr } = await supabase.from('gd_facture_lignes').insert(lignesRows);

  if (lignesErr) {
    console.error('[factures POST lignes]', lignesErr.message);
    await supabase.from('gd_factures').delete().eq('id', facture.id);
    return NextResponse.json({ error: 'Erreur insertion lignes' }, { status: 500 });
  }

  await auditLog(supabase, {
    action: 'create', resourceType: 'inscription',
    resourceId: facture.id, actorType: 'admin', actorId: auth.email,
    metadata: { numero: facture.numero, structure_nom },
  });

  return NextResponse.json({ facture: { ...facture, status: 'brouillon' } }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireEditor(req);
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }); }

  const { id, statut } = body;

  if (!id || typeof id !== 'string' || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  }
  if (!VALID_STATUTS.includes(statut as FactureStatut)) {
    return NextResponse.json({ error: `Statut invalide. Valeurs : ${VALID_STATUTS.join(', ')}` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // SELECT avant pour tracer l'ancien statut dans l'audit (traçabilité RGPD
  // transitions statut facture — règle CLAUDE.md #15).
  const { data: before } = await supabase
    .from('gd_factures')
    .select('id, numero, statut, structure_id')
    .eq('id', id)
    .single();

  if (!before) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });

  const { data, error } = await supabase
    .from('gd_factures')
    .update({ statut })
    .eq('id', id)
    .select('id, numero, statut')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(supabase, {
    action: 'update',
    resourceType: 'facture',
    resourceId: id,
    actorType: 'admin',
    actorId: auth.email,
    metadata: {
      context: 'facture_status_change',
      numero: before.numero,
      status_from: before.statut,
      status_to: statut,
      structure_id: before.structure_id,
    },
  });

  return NextResponse.json({ facture: { ...data, status: data.statut } });
}
