import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendPriceInquiryToEducateur, sendPriceInquiryAlertGED } from '@/lib/email';

export const dynamic = 'force-dynamic';

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MIN = 30;

async function checkRateLimitWithoutIncrement(email: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const key = `priceiq:${email}`;
    const now = new Date();
    const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MIN * 60 * 1000);

    const { data: entry } = await supabase
      .from('gd_login_attempts')
      .select('attempt_count, window_start')
      .eq('ip', key)
      .single();

    if (!entry || new Date(entry.window_start) < windowStart) return false;
    return entry.attempt_count >= RATE_LIMIT_MAX;
  } catch {
    return false;
  }
}

async function incrementRateLimit(email: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const key = `priceiq:${email}`;
    const now = new Date();
    const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MIN * 60 * 1000);

    const { data: entry } = await supabase
      .from('gd_login_attempts')
      .select('attempt_count, window_start')
      .eq('ip', key)
      .single();

    if (!entry || new Date(entry.window_start) < windowStart) {
      await supabase
        .from('gd_login_attempts')
        .upsert(
          { ip: key, attempt_count: 1, window_start: now.toISOString() },
          { onConflict: 'ip' }
        );
    } else {
      await supabase
        .from('gd_login_attempts')
        .update({ attempt_count: entry.attempt_count + 1 })
        .eq('ip', key);
    }
  } catch {
    // fail-silently — l'email a été envoyé, le rate-limit est secondaire
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const { prenom, structureName, email, sejourSlug } = body as Record<string, unknown>;

  // Validation
  if (!prenom || !structureName || !email || !sejourSlug) {
    return NextResponse.json(
      { error: 'Champs requis manquants : prenom, structureName, email, sejourSlug' },
      { status: 400 }
    );
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Format email invalide' }, { status: 400 });
  }

  // Rate limiting — vérifier AVANT, incrémenter APRÈS succès email
  const rateLimitEmail = (email as string).toLowerCase().trim();
  const isLimited = await checkRateLimitWithoutIncrement(rateLimitEmail);
  if (isLimited) {
    return NextResponse.json(
      { error: 'Trop de demandes. Réessayez dans 30 minutes.' },
      { status: 429 }
    );
  }

  // Récupérer le séjour
  const supabase = getSupabaseAdmin();
  const { data: sejour, error: sejourError } = await supabase
    .from('gd_stays')
    .select('title, marketing_title, price_from')
    .eq('slug', sejourSlug as string)
    .eq('published', true)
    .single();

  if (sejourError || !sejour) {
    return NextResponse.json({ error: 'Séjour introuvable' }, { status: 404 });
  }

  const sejourTitle = (sejour as { title: string; marketing_title?: string | null; price_from?: number | null }).marketing_title
    || (sejour as { title: string }).title;
  const prixFrom = (sejour as { price_from?: number | null }).price_from ?? null;

  const inquiryData = {
    prenom: prenom as string,
    structureName: structureName as string,
    email: email as string,
    sejourTitle,
    sejourSlug: sejourSlug as string,
    prixFrom,
  };

  // Envoyer les deux emails (fail-partial accepté)
  const [educateurResult, gedResult] = await Promise.allSettled([
    sendPriceInquiryToEducateur(inquiryData),
    sendPriceInquiryAlertGED(inquiryData),
  ]);

  if (educateurResult.status === 'rejected' && gedResult.status === 'rejected') {
    console.error('[price-inquiry] Échec total emails:', educateurResult.reason, gedResult.reason);
    return NextResponse.json({ error: 'Erreur envoi email' }, { status: 500 });
  }

  if (educateurResult.status === 'rejected') {
    console.error('[price-inquiry] Email éducateur échoué:', educateurResult.reason);
  }
  if (gedResult.status === 'rejected') {
    console.error('[price-inquiry] Email GED échoué:', gedResult.reason);
  }

  // Incrémenter rate-limit seulement après succès email (au moins un envoyé)
  await incrementRateLimit(rateLimitEmail);

  // Sauvegarder le lead dans smart_form_submissions (fail-silently)
  try {
    await supabase.from('smart_form_submissions').insert({
      contact_email: email as string,
      referent_organization: structureName as string,
      suggested_stays: [{ slug: sejourSlug, title: sejourTitle }],
      submitted_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[price-inquiry] Sauvegarde lead échouée (non-bloquant):', err);
  }

  return NextResponse.json({ ok: true });
}
