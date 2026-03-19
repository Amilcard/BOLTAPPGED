export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSouhaitNotificationEducateur } from '@/lib/email';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/souhaits
 * Crée un souhait côté serveur et envoie un email à l'éducateur.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      kidToken,
      kidPrenom,
      sejourSlug,
      sejourTitre,
      sejourUrl,
      motivation,
      educateurEmail,
      educateurPrenom,
    } = body;

    if (!kidToken || !kidPrenom || !sejourSlug || !motivation || !educateurEmail) {
      return NextResponse.json({ error: 'Champs obligatoires manquants.' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(educateurEmail)) {
      return NextResponse.json({ error: 'Email éducateur invalide.' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Vérifier si le kid a déjà un souhait pour ce séjour (pas de doublon)
    const { data: existing } = await supabase
      .from('gd_souhaits')
      .select('id, statut')
      .eq('kid_token', kidToken)
      .eq('sejour_slug', sejourSlug)
      .single();

    if (existing) {
      // Mettre à jour le souhait existant si pas encore validé/refusé
      if (!['valide', 'refuse'].includes(existing.statut)) {
        await supabase
          .from('gd_souhaits')
          .update({ motivation, educateur_email: educateurEmail, educateur_prenom: educateurPrenom || null, statut: 'emis' })
          .eq('id', existing.id);

        const { data: updated } = await supabase
          .from('gd_souhaits')
          .select('id, educateur_token')
          .eq('id', existing.id)
          .single();

        if (updated) {
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.groupeetdecouverte.fr';
          await sendSouhaitNotificationEducateur({
            educateurEmail,
            educateurPrenom: educateurPrenom || undefined,
            kidPrenom,
            sejourTitre: sejourTitre || sejourSlug,
            motivation,
            lienReponse: `${baseUrl}/educateur/souhait/${updated.educateur_token}`,
          }).catch(() => {});
        }
        return NextResponse.json({ id: existing.id, updated: true });
      }
      return NextResponse.json({ id: existing.id, updated: false, message: 'Souhait déjà traité.' });
    }

    // Créer le souhait
    const { data: souhait, error } = await supabase
      .from('gd_souhaits')
      .insert({
        kid_token: kidToken,
        kid_prenom: kidPrenom,
        sejour_slug: sejourSlug,
        sejour_titre: sejourTitre || null,
        sejour_url: sejourUrl || null,
        motivation,
        educateur_email: educateurEmail,
        educateur_prenom: educateurPrenom || null,
      })
      .select('id, educateur_token')
      .single();

    if (error || !souhait) {
      console.error('POST /api/souhaits error:', error);
      return NextResponse.json({ error: 'Erreur création souhait.' }, { status: 500 });
    }

    // Envoyer email éducateur (non-bloquant)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.groupeetdecouverte.fr';
    sendSouhaitNotificationEducateur({
      educateurEmail,
      educateurPrenom: educateurPrenom || undefined,
      kidPrenom,
      sejourTitre: sejourTitre || sejourSlug,
      motivation,
      lienReponse: `${baseUrl}/educateur/souhait/${souhait.educateur_token}`,
    }).catch(() => {});

    return NextResponse.json({ id: souhait.id }, { status: 201 });
  } catch (err) {
    console.error('POST /api/souhaits error:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
