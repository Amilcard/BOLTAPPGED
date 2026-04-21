export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendSouhaitNotificationEducateur } from '@/lib/email';
import { generateEducateurAggregateToken } from '@/lib/educateur-token';
import { isRateLimited, getClientIpFromHeaders } from '@/lib/rate-limit';
import { EMAIL_REGEX, UUID_RE, isSafeImageUrl } from '@/lib/validators';
import { auditLog } from '@/lib/audit-log';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * P2.1 — récupère l'URL image hero d'un séjour pour l'email éducateur.
 * Fallback silencieux sur undefined si pas d'image / séjour absent / URL invalide.
 * Lecture seule — pas PII, pas de RLS impact (service_role).
 */
async function getSejourHeroImage(supabase: SupabaseClient, slug: string): Promise<string | undefined> {
  if (!slug) return undefined;
  const { data } = await supabase
    .from('gd_stays')
    .select('images')
    .eq('slug', slug)
    .single();
  const images = data?.images as unknown;
  const first = Array.isArray(images) ? (images as unknown[])[0] : null;
  return typeof first === 'string' && isSafeImageUrl(first) ? first : undefined;
}

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
    const ip = getClientIpFromHeaders(req.headers);
    if (await isRateLimited('wish', ip, 10, 5)) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Trop de requêtes. Réessayez dans quelques minutes.' } },
        { status: 429, headers: { 'Retry-After': '300' } }
      );
    }

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
      choixMode,         // 'seul' | 'ami' | 'educateur' | 'app' (optionnel)
    } = body;

    // Valider choixMode si fourni
    const validChoixModes = ['seul', 'ami', 'educateur', 'app'];
    const safeChoixMode = choixMode && validChoixModes.includes(choixMode as string) ? choixMode : null;

    if (!kidSessionToken || !sejourSlug || !motivation || !educateurEmail) {
      return NextResponse.json({ error: 'Champs obligatoires manquants.' }, { status: 400 });
    }

    if (!UUID_RE.test(kidSessionToken as string)) {
      return NextResponse.json({ error: 'Token invalide.' }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(educateurEmail as string)) {
      return NextResponse.json({ error: 'Email éducateur invalide.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Extraire le domaine pour gd_structures (si email fourni)
    const safeEmail = typeof educateurEmail === 'string' && educateurEmail.trim() ? educateurEmail.trim() : null;
    const domain = safeEmail ? safeEmail.split('@')[1]?.toLowerCase() : null;
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
        educateur_email: safeEmail,
        educateur_prenom: educateurPrenom || null,
        kid_prenom_referent: kidPrenomReferent || null,
        choix_mode: safeChoixMode,
        status: 'emis',
        reponse_educateur: null,
        reponse_date: null,
      }).eq('id', existing.id);

      // RGPD — tracer mise à jour souhait (PII mineur, acteur kid anonyme)
      await auditLog(supabase, {
        action: 'update',
        resourceType: 'inscription',
        resourceId: existing.id,
        actorType: 'system',
        actorId: kidSessionToken,
        ipAddress: ip === 'unknown' ? undefined : ip,
        metadata: { route: '/api/souhaits', kind: 'souhait', sejourSlug },
      });

      if (safeEmail) {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.groupeetdecouverte.fr';
        const [aggregateToken, sejourImageUrl] = await Promise.all([
          generateEducateurAggregateToken(safeEmail),
          getSejourHeroImage(supabase, sejourSlug),
        ]);
        await sendSouhaitNotificationEducateur({
          educateurEmail: safeEmail,
          educateurPrenom: educateurPrenom || undefined,
          kidPrenom: typeof kidPrenom === 'string' ? kidPrenom : '',
          sejourTitre: sejourTitre || sejourSlug,
          sejourImageUrl,
          motivation,
          lienReponse: `${baseUrl}/educateur/souhait/${existing.educateur_token}`,
          lienTousSouhaits: aggregateToken ? `${baseUrl}/educateur/souhaits/${aggregateToken}` : undefined,
        }).catch((e) => console.error('[EMAIL] Souhait update non envoyé:', e?.message));
      }

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
        kid_prenom: typeof kidPrenom === 'string' && kidPrenom.trim() ? kidPrenom.trim() : null,
        kid_prenom_referent: kidPrenomReferent || null,
        sejour_slug: sejourSlug,
        sejour_titre: sejourTitre || null,
        motivation,
        educateur_email: safeEmail,
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

    // RGPD — tracer création souhait (PII mineur, acteur kid anonyme)
    await auditLog(supabase, {
      action: 'create',
      resourceType: 'inscription',
      resourceId: souhait.id,
      actorType: 'system',
      actorId: kidSessionToken,
      ipAddress: ip === 'unknown' ? undefined : ip,
      metadata: { route: '/api/souhaits', kind: 'souhait', sejourSlug },
    });

    if (safeEmail) {
      if (!souhait.educateur_token) {
        console.error('POST /api/souhaits: educateur_token null après INSERT', souhait.id);
        return NextResponse.json({ error: 'Erreur configuration souhait.' }, { status: 500 });
      }
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.groupeetdecouverte.fr';
      const [aggregateToken, sejourImageUrl] = await Promise.all([
        generateEducateurAggregateToken(safeEmail),
        getSejourHeroImage(supabase, sejourSlug),
      ]);
      await sendSouhaitNotificationEducateur({
        educateurEmail: safeEmail,
        educateurPrenom: typeof educateurPrenom === 'string' ? educateurPrenom : undefined,
        kidPrenom: typeof kidPrenom === 'string' ? kidPrenom : '',
        sejourTitre: String(sejourTitre || sejourSlug),
        sejourImageUrl,
        motivation: String(motivation),
        lienReponse: `${baseUrl}/educateur/souhait/${souhait.educateur_token as string}`,
        lienTousSouhaits: aggregateToken ? `${baseUrl}/educateur/souhaits/${aggregateToken}` : undefined,
      }).catch((e) => console.error('[EMAIL] Souhait non envoyé:', e?.message));
    }

    return NextResponse.json({
      id: souhait.id,
      suiviTokenKid: souhait.suivi_token_kid,
    }, { status: 201 });

  } catch (err) {
    console.error('POST /api/souhaits error:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
