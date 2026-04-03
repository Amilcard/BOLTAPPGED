export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { sendSouhaitNotificationEducateur } from '@/lib/email';
import { generateEducateurAggregateToken } from '@/lib/educateur-token';
/**
 * POST /api/souhaits
 * Crée un souhait côté serveur et envoie un email à l'éducateur.
 *
 * Schéma réel gd_souhaits :
 * kid_prenom, kid_prenom_referent, sejour_slug, sejour_titre, motivation,
 * educateur_email, structure_domain, kid_session_token, educateur_token,
 * educateur_prenom, status ('emis'), suivi_token_kid (auto)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      kidSessionToken,   // UUID localStorage du kid
      kidPrenom,
      kidPrenomReferent, // prénom de l'accompagnant (optionnel)
      sejourSlug,
      sejourTitre,
      motivation,
      educateurEmail,
      educateurPrenom,
      choixMode,         // 'seul' | 'ami' | 'educateur' (optionnel)
    } = body;

    // Valider choixMode si fourni
    const validChoixModes = ['seul', 'ami', 'educateur'];
    const safeChoixMode = choixMode && validChoixModes.includes(choixMode) ? choixMode : null;

    if (!kidSessionToken || !kidPrenom || !sejourSlug || !motivation || !educateurEmail) {
      return NextResponse.json({ error: 'Champs obligatoires manquants.' }, { status: 400 });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(kidSessionToken)) {
      return NextResponse.json({ error: 'Token invalide.' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(educateurEmail)) {
      return NextResponse.json({ error: 'Email éducateur invalide.' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Extraire le domaine pour gd_structures
    const domain = educateurEmail.split('@')[1]?.toLowerCase();
    const genericDomains = ['gmail.com','outlook.fr','outlook.com','hotmail.com','hotmail.fr','yahoo.fr','yahoo.com','live.fr','live.com','orange.fr','free.fr','sfr.fr','laposte.net','icloud.com','protonmail.com'];
    const structureDomain = domain && !genericDomains.includes(domain) ? domain : null;

    // Chercher structure si domaine non-générique
    let structureId: string | null = null;
    if (structureDomain) {
      const { data: struct } = await supabase
        .from('gd_structures')
        .select('id')
        .eq('domain', structureDomain)
        .single();
      structureId = struct?.id ?? null;
    }

    // Vérifier doublon pour ce kid + séjour
    const { data: existing } = await supabase
      .from('gd_souhaits')
      .select('id, status, educateur_token')
      .eq('kid_session_token', kidSessionToken)
      .eq('sejour_slug', sejourSlug)
      .single();

    if (existing && !['valide', 'refuse'].includes(existing.status)) {
      // Mettre à jour le souhait existant
      await supabase.from('gd_souhaits').update({
        motivation,
        educateur_email: educateurEmail,
        educateur_prenom: educateurPrenom || null,
        kid_prenom_referent: kidPrenomReferent || null,
        choix_mode: safeChoixMode,
        status: 'emis',
        reponse_educateur: null,
        reponse_date: null,
      }).eq('id', existing.id);

      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.groupeetdecouverte.fr';
      const aggregateToken = generateEducateurAggregateToken(educateurEmail);
      sendSouhaitNotificationEducateur({
        educateurEmail,
        educateurPrenom: educateurPrenom || undefined,
        kidPrenom,
        sejourTitre: sejourTitre || sejourSlug,
        motivation,
        lienReponse: `${baseUrl}/educateur/souhait/${existing.educateur_token}`,
        lienTousSouhaits: `${baseUrl}/educateur/souhaits/${aggregateToken}`,
      }).catch((e) => console.error('[EMAIL] Souhait update non envoyé:', e?.message));

      return NextResponse.json({ id: existing.id, updated: true });
    }

    if (existing) {
      return NextResponse.json({ id: existing.id, updated: false, message: 'Souhait déjà traité.' });
    }

    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Créer le souhait
    const { data: souhait, error } = await supabase
      .from('gd_souhaits')
      .insert({
        kid_session_token: kidSessionToken,
        kid_prenom: kidPrenom,
        kid_prenom_referent: kidPrenomReferent || null,
        sejour_slug: sejourSlug,
        sejour_titre: sejourTitre || null,
        motivation,
        educateur_email: educateurEmail,
        educateur_prenom: educateurPrenom || null,
        structure_domain: structureDomain,
        structure_id: structureId,
        choix_mode: safeChoixMode,
        status: 'emis',
        educateur_token_expires_at: tokenExpiresAt,
      })
      .select('id, educateur_token, suivi_token_kid')
      .single();

    if (error || !souhait) {
      console.error('POST /api/souhaits error:', error);
      return NextResponse.json({ error: 'Erreur création souhait.' }, { status: 500 });
    }

    if (!souhait.educateur_token) {
      console.error('POST /api/souhaits: educateur_token null après INSERT', souhait.id);
      return NextResponse.json({ error: 'Erreur configuration souhait.' }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.groupeetdecouverte.fr';
    const aggregateToken = generateEducateurAggregateToken(educateurEmail);
    sendSouhaitNotificationEducateur({
      educateurEmail,
      educateurPrenom: educateurPrenom || undefined,
      kidPrenom,
      sejourTitre: sejourTitre || sejourSlug,
      motivation,
      lienReponse: `${baseUrl}/educateur/souhait/${souhait.educateur_token}`,
      lienTousSouhaits: `${baseUrl}/educateur/souhaits/${aggregateToken}`,
    }).catch((e) => console.error('[EMAIL] Souhait non envoyé:', e?.message));

    return NextResponse.json({
      id: souhait.id,
      suiviTokenKid: souhait.suivi_token_kid,
    }, { status: 201 });

  } catch (err) {
    console.error('POST /api/souhaits error:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
