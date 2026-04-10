import { getSupabase } from '@/lib/supabase-server';

/**
 * Détecte le rôle en fonction du code fourni.
 * - 6 chars → CDS (code structure existant)
 * - 10 chars → Directeur (code_directeur)
 *
 * L'éducateur utilise le suivi_token par inscription (pas cette route).
 */
export type StructureRole = 'cds' | 'cds_delegated' | 'directeur';

export async function resolveCodeToStructure(
  code: string
): Promise<{ structure: Record<string, unknown>; role: StructureRole } | null> {
  const supabase = getSupabase();
  const codeNorm = code.toUpperCase();
  const now = new Date().toISOString();

  // Essai code CDS (6 chars)
  if (codeNorm.length === 6) {
    const { data } = await supabase
      .from('gd_structures')
      .select('id, name, city, postal_code, type, email, code, code_expires_at, code_revoked_at, rgpd_accepted_at, delegation_active_from, delegation_active_until')
      .eq('code', codeNorm)
      .eq('status', 'active')
      .single();

    if (!data) return null;

    if (data.code_revoked_at) return null;
    if (data.code_expires_at && data.code_expires_at < now) return null;

    // Délégation active ? directeur a accordé accès gestion codes au CDS
    const delegFrom = data.delegation_active_from as string | null;
    const delegUntil = data.delegation_active_until as string | null;
    const isDelegated = !!(delegFrom && delegUntil && delegFrom <= now && now <= delegUntil);

    return { structure: data, role: isDelegated ? 'cds_delegated' : 'cds' };
  }

  // Essai code Directeur (10 chars)
  if (codeNorm.length === 10) {
    const { data } = await supabase
      .from('gd_structures')
      .select('id, name, city, postal_code, type, email, code, code_directeur_expires_at, code_directeur_revoked_at, rgpd_accepted_at, delegation_active_from, delegation_active_until')
      .eq('code_directeur', codeNorm)
      .eq('status', 'active')
      .single();

    if (!data) return null;

    if (data.code_directeur_revoked_at) return null;
    if (data.code_directeur_expires_at && data.code_directeur_expires_at < now) return null;

    return { structure: data, role: 'directeur' };
  }

  return null;
}
