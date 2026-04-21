import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendProAccessConfirmation, sendProAccessAlertGED } from '@/lib/email';
import { logEmailFailure } from '@/lib/email-logger';

const MAX_REQUESTS = 2;
const WINDOW_MINUTES = 60;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function isRateLimited(email: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
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
    // fail-closed : previent spam email si DB inaccessible
    return true;
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
      { status: 429, headers: { 'Retry-After': String(WINDOW_MINUTES * 60) } }
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

  // Lot L3/6 — BONUS pattern price-inquiry (commit e0cad66) :
  // INSERT lead AVANT emails. Source of truth persistante = la GED peut
  // toujours relancer manuellement si Resend échoue. Fail-silently si
  // l'INSERT échoue (lead perdu = dégradation acceptable, route historique).
  const supabase = getSupabaseAdmin();
  let leadId: string | null = null;
  try {
    const { data: inserted } = await supabase
      .from('smart_form_submissions')
      .insert({
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
      })
      .select('id')
      .single();
    leadId = (inserted as { id: string } | null)?.id ?? null;
  } catch {
    // fail-silently (compat legacy — pas de régression HTTP)
  }

  // Emails — vérifier que l'alerte GED arrive (pattern price-inquiry)
  const [confirmResult, alertResult] = await Promise.allSettled([
    sendProAccessConfirmation(accessData),
    sendProAccessAlertGED(accessData),
  ]);

  // Résolution des 2 retours possibles : rejected (legacy throw) OU
  // fulfilled avec { sent: false } (nouveau pattern EmailResult).
  const confirmSent = confirmResult.status === 'fulfilled' && confirmResult.value.sent;
  const alertSent = alertResult.status === 'fulfilled' && alertResult.value.sent;

  // Logging centralisé via logEmailFailure — pas de PII, reason enum fermé.
  // resourceId = leadId si insert OK, sinon undefined (fallback helper='system').
  if (!confirmSent) {
    if (confirmResult.status === 'fulfilled' && !confirmResult.value.sent) {
      await logEmailFailure('pro_access_confirmation', confirmResult.value, 'pro_access_request', leadId ?? undefined);
    } else if (confirmResult.status === 'rejected') {
      console.error('[request-access] Email confirmation échoué:', confirmResult.reason);
      await logEmailFailure(
        'pro_access_confirmation',
        { sent: false, reason: 'provider_error' },
        'pro_access_request',
        leadId ?? undefined
      );
    }
  }
  if (!alertSent) {
    if (alertResult.status === 'fulfilled' && !alertResult.value.sent) {
      await logEmailFailure('pro_access_alert_ged', alertResult.value, 'pro_access_request', leadId ?? undefined);
    } else if (alertResult.status === 'rejected') {
      console.error('[request-access] Email alerte GED échoué:', alertResult.reason);
      await logEmailFailure(
        'pro_access_alert_ged',
        { sent: false, reason: 'provider_error' },
        'pro_access_request',
        leadId ?? undefined
      );
    }
  }

  // Si les 2 emails ont échoué, l'utilisateur voit 500 (comme avant) —
  // sinon 200. Comportement HTTP inchangé vs pré-L3.
  if (!confirmSent && !alertSent) {
    return NextResponse.json(
      { error: { code: 'EMAIL_ERROR', message: 'Erreur lors de l\'envoi. Veuillez réessayer ou nous contacter directement.' } },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
