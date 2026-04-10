import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { sendProAccessConfirmation, sendProAccessAlertGED } from '@/lib/email';

const MAX_REQUESTS = 2;
const WINDOW_MINUTES = 60;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function isRateLimited(email: string): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const key = `access_req:${email}`;
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000);

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
      return false;
    }

    if (entry.attempt_count >= MAX_REQUESTS) {
      return true;
    }

    await supabase
      .from('gd_login_attempts')
      .update({ attempt_count: entry.attempt_count + 1 })
      .eq('ip', key);

    return false;
  } catch {
    // fail-open : ne pas bloquer si erreur rate limiting
    return false;
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Corps de requête invalide.' } },
      { status: 400 }
    );
  }

  const {
    prenom,
    nom,
    structureName,
    structureType,
    email,
    phone,
    sejour_slug,
  } = body as Record<string, string | undefined>;

  // Validation
  if (!prenom?.trim() || !nom?.trim() || !structureName?.trim() || !structureType?.trim() || !email?.trim()) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Les champs prénom, nom, structure, type et email sont requis.' } },
      { status: 400 }
    );
  }

  if (!isValidEmail(email.trim())) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Adresse email invalide.' } },
      { status: 400 }
    );
  }

  const validTypes = ['ASE', 'MECS', 'Foyer', 'Association', 'CCAS', 'Autre'];
  if (!validTypes.includes(structureType.trim())) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Type de structure invalide.' } },
      { status: 400 }
    );
  }

  // Rate limiting
  const limited = await isRateLimited(email.trim().toLowerCase());
  if (limited) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Trop de demandes. Veuillez réessayer dans une heure ou nous contacter directement.' } },
      { status: 429 }
    );
  }

  const accessData = {
    prenom: prenom.trim(),
    nom: nom.trim(),
    structureName: structureName.trim(),
    structureType: structureType.trim(),
    email: email.trim().toLowerCase(),
    phone: phone?.trim() || undefined,
    sejourSlug: sejour_slug?.trim() || undefined,
  };

  // Emails (non-bloquants — on répond même si un email échoue)
  await Promise.allSettled([
    sendProAccessConfirmation(accessData),
    sendProAccessAlertGED(accessData),
  ]);

  // Enregistrement dans smart_form_submissions (fail-silently)
  try {
    const supabase = getSupabase();
    await supabase.from('smart_form_submissions').insert({
      form_type: 'pro_access_request',
      data: {
        prenom: accessData.prenom,
        nom: accessData.nom,
        structureName: accessData.structureName,
        structureType: accessData.structureType,
        email: accessData.email,
        phone: accessData.phone ?? null,
        sejour_slug: accessData.sejourSlug ?? null,
      },
    });
  } catch {
    // fail-silently
  }

  return NextResponse.json({ ok: true });
}
