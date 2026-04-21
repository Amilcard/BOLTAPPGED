import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendPriceInquiryToEducateur, sendPriceInquiryAlertGED } from '@/lib/email';
import { isRateLimited, getClientIpFromHeaders } from '@/lib/rate-limit';
import { errorResponse } from '@/lib/auth-middleware';
import { validateBodySize } from '@/lib/validators';
import { auditLog } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MIN = 30;
const MAX_BODY_BYTES = 32_768; // 32 Ko — payload attendu ~300 octets, large marge

// Schéma strict — consentement RGPD explicite obligatoire.
// `website` = honeypot anti-bot : champ caché côté front. S'il est rempli,
// on retourne 200 silencieux sans envoyer d'email ni créer de lead.
const PriceInquirySchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(120)
    .pipe(z.string().email('Email invalide')),
  prenom: z.string().trim().min(1).max(80),
  structureName: z.string().trim().min(1).max(200),
  sejourSlug: z.string().regex(/^[a-z0-9-]{1,120}$/, 'Slug invalide'),
  consentAccepted: z.literal(true),
  website: z.string().max(200).optional(), // honeypot — si rempli = bot
});

export async function POST(request: NextRequest) {
  // Fix #3 — Cap body AVANT parse (anti-DoS volumétrique)
  const bodyCheck = validateBodySize(request.headers, { max: MAX_BODY_BYTES });
  if (!bodyCheck.ok) {
    return errorResponse('PAYLOAD_TOO_LARGE', 'Requête trop volumineuse.', 413);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse('INVALID_BODY', 'Corps de requête invalide.', 400);
  }

  // Fix #4 — Validation Zod stricte (incl. consentement obligatoire)
  const parsed = PriceInquirySchema.safeParse(rawBody);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const code = issue?.path?.[0] === 'consentAccepted' ? 'CONSENT_REQUIRED' : 'VALIDATION_ERROR';
    return errorResponse(code, issue?.message ?? 'Données invalides.', 400);
  }

  const { email, prenom, structureName, sejourSlug, website } = parsed.data;

  // Garde anti-spam (honeypot) — 200 silencieux, pas d'email, pas de lead
  if (website && website.trim().length > 0) {
    return NextResponse.json({ ok: true });
  }

  const ip = getClientIpFromHeaders(request.headers);
  const supabase = getSupabaseAdmin();

  // Récupérer le séjour (avant rate-limit : opération SELECT cheap indexée,
  // permet de retourner 404 propre sans brûler une tentative pour un slug typo)
  const { data: sejour, error: sejourError } = await supabase
    .from('gd_stays')
    .select('title, marketing_title, price_from')
    .eq('slug', sejourSlug)
    .eq('published', true)
    .single();

  if (sejourError || !sejour) {
    return errorResponse('NOT_FOUND', 'Séjour introuvable.', 404);
  }

  const sejourTyped = sejour as { title: string; marketing_title?: string | null; price_from?: number | null };
  const sejourTitle = sejourTyped.marketing_title || sejourTyped.title;
  const prixFrom = sejourTyped.price_from ?? null;

  // Fix #6 — INSERT lead en PREMIER (source of truth).
  // Si l'email échoue ensuite, la GED peut toujours relancer manuellement.
  // Le consent_at est tracé dans le metadata auditLog (colonne absente du schéma table).
  const consentAt = new Date().toISOString();
  const submittedAt = new Date().toISOString();

  const { data: insertedLead, error: insertError } = await supabase
    .from('smart_form_submissions')
    .insert({
      contact_email: email,
      referent_organization: structureName,
      suggested_stays: [{ slug: sejourSlug, title: sejourTitle }],
      submitted_at: submittedAt,
    })
    .select('id')
    .single();

  if (insertError || !insertedLead) {
    // Lead NON persisté — incident critique. On N'envoie PAS d'email (sinon
    // user reçoit une réponse mais GED ne voit rien = lead perdu silencieux).
    console.error('[price-inquiry] INSERT lead échoué — abort:', insertError);
    await auditLog(supabase, {
      action: 'create',
      resourceType: 'inscription',
      resourceId: `priceiq:${email}`,
      actorType: 'system',
      actorId: email,
      ipAddress: ip,
      metadata: {
        event: 'lead_insert_failed',
        severity: 'critical',
        structure: structureName,
        sejour_slug: sejourSlug,
        consent_at: consentAt,
        error_code: insertError?.code ?? null,
        error_message: insertError?.message ?? 'unknown',
      },
    });
    return errorResponse('LEAD_PERSIST_FAILED', 'Erreur enregistrement demande. Veuillez réessayer.', 500);
  }

  const leadId = (insertedLead as { id: string }).id;

  // CLAUDE.md §15 — auditLog RGPD sur création PII (contact_email).
  await auditLog(supabase, {
    action: 'create',
    resourceType: 'inscription',
    resourceId: leadId,
    actorType: 'system',
    actorId: email,
    ipAddress: ip,
    metadata: {
      form: 'price_inquiry',
      structure: structureName,
      sejour_slug: sejourSlug,
      consent_at: consentAt,
    },
  });

  // Rate limiting atomique APRÈS insert (RPC check_rate_limit incrémente le compteur).
  // Positionnement post-insert : si le lead n'a pas pu être persisté, le user
  // n'a pas "brûlé" de tentative — il peut réessayer sans attendre 30 min.
  const rateLimitKey = `priceiq:${email}:${ip}`;
  if (await isRateLimited('priceiq', rateLimitKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MIN)) {
    // Lead déjà inséré (sera visible par la GED). On refuse juste l'envoi email
    // pour couper le bruit / abus.
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Trop de demandes. Réessayez dans 30 minutes.' } },
      { status: 429, headers: { 'Retry-After': String(RATE_LIMIT_WINDOW_MIN * 60) } }
    );
  }

  const inquiryData = {
    prenom,
    structureName,
    email,
    sejourTitle,
    sejourSlug,
    prixFrom,
  };

  // Envoyer les deux emails (fail-partial accepté — lead déjà persisté)
  const [educateurResult, gedResult] = await Promise.allSettled([
    sendPriceInquiryToEducateur(inquiryData),
    sendPriceInquiryAlertGED(inquiryData),
  ]);

  // Lot L3/6 : support des 2 formes d'échec possibles :
  //  - rejected (legacy — throw dans sendXxx ou mock.mockRejectedValue)
  //  - fulfilled { sent: false } (nouveau EmailResult depuis lot L2/6)
  // NB : on NE remplace PAS l'auditLog inline par logEmailFailure ici —
  // la logique dual-severity (high si les 2 KO, medium si 1 seul) et les
  // métadonnées actor/IP/error dépassent le contrat simple du helper.
  // logEmailFailure reste utilisé pour les callsites single-email uniformes.
  const educateurKo =
    educateurResult.status === 'rejected' ||
    (educateurResult.status === 'fulfilled' && !educateurResult.value.sent);
  const gedKo =
    gedResult.status === 'rejected' ||
    (gedResult.status === 'fulfilled' && !gedResult.value.sent);

  if (educateurKo) {
    const reason =
      educateurResult.status === 'rejected'
        ? educateurResult.reason
        : `reason:${(educateurResult.value as { reason?: string }).reason ?? 'unknown'}`;
    console.error('[price-inquiry] Email éducateur échoué:', reason);
  }
  if (gedKo) {
    const reason =
      gedResult.status === 'rejected'
        ? gedResult.reason
        : `reason:${(gedResult.value as { reason?: string }).reason ?? 'unknown'}`;
    console.error('[price-inquiry] Email GED échoué:', reason);
  }

  // Fix #5 — Si un email échoue, on NE bloque PAS l'utilisateur :
  // le lead est persisté, la GED peut relancer manuellement.
  // auditLog pour alerting ops (surveillance taux d'échec Resend).
  if (educateurKo || gedKo) {
    await auditLog(supabase, {
      action: 'update',
      resourceType: 'inscription',
      resourceId: leadId,
      actorType: 'system',
      actorId: email,
      ipAddress: ip,
      metadata: {
        event: 'email_failed',
        severity: educateurKo && gedKo ? 'high' : 'medium',
        educateur_email_status: educateurKo ? 'failed' : 'sent',
        ged_email_status: gedKo ? 'failed' : 'sent',
        educateur_error: educateurKo
          ? educateurResult.status === 'rejected'
            ? String(educateurResult.reason).slice(0, 500)
            : `reason:${(educateurResult.value as { reason?: string }).reason ?? 'unknown'}`
          : null,
        ged_error: gedKo
          ? gedResult.status === 'rejected'
            ? String(gedResult.reason).slice(0, 500)
            : `reason:${(gedResult.value as { reason?: string }).reason ?? 'unknown'}`
          : null,
      },
    });
  }

  // Succès utilisateur même si les 2 emails ont échoué — le lead est en base,
  // la GED a visibilité via le dashboard + alertes auditLog.
  return NextResponse.json({ ok: true });
}
