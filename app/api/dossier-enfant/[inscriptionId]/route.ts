export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { REQUIS_TO_JOINT, EDITABLE_BLOCS, getCompletedColumn, type EditableBloc } from '@/lib/dossier-shared';
import { verifyOwnership } from '@/lib/verify-ownership';
import { auditLog, getClientIp } from '@/lib/audit-log';
import { validateBase64Image } from '@/lib/validators';
import { buildSignatureMeta, CONSENT_TEXT_VERSION } from '@/lib/signature-meta';

/**
 * GET /api/dossier-enfant/[inscriptionId]?token=xxx
 * Retourne le dossier enfant lié à une inscription.
 * Sécurité : le suivi_token doit correspondre au même référent.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ inscriptionId: string }> }
) {
  try {
    const { inscriptionId } = await params;
    const token = req.nextUrl.searchParams.get('token');

    if (!token || !inscriptionId) {
      return NextResponse.json(
        { error: { code: 'MISSING_PARAMS', message: 'Paramètres manquants.' } },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Vérifier ownership via token
    const ownership = await verifyOwnership(supabase, token, inscriptionId);
    if (!ownership.ok) {
      return NextResponse.json(
        { error: { code: ownership.code, message: ownership.message } },
        { status: ownership.status }
      );
    }

    // Audit log : accès lecture dossier enfant (RGPD Art. 9)
    await auditLog(supabase, {
      action: 'read',
      resourceType: 'dossier_enfant',
      resourceId: inscriptionId,
      inscriptionId,
      actorType: 'referent',
      actorId: ownership.ok ? ownership.referentEmail : undefined,
      ipAddress: getClientIp(req),
    });

    // Chercher le dossier enfant existant
    const { data: dossier, error: err } = await supabase
      .from('gd_dossier_enfant')
      .select('*')
      .eq('inscription_id', inscriptionId)
      .maybeSingle();

    if (err) {
      console.error('GET dossier-enfant error:', err);
      throw err;
    }

    // Si pas de dossier, retourner un squelette vide (le front sait qu'il faut créer)
    if (!dossier) {
      // Déterminer renseignements_required depuis gd_stays pour afficher le bon nombre d'onglets dès le premier chargement
      let renseignementsRequired = false;
      const { data: inscRaw } = await supabase
        .from('gd_inscriptions')
        .select('sejour_slug')
        .eq('id', inscriptionId)
        .single();
      if (inscRaw) {
        const { data: stayRaw } = await supabase
          .from('gd_stays')
          .select('documents_requis')
          .eq('slug', (inscRaw as { sejour_slug?: string }).sejour_slug)
          .maybeSingle();
        if (stayRaw) {
          const docs = Array.isArray((stayRaw as { documents_requis?: unknown[] }).documents_requis)
            ? (stayRaw as { documents_requis: unknown[] }).documents_requis
            : [];
          renseignementsRequired = docs.includes('renseignements');
        }
      }

      // Docs optionnels requis (dossier vide → aucun doc uploadé encore)
      const { requis: docs_optionnels_requis, manquants: docs_optionnels_manquants } =
        await getDocsOptionnelsManquants(supabase, inscriptionId, []);

      return NextResponse.json({
        exists: false,
        inscriptionId,
        bulletin_complement: {},
        fiche_sanitaire: {},
        fiche_liaison_jeune: {},
        fiche_renseignements: null,
        documents_joints: [],
        bulletin_completed: false,
        sanitaire_completed: false,
        // Liaison + renseignements retirés du parcours en ligne 2026-04-24 :
        // les 2 PDF sont envoyés par mail sécurisé à la structure, qui les
        // retourne signés via upload. Flags pré-settés à true pour que
        // isComplete côté front débloque le submit (cf. ADR 2026-04-24).
        liaison_completed: true,
        renseignements_completed: true,
        renseignements_required: renseignementsRequired,
        docs_optionnels_requis,
        docs_optionnels_manquants,
      });
    }

    const docsJoints = Array.isArray((dossier as { documents_joints?: unknown[] }).documents_joints)
      ? ((dossier as { documents_joints: Array<{ type: string }> }).documents_joints)
      : [];
    const { requis: docs_optionnels_requis, manquants: docs_optionnels_manquants } =
      await getDocsOptionnelsManquants(supabase, inscriptionId, docsJoints);

    return NextResponse.json({
      exists: true,
      ...dossier,
      docs_optionnels_requis,
      docs_optionnels_manquants,
    });
  } catch (error) {
    console.error('GET /api/dossier-enfant error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/dossier-enfant/[inscriptionId]
 * Met à jour un bloc JSONB du dossier enfant.
 * Body : { token, bloc, data, completed? }
 * - token : suivi_token pour authentification
 * - bloc : nom du bloc JSONB (whitelist)
 * - data : objet JSONB à merger dans le bloc
 * - completed : booléen optionnel pour marquer le bloc comme complet
 *
 * Stratégie : MERGE (pas remplace) — on fusionne data dans le bloc existant.
 * Cela permet la sauvegarde progressive champ par champ.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ inscriptionId: string }> }
) {
  try {
    const { inscriptionId } = await params;
    const body = await req.json();
    const { token, bloc, data, completed } = body;

    if (!token || !inscriptionId || !bloc) {
      return NextResponse.json(
        { error: { code: 'MISSING_PARAMS', message: 'Paramètres manquants.' } },
        { status: 400 }
      );
    }

    // Vérifier que le bloc est dans la whitelist
    if (!EDITABLE_BLOCS.includes(bloc as EditableBloc)) {
      return NextResponse.json(
        { error: { code: 'INVALID_BLOC', message: 'Bloc non autorisé.' } },
        { status: 403 }
      );
    }

    // Validation basique : data doit être un objet
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return NextResponse.json(
        { error: { code: 'INVALID_DATA', message: 'Les données doivent être un objet.' } },
        { status: 400 }
      );
    }

    // Size cap signature_image_url — data URL PNG généré par canvas front.
    // Cap 500 KB décodé = ~40× la taille typique (10-20 KB), prévient DoS
    // par payload volumineux avant persist Supabase + embedPng côté PDF.
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
          { status: 413 }
        );
      }
    }

    const supabase = getSupabaseAdmin();

    // Vérifier ownership via token
    const ownership = await verifyOwnership(supabase, token, inscriptionId);
    if (!ownership.ok) {
      return NextResponse.json(
        { error: { code: ownership.code, message: ownership.message } },
        { status: ownership.status }
      );
    }

    // Vérifier si le dossier existe déjà
    const { data: existing } = await supabase
      .from('gd_dossier_enfant')
      .select('id, ' + bloc)
      .eq('inscription_id', inscriptionId)
      .maybeSingle();

    // C#3 — Métadonnées signature SES eIDAS (si signature nouvelle détectée)
    const existingBlocData =
      (existing as unknown as Record<string, unknown>)?.[bloc] as
        | Record<string, unknown>
        | undefined;
    const sigMeta = buildSignatureMeta({
      bloc,
      incomingData: data as Record<string, unknown>,
      existingBlocData: existingBlocData || {},
      ip: getClientIp(req),
    });
    if (!sigMeta.ok) {
      return NextResponse.json(
        { error: { code: sigMeta.code, message: sigMeta.message } },
        { status: 400 },
      );
    }
    const signatureApposed = Object.keys(sigMeta.columns).length > 0;

    let result;

    if (!existing) {
      // Créer le dossier avec ce bloc
      const insertData: Record<string, unknown> = {
        inscription_id: inscriptionId,
        [bloc]: data,
        ...sigMeta.columns,
      };
      if (typeof completed === 'boolean') {
        // Map bloc name to completed column
        const completedCol = getCompletedColumn(bloc);
        if (completedCol) insertData[completedCol] = completed;
      }

      // Initialiser renseignements_required depuis gd_stays.documents_requis
      const { data: inscRaw } = await supabase
        .from('gd_inscriptions')
        .select('sejour_slug')
        .eq('id', inscriptionId)
        .single();
      if (inscRaw) {
        const insc = inscRaw as { sejour_slug?: string };
        const { data: stayRaw } = await supabase
          .from('gd_stays')
          .select('documents_requis')
          .eq('slug', insc.sejour_slug)
          .maybeSingle();
        if (stayRaw) {
          const stay = stayRaw as { documents_requis?: unknown[] };
          const docs = Array.isArray(stay.documents_requis) ? stay.documents_requis : [];
          insertData.renseignements_required = docs.includes('renseignements');
        }
      }

      // Liaison + renseignements retirés du parcours en ligne 2026-04-24 :
      // les 2 PDF sont envoyés par mail sécurisé à la structure, qui les
      // retourne signés via upload. On pré-set les 2 flags à true pour que
      // la gate submit (bulletin+sanitaire+liaison+renseignements all true)
      // ne bloque plus sur ces documents (cf. ADR 2026-04-24). Les JSONB
      // `fiche_liaison_jeune` et `fiche_renseignements` restent éditables
      // via l'API PATCH (backward-compat admin).
      if (insertData.liaison_completed === undefined) {
        insertData.liaison_completed = true;
      }
      if (insertData.renseignements_completed === undefined) {
        insertData.renseignements_completed = true;
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('gd_dossier_enfant')
        .insert(insertData)
        .select()
        .single();

      if (insertErr) {
        console.error('INSERT dossier-enfant error:', insertErr);
        throw insertErr;
      }
      result = inserted;
    } else {
      // Merger les données dans le bloc existant
      const existingBloc = (existing as unknown as Record<string, unknown>)[bloc] as Record<string, unknown> || {};
      const merged = { ...existingBloc, ...data };

      const updateData: Record<string, unknown> = {
        [bloc]: merged,
        ...sigMeta.columns,
      };
      const completedCol = getCompletedColumn(bloc);
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
        console.error('UPDATE dossier-enfant error:', updateErr);
        throw updateErr;
      }
      result = updated;

    }

    // Sync nom_famille → gd_inscriptions.jeune_nom (Option C, 2026-04-21)
    // Le nom officiel est saisi dans bulletin_complement.nom_famille par le
    // responsable légal. On propage vers la colonne inscription pour que les
    // PDFs / emails / dashboards affichent le nom correct sans double-lecture.
    if (bloc === 'bulletin_complement') {
      const nomFamille = (data as Record<string, unknown>)?.nom_famille;
      if (typeof nomFamille === 'string' && nomFamille.trim().length > 0) {
        const cleaned = nomFamille.trim().slice(0, 100);
        const { error: syncErr } = await supabase
          .from('gd_inscriptions')
          .update({ jeune_nom: cleaned, updated_at: new Date().toISOString() })
          .eq('id', inscriptionId);
        if (syncErr) {
          console.error('[dossier-enfant PATCH] sync jeune_nom failed:', syncErr.message);
          // Non-bloquant : l'écriture dossier est déjà OK
        }
      }
    }

    await auditLog(supabase, {
      action: 'update',
      resourceType: 'dossier_enfant',
      resourceId: inscriptionId,
      inscriptionId,
      actorType: 'referent',
      actorId: ownership.ok ? ownership.referentEmail : undefined,
      ipAddress: getClientIp(req),
      metadata: {
        bloc,
        completed,
        signature_apposed: signatureApposed,
        ...(signatureApposed
          ? {
              signer_qualite: (data as Record<string, unknown>).signer_qualite,
              consent_version: CONSENT_TEXT_VERSION,
            }
          : {}),
      },
    });
    return NextResponse.json({ ok: true, dossier: result });
  } catch (error) {
    console.error('PATCH /api/dossier-enfant error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}

// === Helpers ===

// REQUIS_TO_JOINT importé depuis @/lib/dossier-shared

async function getDocsOptionnelsManquants(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  inscriptionId: string,
  documentsJoints: Array<{ type: string }>
): Promise<{ requis: string[]; manquants: string[] }> {
  const { data: inscRaw } = await supabase
    .from('gd_inscriptions')
    .select('sejour_slug')
    .eq('id', inscriptionId)
    .single();
  if (!inscRaw) return { requis: [], manquants: [] };

  const { data: stayRaw } = await supabase
    .from('gd_stays')
    .select('documents_requis')
    .eq('slug', (inscRaw as { sejour_slug?: string }).sejour_slug)
    .maybeSingle();
  if (!stayRaw) return { requis: [], manquants: [] };

  const docsRequis = Array.isArray((stayRaw as { documents_requis?: unknown[] }).documents_requis)
    ? ((stayRaw as { documents_requis: unknown[] }).documents_requis as string[])
    : [];

  const uploadedTypes = new Set(documentsJoints.map(d => d.type));
  const requis: string[] = [];
  const manquants: string[] = [];

  for (const key of docsRequis) {
    const jointType = REQUIS_TO_JOINT[key];
    if (!jointType) continue;
    requis.push(key);
    if (!uploadedTypes.has(jointType)) manquants.push(key);
  }

  return { requis, manquants };
}

// verifyOwnership importé depuis @/lib/verify-ownership (centralisé RGPD)
// EDITABLE_BLOCS + getCompletedColumn importés depuis @/lib/dossier-shared (source unique)
