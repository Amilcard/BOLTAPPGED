export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

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
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

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
    // → permet la vue multi-enfants / multi-dossiers
    const { data: dossiers, error: dossiersErr } = await supabase
      .from('gd_inscriptions')
      .select('*')
      .eq('referent_email', source.referent_email)
      .order('created_at', { ascending: false });

    if (dossiersErr) {
      console.error('GET /api/suivi/[token] query error:', dossiersErr);
      throw dossiersErr;
    }

    // 3. Enrichir avec les noms marketing des séjours
    const rows = (dossiers || []) as Record<string, unknown>[];
    const slugs = [...new Set(rows.map(d => d.sejour_slug as string))];
    let stayNames: Record<string, string> = {};
    if (slugs.length > 0) {
      const { data: stays } = await supabase
        .from('gd_stays')
        .select('slug, marketing_title')
        .in('slug', slugs);
      if (stays) {
        const stayRows = stays as { slug: string; marketing_title?: string }[];
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
        sessionDate: d.session_date,
        cityDeparture: d.city_departure,
        jeunePrenom: d.jeune_prenom,
        jeuneNom: d.jeune_nom,
        jeuneDateNaissance: d.jeune_date_naissance,
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
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      };
    });

    return NextResponse.json({
      referent: {
        nom: source.organisation || (dossiers?.[0]?.referent_nom ?? ''),
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
