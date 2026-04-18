/**
 * Vérification d'ownership par suivi_token — centralisé.
 * Inclut la vérification d'expiration RGPD (P0.1).
 *
 * Utilisé par : suivi/[token], dossier-enfant/[id], dossier-enfant/[id]/upload, dossier-enfant/[id]/submit
 */

import { UUID_RE } from '@/lib/validators';

type OwnershipOk = { ok: true; referentEmail: string };
type OwnershipFail = { ok: false; code: string; message: string; status: number };
type OwnershipResult = OwnershipOk | OwnershipFail;

/**
 * Vérifie qu'un suivi_token est valide, non expiré, et appartient au même
 * référent que l'inscription ciblée.
 *
 * @param renew Si true, prolonge l'expiration de 30 jours à chaque accès valide.
 */
export async function verifyOwnership(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  token: string,
  inscriptionId: string,
  options?: { renew?: boolean }
): Promise<OwnershipResult> {
  if (!UUID_RE.test(token)) {
    return { ok: false, code: 'INVALID_TOKEN', message: 'Token invalide.', status: 400 };
  }
  if (!UUID_RE.test(inscriptionId)) {
    return { ok: false, code: 'INVALID_ID', message: 'ID inscription invalide.', status: 400 };
  }

  // 1. Trouver l'inscription source par suivi_token
  const { data: sourceRaw } = await supabase
    .from('gd_inscriptions')
    .select('referent_email, suivi_token_expires_at')
    .eq('suivi_token', token)
    .is('deleted_at', null)
    .single();

  const source = sourceRaw as {
    referent_email: string;
    suivi_token_expires_at: string | null;
  } | null;

  if (!source) {
    return { ok: false, code: 'NOT_FOUND', message: 'Lien de suivi invalide ou expiré.', status: 404 };
  }

  // 2. Vérifier l'expiration du token (RGPD P0.1)
  if (source.suivi_token_expires_at) {
    const expiresAt = new Date(source.suivi_token_expires_at);
    if (expiresAt < new Date()) {
      return {
        ok: false,
        code: 'TOKEN_EXPIRED',
        message: 'Ce lien de suivi a expiré. Veuillez contacter votre référent pour obtenir un nouveau lien.',
        status: 403,
      };
    }
  }

  // 3. Vérifier que l'inscription ciblée appartient au même référent
  const { data: targetRaw } = await supabase
    .from('gd_inscriptions')
    .select('referent_email')
    .eq('id', inscriptionId)
    .is('deleted_at', null)
    .single();

  const target = targetRaw as { referent_email: string } | null;

  if (!target || target.referent_email !== source.referent_email) {
    return { ok: false, code: 'FORBIDDEN', message: 'Accès non autorisé.', status: 403 };
  }

  // 4. Renouveler l'expiration si demandé (sliding window)
  if (options?.renew) {
    await supabase
      .from('gd_inscriptions')
      .update({ suivi_token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
      .eq('suivi_token', token);
  }

  return { ok: true, referentEmail: source.referent_email };
}

/**
 * Vérifie uniquement qu'un suivi_token est valide et non expiré (sans vérifier une inscription cible).
 * Utilisé par GET /api/suivi/[token] qui n'a pas d'inscriptionId en paramètre.
 */
export async function verifyToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  token: string,
  options?: { renew?: boolean }
): Promise<
  { ok: true; referentEmail: string; organisation?: string }
  | { ok: false; code: string; message: string; status: number }
> {
  if (!UUID_RE.test(token)) {
    return { ok: false, code: 'INVALID_TOKEN', message: 'Lien de suivi invalide.', status: 400 };
  }

  const { data: sourceRaw, error: sourceErr } = await supabase
    .from('gd_inscriptions')
    .select('referent_email, organisation, suivi_token_expires_at')
    .eq('suivi_token', token)
    .is('deleted_at', null)
    .single();

  const source = sourceRaw as {
    referent_email: string;
    organisation?: string;
    suivi_token_expires_at: string | null;
  } | null;

  if (sourceErr || !source) {
    return { ok: false, code: 'NOT_FOUND', message: 'Dossier non trouvé. Ce lien est peut-être expiré ou invalide.', status: 404 };
  }

  // Vérifier l'expiration
  if (source.suivi_token_expires_at) {
    const expiresAt = new Date(source.suivi_token_expires_at);
    if (expiresAt < new Date()) {
      return {
        ok: false,
        code: 'TOKEN_EXPIRED',
        message: 'Ce lien de suivi a expiré. Veuillez contacter votre référent pour obtenir un nouveau lien.',
        status: 403,
      };
    }
  }

  // Renouveler si demandé
  if (options?.renew) {
    await supabase
      .from('gd_inscriptions')
      .update({ suivi_token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
      .eq('suivi_token', token);
  }

  return { ok: true, referentEmail: source.referent_email, organisation: source.organisation };
}
