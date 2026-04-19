export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireStructureRole } from '@/lib/structure-guard';
import { requireInscriptionInStructure } from '@/lib/resource-guard';
import { auditLog, getClientIp } from '@/lib/audit-log';
import { structureRateLimitGuard } from '@/lib/rate-limit-structure';
import { EDITABLE_BLOCS, getCompletedColumn, type EditableBloc } from '@/lib/dossier-shared';
import { validateBase64Image, UUID_RE } from '@/lib/validators';

/**
 * GET /api/structure/[code]/inscriptions/[id]/dossier
 *
 * Lecture du dossier enfant par le staff structure (pour alimenter l'UI
 * "Remplir dossier en dépannage"). Miroir en lecture de la route PATCH
 * ci-dessous.
 *
 * Auth + ownership identiques au PATCH. auditLog obligatoire car lecture
 * Art.9 (données dossier enfant).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> },
) {
  try {
    const rateLimited = await structureRateLimitGuard(req);
    if (rateLimited) return rateLimited;

    const { code, id: inscriptionId } = await params;

    if (!UUID_RE.test(inscriptionId)) {
      return NextResponse.json(
        { error: { code: 'INVALID_ID', message: "ID inscription invalide." } },
        { status: 400 },
      );
    }

    const guard = await requireStructureRole(req, code, {
      allowRoles: ['secretariat', 'direction', 'cds', 'cds_delegated'],
      forbiddenMessage: 'Accès réservé au staff structure.',
    });
    if (!guard.ok) return guard.response;
    const resolved = guard.resolved;

    const supabase = getSupabaseAdmin();
    const structureId = resolved.structure.id as string;

    const ownership = await requireInscriptionInStructure({
      supabase,
      inscriptionId,
      structureId,
    });
    if (!ownership.ok) return ownership.response;

    const { data: dossier } = await supabase
      .from('gd_dossier_enfant')
      .select('*')
      .eq('inscription_id', inscriptionId)
      .maybeSingle();

    await auditLog(supabase, {
      action: 'read',
      resourceType: 'dossier_enfant',
      resourceId: inscriptionId,
      inscriptionId,
      actorType: 'referent',
      actorId: resolved.email || undefined,
      ipAddress: getClientIp(req),
      metadata: { context: 'staff_view_dossier', actor_role: resolved.role },
    });

    // Renvoyer forme compatible avec la route référent (exists: bool + blocs).
    if (!dossier) {
      return NextResponse.json({
        exists: false,
        inscription_id: inscriptionId,
        bulletin_complement: {},
        fiche_sanitaire: {},
        fiche_liaison_jeune: {},
        fiche_renseignements: null,
        documents_joints: [],
        bulletin_completed: false,
        sanitaire_completed: false,
        liaison_completed: false,
        renseignements_completed: false,
        renseignements_required: false,
      });
    }

    return NextResponse.json({ exists: true, ...dossier });
  } catch (err) {
    console.error('GET /api/structure/[code]/inscriptions/[id]/dossier error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/structure/[code]/inscriptions/[id]/dossier
 *
 * Permet au staff structure (secrétariat, direction, CDS, CDS délégué) de
 * remplir / compléter le dossier inscription d'un enfant en cas d'absence
 * de l'éducateur référent. Use case métier : dépannage urgence.
 *
 * Scope RGPD Art. 9 — données mineurs ASE. Chaque mutation tracée dans
 * `gd_audit_log` avec rôle + email de l'acteur (CLAUDE.md règle #15).
 *
 * Body : { bloc, data, completed? }
 *   - bloc : 'bulletin_complement' | 'fiche_sanitaire' | 'fiche_liaison_jeune' | 'fiche_renseignements'
 *   - data : payload JSONB à merger dans le bloc existant
 *   - completed : optional boolean → propage vers la colonne *_completed
 *
 * Auth : `requireStructureRole` (secretariat/direction/cds/cds_delegated).
 *        Éducateur EXCLU — utilise sa propre route `/api/dossier-enfant/[inscriptionId]` via suivi_token.
 *
 * Ownership : `requireInscriptionInStructure` — scope structure_id uniquement.
 *             Le staff voit toutes les inscriptions de sa structure, pas
 *             juste ses propres referent_email.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> },
) {
  try {
    const rateLimited = await structureRateLimitGuard(req);
    if (rateLimited) return rateLimited;

    const { code, id: inscriptionId } = await params;

    if (!UUID_RE.test(inscriptionId)) {
      return NextResponse.json(
        { error: { code: 'INVALID_ID', message: "ID inscription invalide." } },
        { status: 400 },
      );
    }

    const guard = await requireStructureRole(req, code, {
      allowRoles: ['secretariat', 'direction', 'cds', 'cds_delegated'],
      forbiddenMessage:
        "Accès réservé au staff structure (secrétariat, direction, CDS). L'éducateur utilise le lien de suivi personnel.",
    });
    if (!guard.ok) return guard.response;
    const resolved = guard.resolved;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Corps de requête invalide.' } },
        { status: 400 },
      );
    }

    const { bloc, data, completed } = body as {
      bloc?: unknown;
      data?: unknown;
      completed?: unknown;
    };

    if (!bloc || typeof bloc !== 'string') {
      return NextResponse.json(
        { error: { code: 'MISSING_BLOC', message: 'Bloc requis.' } },
        { status: 400 },
      );
    }

    if (!EDITABLE_BLOCS.includes(bloc as EditableBloc)) {
      return NextResponse.json(
        { error: { code: 'INVALID_BLOC', message: 'Bloc non autorisé.' } },
        { status: 403 },
      );
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return NextResponse.json(
        { error: { code: 'INVALID_DATA', message: 'Les données doivent être un objet.' } },
        { status: 400 },
      );
    }

    // Size cap signature_image_url — DoS + embedPng côté PDF.
    // Cap identique à la route référent (`/api/dossier-enfant/[inscriptionId]`).
    const rawSig = (data as Record<string, unknown>).signature_image_url;
    if (rawSig !== undefined && rawSig !== null && rawSig !== '') {
      const sigCheck = validateBase64Image(rawSig, { max: 500_000 });
      if (!sigCheck.ok) {
        const msg =
          sigCheck.reason === 'too_large'
            ? 'Signature trop volumineuse (max 500 KB).'
            : sigCheck.reason === 'mime'
              ? 'Format signature non autorisé (PNG uniquement).'
              : 'Signature invalide.';
        return NextResponse.json(
          { error: { code: 'INVALID_SIGNATURE', message: msg } },
          { status: 413 },
        );
      }
    }

    const supabase = getSupabaseAdmin();
    const structureId = resolved.structure.id as string;

    // Ownership : inscription appartient bien à la structure.
    // Contrairement aux routes medical/incidents/calls/notes, pas de scope
    // referent_email — tout le staff voit toute la structure.
    const ownership = await requireInscriptionInStructure({
      supabase,
      inscriptionId,
      structureId,
    });
    if (!ownership.ok) return ownership.response;

    // Audit log RGPD Art. 9 — données mineurs ASE.
    await auditLog(supabase, {
      action: 'update',
      resourceType: 'dossier_enfant',
      resourceId: inscriptionId,
      inscriptionId,
      actorType: 'referent',
      actorId: resolved.email || undefined,
      ipAddress: getClientIp(req),
      metadata: {
        bloc,
        completed,
        context: 'staff_fill_dossier',
        actor_role: resolved.role,
      },
    });

    // Merge logic identique à la route référent.
    const { data: existing } = await supabase
      .from('gd_dossier_enfant')
      .select('id, ' + bloc)
      .eq('inscription_id', inscriptionId)
      .maybeSingle();

    const completedCol = getCompletedColumn(bloc);

    if (!existing) {
      const insertData: Record<string, unknown> = {
        inscription_id: inscriptionId,
        [bloc]: data,
      };
      if (typeof completed === 'boolean' && completedCol) {
        insertData[completedCol] = completed;
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('gd_dossier_enfant')
        .insert(insertData)
        .select()
        .single();

      if (insertErr) {
        console.error('[structure/dossier INSERT]', insertErr.message);
        return NextResponse.json(
          { error: { code: 'INSERT_ERROR', message: 'Erreur création dossier.' } },
          { status: 500 },
        );
      }

      return NextResponse.json({ ok: true, dossier: inserted });
    }

    const existingBloc =
      ((existing as unknown as Record<string, unknown>)[bloc] as Record<string, unknown>) || {};
    const merged = { ...existingBloc, ...(data as Record<string, unknown>) };

    const updateData: Record<string, unknown> = { [bloc]: merged };
    if (typeof completed === 'boolean' && completedCol) {
      updateData[completedCol] = completed;
    }

    const { data: updated, error: updateErr } = await supabase
      .from('gd_dossier_enfant')
      .update(updateData)
      .eq('inscription_id', inscriptionId)
      .select()
      .single();

    if (updateErr) {
      console.error('[structure/dossier UPDATE]', updateErr.message);
      return NextResponse.json(
        { error: { code: 'UPDATE_ERROR', message: 'Erreur mise à jour dossier.' } },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, dossier: updated });
  } catch (err) {
    console.error('PATCH /api/structure/[code]/inscriptions/[id]/dossier error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 },
    );
  }
}
