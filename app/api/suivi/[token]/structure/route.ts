export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { UUID_RE } from '@/lib/validators';
import { auditLog } from '@/lib/audit-log';

/**
 * PATCH /api/suivi/[token]/structure
 *
 * Rattachement a posteriori d'une inscription à une structure existante.
 * Cas d'usage : un éducateur a inscrit un enfant SANS code structure,
 * puis reçoit le code d'un collègue et veut rattacher son inscription.
 *
 * Body attendu : { inscriptionId: string, structureCode: string }
 *
 * Sécurité :
 *  - Le suivi_token doit correspondre à un dossier existant
 *  - L'inscription ciblée doit appartenir au même référent (même email)
 *  - Le code structure doit correspondre à une structure active
 *
 * Résultat : structure_id mis à jour sur l'inscription, structure_pending_name effacé
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // ── Validation token ──
    if (!token || !UUID_RE.test(token)) {
      return NextResponse.json(
        { error: { code: 'INVALID_TOKEN', message: 'Lien de suivi invalide.' } },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const body = await req.json();
    const { inscriptionId, structureCode } = body;

    // ── Validation body ──
    if (!inscriptionId || !structureCode) {
      return NextResponse.json(
        { error: { code: 'MISSING_PARAMS', message: 'inscriptionId et structureCode requis.' } },
        { status: 400 }
      );
    }

    if (!UUID_RE.test(inscriptionId)) {
      return NextResponse.json(
        { error: { code: 'INVALID_ID', message: 'inscriptionId invalide.' } },
        { status: 400 }
      );
    }

    const codeNormalized = String(structureCode).toUpperCase().trim();
    if (!/^[A-Z0-9]{6}$/.test(codeNormalized)) {
      return NextResponse.json(
        { error: { code: 'INVALID_CODE', message: 'Le code structure doit contenir 6 caractères alphanumériques.' } },
        { status: 400 }
      );
    }

    // ── Vérifier le token → récupérer l'email propriétaire ──
    const { data: tokenOwnerRaw } = await supabase
      .from('gd_inscriptions')
      .select('referent_email')
      .eq('suivi_token', token)
      .single();

    const tokenOwner = tokenOwnerRaw as { referent_email: string } | null;
    if (!tokenOwner) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Token invalide ou expiré.' } },
        { status: 404 }
      );
    }

    // ── Vérifier que l'inscription ciblée appartient au même référent ──
    const { data: inscriptionRaw } = await supabase
      .from('gd_inscriptions')
      .select('referent_email, structure_id')
      .eq('id', inscriptionId)
      .single();

    const inscription = inscriptionRaw as { referent_email: string; structure_id: string | null } | null;

    if (!inscription || inscription.referent_email !== tokenOwner.referent_email) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Accès non autorisé à cette inscription.' } },
        { status: 403 }
      );
    }

    // ── Si déjà rattachée à une structure, refuser (pas de changement) ──
    if (inscription.structure_id) {
      return NextResponse.json(
        { error: { code: 'ALREADY_LINKED', message: 'Cette inscription est déjà rattachée à une structure.' } },
        { status: 409 }
      );
    }

    // ── Vérifier le code structure ──
    const { data: structureRaw, error: structErr } = await supabase
      .from('gd_structures')
      .select('id, name, city, postal_code, type')
      .eq('code', codeNormalized)
      .eq('status', 'active')
      .single();

    if (structErr || !structureRaw) {
      return NextResponse.json(
        { error: { code: 'STRUCTURE_NOT_FOUND', message: 'Code structure invalide ou structure inactive.' } },
        { status: 404 }
      );
    }

    const structure = structureRaw as { id: string; name: string; city: string; postal_code: string; type: string };

    // ── Mettre à jour l'inscription ──
    const { error: updateErr } = await supabase
      .from('gd_inscriptions')
      .update({
        structure_id: structure.id,
        structure_pending_name: null, // Plus besoin, le rattachement est fait
      })
      .eq('id', inscriptionId);

    if (updateErr) {
      console.error('[suivi/structure] update error:', updateErr);
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: 'Erreur lors du rattachement.' } },
        { status: 500 }
      );
    }

    // RGPD Art. 9 — tracer rattachement structure (mutation inscription)
    await auditLog(supabase, {
      action: 'update',
      resourceType: 'inscription',
      resourceId: inscriptionId,
      inscriptionId,
      actorType: 'referent',
      actorId: token,
      metadata: { route: '/api/suivi/[token]/structure', structureId: structure.id },
    });

    return NextResponse.json({
      ok: true,
      structure: {
        id: structure.id,
        name: structure.name,
        city: structure.city,
        postalCode: structure.postal_code,
        type: structure.type,
      },
    });
  } catch (error) {
    console.error('[suivi/structure] error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur.' } },
      { status: 500 }
    );
  }
}
