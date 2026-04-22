export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { errorResponse, unauthorizedResponse } from '@/lib/auth-middleware';
import { auditLog } from '@/lib/audit-log';
import { captureServerException, captureServerMessage } from '@/lib/sentry-capture';

/**
 * GET /api/cron/rgpd-purge
 * Cron mensuel : purge des données RGPD expirées.
 * - Audit logs > 12 mois
 * - Données médicales > 3 mois après fin de séjour
 * - Notes enfants > 12 mois (décision 2026-04-15)
 * - Appels significatifs > 24 mois (décision 2026-04-15)
 * Protégé par CRON_SECRET (Vercel Cron).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[rgpd-purge] CRON_SECRET non configuré — accès refusé');
    return errorResponse('CONFIG_ERROR', 'CRON_SECRET manquant.', 500);
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return unauthorizedResponse();
  }

  const supabase = getSupabaseAdmin();
  const errors: string[] = [];

  const { data: auditResult, error: errAudit } = await supabase.rpc('gd_purge_expired_audit_logs');
  if (errAudit) errors.push(`audit_logs_12m: ${errAudit.message}`);

  const { data: medicalResult, error: errMedical } = await supabase.rpc('gd_purge_expired_medical_data');
  if (errMedical) errors.push(`medical_data: ${errMedical.message}`);

  // Purge login attempts > 24h (IPs rate limiting — RGPD minimisation)
  const { data: loginResult, error: errLogin } = await supabase.rpc('purge_old_login_attempts');
  if (errLogin) errors.push(`login_attempts: ${errLogin.message}`);

  // Purge gd_medical_events > 3 mois post-séjour (Art. 9 RGPD)
  // Critère : session_date de l'inscription + 21j (durée max séjour) + 90j rétention
  // Fallback : created_at + 111j pour les events orphelins (sans inscription liée)
  const purgeThreshold = new Date(Date.now() - (90 + 21) * 24 * 60 * 60 * 1000).toISOString();

  // Chemin 1 — events liés à une inscription avec session_date expirée (via RPC — PostgREST ne supporte pas .lt() sur colonnes jointes)
  const { data: linkedEvents, error: errFetchLinked } = await supabase
    .rpc('gd_get_expired_linked_medical_events', { threshold: purgeThreshold });

  // Chemin 2 — events orphelins (inscription_id null)
  const { data: orphanEvents, error: errFetchOrphan } = await supabase
    .from('gd_medical_events')
    .select('id')
    .is('inscription_id', null)
    .lt('created_at', purgeThreshold);

  // Chemin 3 — events liés à une inscription SANS session_date (via RPC — PostgREST ne supporte pas .is() sur colonnes jointes)
  const { data: noDateEvents, error: errFetchNoDate } = await supabase
    .rpc('gd_get_medical_events_null_session_date', { threshold: purgeThreshold });

  if (errFetchLinked) errors.push(`medical_events_fetch_linked: ${errFetchLinked.message}`);
  if (errFetchOrphan) errors.push(`medical_events_fetch_orphan: ${errFetchOrphan.message}`);
  if (errFetchNoDate) errors.push(`medical_events_fetch_no_date: ${errFetchNoDate.message}`);

  const linkedIds = (linkedEvents ?? []).map((e: { id: string }) => e.id);
  const orphanIds = (orphanEvents ?? []).map((e: { id: string }) => e.id);
  const noDateIds = (noDateEvents ?? []).map((e: { id: string }) => e.id);
  const idsToDelete = [...new Set([...linkedIds, ...orphanIds, ...noDateIds])];

  if (idsToDelete.length > 0) {
    for (let i = 0; i < idsToDelete.length; i += 100) {
      const batch = idsToDelete.slice(i, i + 100);
      const { error: errDel } = await supabase
        .from('gd_medical_events')
        .delete()
        .in('id', batch);
      if (errDel) errors.push(`medical_events_delete_batch_${i}: ${errDel.message}`);
    }
  }
  const medEventsDeleted = idsToDelete.length;

  // Purge tokens JWT révoqués déjà expirés (ne servent plus, RGPD minimisation)
  const { error: errRevoked } = await supabase
    .from('gd_revoked_tokens')
    .delete()
    .lt('expires_at', new Date().toISOString());
  if (errRevoked) errors.push(`revoked_tokens: ${errRevoked.message}`);

  // Purge audit logs > 3 ans (recommandation CNIL)
  const { data: auditOldResult, error: errAuditOld } = await supabase.rpc('purge_old_audit_logs');
  if (errAuditOld) errors.push(`audit_logs_3y: ${errAuditOld.message}`);

  // Purge gd_notes > 12 mois (migration 069 — décision rétention 2026-04-15)
  const { data: notesResult, error: errNotes } = await supabase.rpc('gd_purge_expired_notes');
  if (errNotes) errors.push(`notes_12m: ${errNotes.message}`);

  // Purge gd_calls > 24 mois (migration 069 — décision rétention 2026-04-15)
  const { data: callsResult, error: errCalls } = await supabase.rpc('gd_purge_expired_calls');
  if (errCalls) errors.push(`calls_24m: ${errCalls.message}`);

  // O2 — Purge dossiers enfants abandonnés (migration 076, policy 2026-04-21)
  //   refusee > 90j, en_attente > 180j (hors paiement en cours), inactif > 180j, soft-deleted > 90j
  //   Row gd_inscriptions préservée (historique Stripe). Row gd_dossier_enfant + PJ storage purgées.
  //   Dry-run : CRON_DRY_RUN=true → retourne candidats sans delete.
  const dryRun = process.env.CRON_DRY_RUN === 'true';
  let dossiersPurgedCount = 0;
  let filesPurgedCount = 0;
  const dossierCandidates: Array<{ dossier_id: string; inscription_id: string; purge_policy: string }> = [];

  // LIMIT 200 par run : cron mensuel (0 3 1 * *), ~200 dossiers × 5 PJ × 200ms = ~200s < 300s Vercel timeout.
  const { data: candidates, error: errCandidates } = await supabase
    .rpc('gd_get_dossiers_purge_candidates', { p_limit: 200 });

  if (errCandidates) {
    errors.push(`dossiers_candidates: ${errCandidates.message}`);
  } else if (Array.isArray(candidates) && candidates.length > 0) {
    for (const c of candidates as Array<{
      dossier_id: string;
      inscription_id: string;
      purge_policy: string;
      documents_joints: unknown;
    }>) {
      if (!c.purge_policy) continue;

      const docs = Array.isArray(c.documents_joints) ? c.documents_joints : [];
      const storagePaths = docs
        .map((d) => (d && typeof d === 'object' && 'storage_path' in d
          ? (d as { storage_path?: unknown }).storage_path : null))
        .filter((p): p is string => typeof p === 'string' && p.length > 0);

      if (dryRun) {
        dossierCandidates.push({
          dossier_id: c.dossier_id,
          inscription_id: c.inscription_id,
          purge_policy: c.purge_policy,
        });
        continue;
      }

      try {
        // 1. Supprimer PJ storage AVANT la row (idempotent : remove sur path absent = no-op)
        if (storagePaths.length > 0) {
          const { error: errStorage } = await supabase.storage
            .from('dossier-documents')
            .remove(storagePaths);
          if (errStorage) {
            errors.push(`dossier_storage_${c.inscription_id}: ${errStorage.message}`);
            continue;
          }
          filesPurgedCount += storagePaths.length;
        }

        // 2. Supprimer row gd_dossier_enfant (PII Art.9 purgée, row gd_inscriptions préservée)
        const { error: errDel } = await supabase
          .from('gd_dossier_enfant')
          .delete()
          .eq('id', c.dossier_id);
        if (errDel) {
          errors.push(`dossier_delete_${c.inscription_id}: ${errDel.message}`);
          continue;
        }

        // 3. auditLog obligatoire (resourceId = inscription_id non-PII, dossier_id en metadata)
        await auditLog(supabase, {
          action: 'delete',
          resourceType: 'dossier_enfant',
          resourceId: c.inscription_id,
          inscriptionId: c.inscription_id,
          actorType: 'system',
          metadata: {
            reason: 'rgpd_purge',
            purge_policy: c.purge_policy,
            dossier_id: c.dossier_id,
            files_purged_count: storagePaths.length,
          },
        });

        dossiersPurgedCount += 1;
      } catch (e) {
        errors.push(`dossier_purge_${c.inscription_id}: ${e instanceof Error ? e.message : 'unknown'}`);
        captureServerException(
          e,
          { domain: 'rgpd', operation: 'rgpd_dossier_purge' },
          {
            inscription_id: c.inscription_id,
            dossier_id: c.dossier_id,
            purge_policy: c.purge_policy,
          },
        );
      }
    }
  }

  // Trace d'exécution CNIL — preuve de passage mensuel
  try {
    await auditLog(supabase, {
      action: 'delete',
      resourceType: 'structure', // fallback — pas de 'cron' dans enum
      resourceId: 'rgpd-purge',
      actorType: 'system',
      metadata: {
        type: 'rgpd_purge_executed',
        audit_logs_12m: auditResult ?? 0,
        medical_data: medicalResult ?? 0,
        medical_events_3m: medEventsDeleted ?? 0,
        notes_12m: notesResult ?? 0,
        calls_24m: callsResult ?? 0,
        dossiers_purged: dossiersPurgedCount,
        dossier_files_purged: filesPurgedCount,
        errors_count: errors?.length ?? 0,
        executed_at: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('[rgpd-purge] audit log insert failed (non-blocking):', e);
    captureServerException(
      e,
      { domain: 'rgpd', operation: 'rgpd_audit_trace_cnil' },
      {
        errors_count: errors.length,
        dossiers_purged: dossiersPurgedCount,
        dry_run: dryRun,
      },
      'fatal',
    );
  }

  if (errors.length > 0) {
    console.error(`[rgpd-purge] ${errors.length} erreur(s):`, errors.join('; '));
    captureServerMessage(
      'RGPD monthly purge completed with errors',
      { domain: 'rgpd', operation: 'rgpd_purge_monthly' },
      'error',
      {
        errors_count: errors.length,
        errors_joined: errors.join('; ').slice(0, 1500),
        dossiers_purged: dossiersPurgedCount,
        files_purged: filesPurgedCount,
        dry_run: dryRun,
      },
    );
    return NextResponse.json({ ok: false, errors }, { status: 500 });
  }

  console.log(`[rgpd-purge] audit_logs_12m: ${auditResult ?? 0}, medical_data: ${medicalResult ?? 0}, medical_events: ${medEventsDeleted}, login_attempts: ${loginResult ?? 'ok'}, revoked_tokens: ok, audit_logs_3y: ${auditOldResult ?? 'ok'}, notes_12m: ${notesResult ?? 0}, calls_24m: ${callsResult ?? 0}, dossiers: ${dossiersPurgedCount} (files: ${filesPurgedCount})${dryRun ? ' [DRY-RUN]' : ''}`);

  return NextResponse.json({
    ok: true,
    dryRun,
    purged: {
      audit_logs_12m: auditResult ?? 0,
      medical_data: medicalResult ?? 0,
      medical_events_3m: medEventsDeleted,
      login_attempts_24h: loginResult ?? 'ok',
      revoked_tokens: 'ok',
      audit_logs_3y: auditOldResult ?? 'ok',
      notes_12m: notesResult ?? 0,
      calls_24m: callsResult ?? 0,
      dossiers_abandoned: dossiersPurgedCount,
      dossier_files: filesPurgedCount,
      ...(dryRun ? { dossier_candidates: dossierCandidates } : {}),
    },
  });
}
