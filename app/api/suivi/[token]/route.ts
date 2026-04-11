export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { verifyToken, verifyOwnership } from '@/lib/verify-ownership';
import { auditLog, getClientIp } from '@/lib/audit-log';
/**
 * GET /api/suivi/[token]
 * Vue lecture seule : retourne tous les dossiers liés au même référent
 * (même email) à partir du suivi_token d'un dossier.
 *
 * Sécurité : pas d'auth classique, le token UUID est le secret (magic link).
 * On ne retourne QUE les champs utiles au référent, jamais les données admin internes.
 * RGPD : vérification expiration token + audit log.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const supabase = getSupabase();

    // 1. Vérifier le token (validité + expiration RGPD) avec renouvellement sliding window
    const tokenCheck = await verifyToken(supabase, token, { renew: true });
    if (!tokenCheck.ok) {
      return NextResponse.json(
        { error: { code: tokenCheck.code, message: tokenCheck.message } },
        { status: tokenCheck.status }
      );
    }

    const source = { referent_email: tokenCheck.referentEmail, organisation: tokenCheck.organisation };

    // 2. Récupérer TOUS les dossiers du même référent (même email)
    // → colonnes explicites (RGPD : ne pas exposer remarques, stripe_id, etc.)
    const { data: dossiers, error: dossiersErr } = await supabase
      .from('gd_inscriptions')
      .select(
        'id, dossier_ref, sejour_slug, session_date, city_departure, ' +
        'jeune_prenom, jeune_nom, ' +
        'organisation, referent_nom, ' +
        'price_total, status, payment_status, payment_method, payment_reference, ' +
        'options_educatives, ' +
        'documents_status, besoins_pris_en_compte, equipe_informee, note_pro, ' +
        'pref_nouvelles_sejour, pref_canal_contact, pref_bilan_fin_sejour, ' +
        'consignes_communication, besoins_specifiques, ' +
        'created_at, updated_at'
      )
      .eq('referent_email', source.referent_email)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (dossiersErr) {
      console.error('GET /api/suivi/[token] query error:', dossiersErr);
      throw dossiersErr;
    }

    // 3. Enrichir avec les noms marketing des séjours
    const rows = (dossiers || []) as unknown as Record<string, unknown>[];
    const slugs = [...new Set(rows.map(d => d.sejour_slug as string))];
    const stayNames: Record<string, string> = Object.create(null) as Record<string, string>;
    if (slugs.length > 0) {
      const { data: stays } = await supabase
        .from('gd_stays')
        .select('slug, marketing_title')
        .in('slug', slugs);
      if (stays) {
        const stayRows = stays as unknown as { slug: string; marketing_title?: string }[];
        for (const s of stayRows) {
          stayNames[s.slug] = s.marketing_title || s.slug.replace(/-/g, ' ');
        }
      }
    }

    // 4. Mapper pour la vue pro (champs exposés uniquement)
    const result = rows.map(d => {
      const slug = d.sejour_slug as string;
      const sejourNom = Object.prototype.hasOwnProperty.call(stayNames, slug)
        ? stayNames[slug]
        : slug.replace(/-/g, ' ');
      return {
        id: d.id,
        dossierRef: d.dossier_ref,
        sejourNom,
        sejourSlug: slug,
        sessionDate: d.session_date,
        cityDeparture: d.city_departure,
        jeunePrenom: d.jeune_prenom,
        jeuneNom: d.jeune_nom,
        organisation: d.organisation,
        referentNom: d.referent_nom,
        priceTotal: d.price_total,
        status: d.status,
        paymentStatus: d.payment_status,
        paymentMethod: d.payment_method,
        paymentReference: d.payment_reference,
        optionsEducatives: d.options_educatives,
        // Phase 2 — suivi séjour
        documentsStatus: d.documents_status,
        besoinsPrisEnCompte: d.besoins_pris_en_compte,
        equipeInformee: d.equipe_informee,
        notePro: d.note_pro,
        // Phase 3 — préférences + besoins
        prefNouvellesSejour: d.pref_nouvelles_sejour,
        prefCanalContact: d.pref_canal_contact,
        prefBilanFinSejour: d.pref_bilan_fin_sejour,
        consignesCommunication: d.consignes_communication,
        besoinsSpecifiques: d.besoins_specifiques,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      };
    });

    // Audit log : accès lecture dossiers (RGPD)
    await auditLog(supabase, {
      action: 'read',
      resourceType: 'inscription',
      resourceId: 'batch',
      actorType: 'referent',
      actorId: source.referent_email,
      ipAddress: getClientIp(_req),
      metadata: { count: result.length, token_prefix: token.slice(0, 8) },
    });

    return NextResponse.json({
      referent: {
        nom: source.organisation || (rows[0]?.referent_nom as string ?? ''),
        email: source.referent_email,
        organisation: source.organisation,
      },
      dossiers: result,
      count: result.length,
    });
  } catch (error) {
    console.error('GET /api/suivi/[token] error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/suivi/[token]
 * Permet au référent de mettre à jour ses préférences de suivi et besoins spécifiques.
 * Body attendu : { inscriptionId, field, value }
 * Sécurité : le token doit correspondre à un dossier du même référent.
 * Seuls les champs éditables par le référent sont acceptés.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = getSupabase();
    const body = await req.json();
    const { inscriptionId, field, value } = body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!inscriptionId || !uuidRegex.test(inscriptionId)) {
      return NextResponse.json(
        { error: { code: 'INVALID_PARAMS', message: 'Paramètres invalides.' } },
        { status: 400 }
      );
    }

    if (!field) {
      return NextResponse.json(
        { error: { code: 'MISSING_PARAMS', message: 'Paramètres manquants.' } },
        { status: 400 }
      );
    }

    // Champs éditables par le référent (whitelist stricte — switch explicite, pas d'accès dynamique)
    const EDITABLE_FIELDS = ['pref_nouvelles_sejour', 'pref_canal_contact', 'pref_bilan_fin_sejour', 'consignes_communication', 'besoins_specifiques'] as const;
    type EditableField = typeof EDITABLE_FIELDS[number];

    if (!EDITABLE_FIELDS.includes(field as EditableField)) {
      return NextResponse.json(
        { error: { code: 'FIELD_NOT_ALLOWED', message: 'Ce champ n\'est pas modifiable.' } },
        { status: 403 }
      );
    }

    // Vérifier ownership + expiration token (RGPD centralisé)
    const ownership = await verifyOwnership(supabase, token, inscriptionId);
    if (!ownership.ok) {
      return NextResponse.json(
        { error: { code: ownership.code, message: ownership.message } },
        { status: ownership.status }
      );
    }

    // Appliquer la mise à jour — switch explicite, aucun accès dynamique à des fonctions
    let sanitizedValue: unknown;
    switch (field as EditableField) {
      case 'pref_nouvelles_sejour':
        sanitizedValue = ['oui', 'non', 'si_besoin'].includes(value as string) ? value : 'si_besoin';
        break;
      case 'pref_canal_contact':
        sanitizedValue = ['email', 'telephone', 'les_deux'].includes(value as string) ? value : 'email';
        break;
      case 'pref_bilan_fin_sejour':
        sanitizedValue = Boolean(value);
        break;
      case 'consignes_communication':
        sanitizedValue = typeof value === 'string' ? (value.trim().slice(0, 500) || null) : null;
        break;
      case 'besoins_specifiques':
        sanitizedValue = typeof value === 'string' ? (value.trim().slice(0, 1000) || null) : null;
        break;
    }
    const { error: updateErr } = await supabase
      .from('gd_inscriptions')
      .update({ [field]: sanitizedValue })
      .eq('id', inscriptionId)
      .is('deleted_at', null);

    if (updateErr) {
      console.error('PATCH /api/suivi/[token] update error:', updateErr);
      throw updateErr;
    }

    return NextResponse.json({ ok: true, field, value: sanitizedValue });
  } catch (error) {
    console.error('PATCH /api/suivi/[token] error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
