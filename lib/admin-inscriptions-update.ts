import { NextResponse } from 'next/server';
import { sendStatusChangeEmail } from '@/lib/email';
import { auditLog } from '@/lib/audit-log';

/**
 * Shared PUT logic for admin inscriptions.
 * Extracted from app/api/admin/inscriptions/[id]/route.ts (PUT handler)
 * to be reused by both:
 *   - PUT /api/admin/inscriptions (id in body, URL littérale — anti-SSRF)
 *   - PUT /api/admin/inscriptions/[id] (legacy, conservé)
 *
 * Comportement strictement identique à l'ancien PUT [id]/route.ts.
 *
 * @param supabase  client admin (service_role) — injecté par le caller
 * @param id        inscription id (UUID attendu — non re-validé ici, fait côté route)
 * @param body      payload JSON déjà parsé (fields : status, payment_status, etc.)
 * @param authEmail email de l'admin authentifié (audit log)
 */
export async function performInscriptionUpdate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  id: string,
  body: Record<string, unknown>,
  authEmail: string
): Promise<NextResponse> {
  try {
    const { status, payment_status, documents_status, besoins_pris_en_compte, equipe_informee, note_pro } = body as {
      status?: string;
      payment_status?: string;
      documents_status?: string;
      besoins_pris_en_compte?: unknown;
      equipe_informee?: unknown;
      note_pro?: unknown;
    };

    // Validation des statuts
    const validStatuses = ['en_attente', 'validee', 'refusee', 'annulee'];
    const validPaymentStatuses = ['pending_payment', 'paid', 'failed', 'pending_transfer', 'pending_check', 'amount_mismatch'];
    const validDocStatuses = ['en_attente', 'partiellement_recus', 'complets'];

    const updateData: Record<string, unknown> = {};

    if (status) {
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: { code: 'validation_error', message: `Statut invalide. Valeurs : ${validStatuses.join(', ')}` } },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    if (payment_status) {
      if (!validPaymentStatuses.includes(payment_status)) {
        return NextResponse.json(
          { error: { code: 'validation_error', message: `Statut paiement invalide. Valeurs : ${validPaymentStatuses.join(', ')}` } },
          { status: 400 }
        );
      }
      updateData.payment_status = payment_status;
    }

    // Phase 2 — champs suivi séjour
    if (documents_status !== undefined) {
      if (!validDocStatuses.includes(documents_status)) {
        return NextResponse.json(
          { error: { code: 'validation_error', message: `Statut documents invalide. Valeurs : ${validDocStatuses.join(', ')}` } },
          { status: 400 }
        );
      }
      updateData.documents_status = documents_status;
    }
    if (besoins_pris_en_compte !== undefined) {
      updateData.besoins_pris_en_compte = Boolean(besoins_pris_en_compte);
    }
    if (equipe_informee !== undefined) {
      updateData.equipe_informee = Boolean(equipe_informee);
    }
    if (note_pro !== undefined) {
      updateData.note_pro = typeof note_pro === 'string' ? note_pro : null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Aucun champ à mettre à jour' } },
        { status: 400 }
      );
    }

    // Lire le statut actuel pour l'audit log (uniquement si status change)
    let oldStatus: string | null = null;
    if (status) {
      const { data: current } = await supabase
        .from('gd_inscriptions')
        .select('status')
        .eq('id', id)
        .single();
      oldStatus = current?.status ?? null;
    }

    const { data, error } = await supabase
      .from('gd_inscriptions')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select('id, status, payment_status, documents_status, besoins_pris_en_compte, equipe_informee, note_pro, updated_at, referent_email, referent_nom, jeune_prenom, jeune_nom, dossier_ref, sejour_slug, suivi_token')
      .single();

    if (error) {
      console.error('performInscriptionUpdate Supabase error:', error);
      throw error;
    }

    // RGPD — tracer modification inscription par admin
    await auditLog(supabase, {
      action: 'update',
      resourceType: 'inscription',
      resourceId: id,
      actorType: 'admin',
      actorId: authEmail,
      metadata: { fields: Object.keys(updateData) },
    });

    // Audit log non-bloquant si le statut a changé
    if (status && oldStatus !== status) {
      supabase.from('gd_inscription_status_logs').insert({
        inscription_id: id,
        old_status: oldStatus,
        new_status: status,
        changed_by_email: authEmail,
      }).then(({ error: logError }: { error: unknown }) => {
        if (logError) console.error('Audit log error:', logError);
      });
    }

    // Email non-bloquant si le statut a changé
    if (status && data.referent_email) {
      sendStatusChangeEmail(
        data.referent_email,
        data.referent_nom,
        data.jeune_prenom,
        data.jeune_nom,
        status
      ).catch((err) => { console.error('[admin/inscriptions] sendStatusChangeEmail failed', err); });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('performInscriptionUpdate error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
