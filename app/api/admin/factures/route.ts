export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { requireEditor } from '@/lib/auth-middleware';
import { auditLog } from '@/lib/audit-log';

/** Valid status transitions */
const TRANSITIONS: Record<string, string[]> = {
  brouillon: ['envoyee'],
  envoyee: ['payee_partiel', 'payee', 'annulee'],
  payee_partiel: ['payee', 'annulee'],
};

/**
 * GET /api/admin/factures — Liste toutes les factures avec lignes et paiements
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireEditor(request);
    if (!auth) {
      return NextResponse.json({ error: 'Accès réservé aux éditeurs et administrateurs.' }, { status: 403 });
    }

    const supabase = getSupabase();

    const { data: factures, error } = await supabase
      .from('gd_factures')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error (GET factures):', error);
      throw error;
    }

    // Fetch lignes and paiements for all factures
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

    return NextResponse.json({ factures: result });
  } catch (err: unknown) {
    console.error('Error in GET /api/admin/factures:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/factures — Créer une nouvelle facture avec lignes
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireEditor(req);
    if (!auth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const supabase = getSupabase();
    const body = await req.json();

    const {
      structure_id, structure_nom, structure_adresse, structure_cp, structure_ville,
      lignes,
    } = body;

    // Validation
    if (!structure_nom || typeof structure_nom !== 'string') {
      return NextResponse.json({ error: 'structure_nom requis.' }, { status: 400 });
    }

    if (!Array.isArray(lignes) || lignes.length === 0) {
      return NextResponse.json({ error: 'Au moins une ligne de facturation requise.' }, { status: 400 });
    }

    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i];
      if (!l.enfant_nom || !l.enfant_prenom || !l.sejour_titre || l.prix_ligne_total == null) {
        return NextResponse.json(
          { error: `Ligne ${i + 1} : enfant_nom, enfant_prenom, sejour_titre et prix_ligne_total requis.` },
          { status: 400 }
        );
      }
    }

    // Insert facture (numero handled by DB default)
    const { data: facture, error: factureErr } = await supabase
      .from('gd_factures')
      .insert({
        structure_id: structure_id || null,
        structure_nom,
        structure_adresse: structure_adresse || '',
        structure_cp: structure_cp || '',
        structure_ville: structure_ville || '',
        statut: 'brouillon',
        montant_total: 0,
        created_by: auth.email,
      })
      .select()
      .single();

    if (factureErr) throw factureErr;

    // Bulk insert lignes
    const lignesInsert = lignes.map((l: Record<string, unknown>) => ({
      facture_id: facture.id,
      enfant_nom: l.enfant_nom,
      enfant_prenom: l.enfant_prenom,
      sejour_titre: l.sejour_titre,
      session_start: l.session_start || null,
      session_end: l.session_end || null,
      ville_depart: l.ville_depart || null,
      prix_sejour: Number(l.prix_sejour) || 0,
      prix_transport: Number(l.prix_transport) || 0,
      prix_encadrement: Number(l.prix_encadrement) || 0,
      prix_ligne_total: Number(l.prix_ligne_total),
    }));

    const { error: lignesErr } = await supabase
      .from('gd_facture_lignes')
      .insert(lignesInsert);

    if (lignesErr) throw lignesErr;

    // Compute montant_total
    const montantTotal = lignesInsert.reduce((sum: number, l: { prix_ligne_total: number }) => sum + l.prix_ligne_total, 0);

    const { data: updated, error: updateErr } = await supabase
      .from('gd_factures')
      .update({ montant_total: montantTotal })
      .eq('id', facture.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await auditLog(supabase, {
      action: 'create',
      resourceType: 'facture',
      resourceId: facture.id,
      actorType: 'admin',
      actorId: auth.email,
      metadata: { structure_nom, nb_lignes: lignes.length, montant_total: montantTotal },
    });

    return NextResponse.json({ facture: updated }, { status: 201 });
  } catch (err: unknown) {
    console.error('Error creating facture:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/factures — Mettre à jour le statut d'une facture
 * Body: { id, statut }
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireEditor(req);
    if (!auth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const supabase = getSupabase();
    const body = await req.json();
    const { id, statut } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID manquant.' }, { status: 400 });
    }
    if (!statut || typeof statut !== 'string') {
      return NextResponse.json({ error: 'statut requis.' }, { status: 400 });
    }

    // Fetch current facture
    const { data: current, error: fetchErr } = await supabase
      .from('gd_factures')
      .select('id, statut')
      .eq('id', id)
      .single();

    if (fetchErr || !current) {
      return NextResponse.json({ error: 'Facture introuvable.' }, { status: 404 });
    }

    // Validate transition
    const allowed = TRANSITIONS[current.statut as string];
    if (!allowed || !allowed.includes(statut)) {
      return NextResponse.json(
        { error: `Transition ${current.statut} → ${statut} non autorisée.` },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { statut };
    if (statut === 'envoyee') updates.date_envoi = new Date().toISOString();

    const { data, error } = await supabase
      .from('gd_factures')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await auditLog(supabase, {
      action: 'update',
      resourceType: 'facture',
      resourceId: id,
      actorType: 'admin',
      actorId: auth.email,
      metadata: { old_statut: current.statut, new_statut: statut },
    });

    return NextResponse.json({ facture: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/factures — Supprimer une facture (brouillon uniquement)
 * Body: { id }
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireEditor(req);
    if (!auth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const supabase = getSupabase();
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'ID manquant.' }, { status: 400 });
    }

    // Check statut = brouillon
    const { data: current } = await supabase
      .from('gd_factures')
      .select('id, statut')
      .eq('id', id)
      .single();

    if (!current) {
      return NextResponse.json({ error: 'Facture introuvable.' }, { status: 404 });
    }

    if (current.statut !== 'brouillon') {
      return NextResponse.json(
        { error: 'Seules les factures en brouillon peuvent être supprimées.' },
        { status: 400 }
      );
    }

    // Delete lignes + paiements first (FK), then facture
    const { error: errLignes } = await supabase.from('gd_facture_lignes').delete().eq('facture_id', id);
    const { error: errPaiements } = await supabase.from('gd_facture_paiements').delete().eq('facture_id', id);
    if (errLignes || errPaiements) {
      console.error('[factures DELETE] FK cleanup error:', errLignes?.message, errPaiements?.message);
      return NextResponse.json({ error: 'Erreur suppression des lignes/paiements liés.' }, { status: 500 });
    }

    const { error } = await supabase
      .from('gd_factures')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await auditLog(supabase, {
      action: 'delete',
      resourceType: 'facture',
      resourceId: id,
      actorType: 'admin',
      actorId: auth.email,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
