export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
/**
 * GET /api/suivi/[token]
 * Vue lecture seule : retourne tous les dossiers liés au même référent
 * (même email) à partir du suivi_token d'un dossier.
 *
 * Sécurité : pas d'auth classique, le token UUID est le secret (magic link).
 * On ne retourne QUE les champs utiles au référent, jamais les données admin internes.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Validation basique UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!token || !uuidRegex.test(token)) {
      return NextResponse.json(
        { error: { code: 'INVALID_TOKEN', message: 'Lien de suivi invalide.' } },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // 1. Trouver l'inscription source par suivi_token
    const { data: sourceRaw, error: sourceErr } = await supabase
      .from('gd_inscriptions')
      .select('referent_email, organisation')
      .eq('suivi_token', token)
      .single();

    const source = sourceRaw as { referent_email: string; organisation?: string } | null;

    if (sourceErr || !source) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Dossier non trouvé. Ce lien est peut-être expiré ou invalide.' } },
        { status: 404 }
      );
    }

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
      .order('created_at', { ascending: false });

    if (dossiersErr) {
      console.error('GET /api/suivi/[token] query error:', dossiersErr);
      throw dossiersErr;
    }

    // 3. Enrichir avec les noms marketing des séjours
    const rows = (dossiers || []) as unknown as Record<string, unknown>[];
    const slugs = [...new Set(rows.map(d => d.sejour_slug as string))];
    let stayNames: Record<string, string> = {};
    if (slugs.length > 0) {
      const { data: stays } = await supabase
        .from('gd_stays')
        .select('slug, marketing_title')
        .in('slug', slugs);
      if (stays) {
        const stayRows = stays as unknown as { slug: string; marketing_title?: string }[];
        stayNames = Object.fromEntries(
          stayRows.map(s => [s.slug, s.marketing_title || s.slug.replace(/-/g, ' ')])
        );
      }
    }

    // 4. Mapper pour la vue pro (champs exposés uniquement)
    const result = rows.map(d => {
      const slug = d.sejour_slug as string;
      return {
        id: d.id,
        dossierRef: d.dossier_ref,
        sejourNom: stayNames[slug] || slug.replace(/-/g, ' '),
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
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!token || !uuidRegex.test(token)) {
      return NextResponse.json(
        { error: { code: 'INVALID_TOKEN', message: 'Lien invalide.' } },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const body = await req.json();
    const { inscriptionId, field, value } = body;

    if (!inscriptionId || !field) {
      return NextResponse.json(
        { error: { code: 'MISSING_PARAMS', message: 'Paramètres manquants.' } },
        { status: 400 }
      );
    }

    // Champs éditables par le référent (whitelist stricte)
    const editableFields: Record<string, (v: unknown) => unknown> = {
      pref_nouvelles_sejour: (v) => {
        const allowed = ['oui', 'non', 'si_besoin'];
        return allowed.includes(v as string) ? v : 'si_besoin';
      },
      pref_canal_contact: (v) => {
        const allowed = ['email', 'telephone', 'les_deux'];
        return allowed.includes(v as string) ? v : 'email';
      },
      pref_bilan_fin_sejour: (v) => Boolean(v),
      consignes_communication: (v) => {
        const s = typeof v === 'string' ? v.trim().slice(0, 500) : null;
        return s || null;
      },
      besoins_specifiques: (v) => {
        const s = typeof v === 'string' ? v.trim().slice(0, 1000) : null;
        return s || null;
      },
    };

    if (!editableFields[field]) {
      return NextResponse.json(
        { error: { code: 'FIELD_NOT_ALLOWED', message: 'Ce champ n\'est pas modifiable.' } },
        { status: 403 }
      );
    }

    // Vérifier que le token correspond à un dossier du même référent
    const { data: sourceRaw } = await supabase
      .from('gd_inscriptions')
      .select('referent_email')
      .eq('suivi_token', token)
      .single();
    const tokenOwner = sourceRaw as { referent_email: string } | null;

    if (!tokenOwner) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Token invalide.' } },
        { status: 404 }
      );
    }

    // Vérifier que l'inscription ciblée appartient au même référent
    const { data: targetRaw } = await supabase
      .from('gd_inscriptions')
      .select('referent_email')
      .eq('id', inscriptionId)
      .single();
    const target = targetRaw as { referent_email: string } | null;

    if (!target || target.referent_email !== tokenOwner.referent_email) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Accès non autorisé à ce dossier.' } },
        { status: 403 }
      );
    }

    // Appliquer la mise à jour
    const sanitizedValue = editableFields[field](value);
    const { error: updateErr } = await supabase
      .from('gd_inscriptions')
      .update({ [field]: sanitizedValue })
      .eq('id', inscriptionId);

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
