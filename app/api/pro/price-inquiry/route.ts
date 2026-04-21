import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendPriceInquiryToEducateur, sendPriceInquiryAlertGED } from '@/lib/email';
import { isRateLimited, getClientIpFromHeaders } from '@/lib/rate-limit';
import { errorResponse } from '@/lib/auth-middleware';
import { validateBodySize } from '@/lib/validators';

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

  // Rate limiting atomique via RPC check_rate_limit (résout race condition H4)
  const ip = getClientIpFromHeaders(request.headers);
  const rateLimitKey = `priceiq:${email}:${ip}`;
  if (await isRateLimited('priceiq', rateLimitKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MIN)) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Trop de demandes. Réessayez dans 30 minutes.' } },
      { status: 429, headers: { 'Retry-After': String(RATE_LIMIT_WINDOW_MIN * 60) } }
    );
  }

  // Récupérer le séjour
  const supabase = getSupabaseAdmin();
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

  const inquiryData = {
    prenom,
    structureName,
    email,
    sejourTitle,
    sejourSlug,
    prixFrom,
  };

  // Envoyer les deux emails (fail-partial accepté)
  const [educateurResult, gedResult] = await Promise.allSettled([
    sendPriceInquiryToEducateur(inquiryData),
    sendPriceInquiryAlertGED(inquiryData),
  ]);

  if (educateurResult.status === 'rejected' && gedResult.status === 'rejected') {
    console.error('[price-inquiry] Échec total emails:', educateurResult.reason, gedResult.reason);
    return errorResponse('EMAIL_SEND_FAILED', 'Erreur envoi email.', 500);
  }

  if (educateurResult.status === 'rejected') {
    console.error('[price-inquiry] Email éducateur échoué:', educateurResult.reason);
  }
  if (gedResult.status === 'rejected') {
    console.error('[price-inquiry] Email GED échoué:', gedResult.reason);
  }

  // Rate-limit atomique : incrément déjà fait dans isRateLimited() via RPC

  // Sauvegarder le lead dans smart_form_submissions (fail-silently)
  try {
    await supabase.from('smart_form_submissions').insert({
      contact_email: email,
      referent_organization: structureName,
      suggested_stays: [{ slug: sejourSlug, title: sejourTitle }],
      submitted_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[price-inquiry] Sauvegarde lead échouée (non-bloquant):', err);
  }

  return NextResponse.json({ ok: true });
}
