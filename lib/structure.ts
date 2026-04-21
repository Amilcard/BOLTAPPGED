import { getSupabaseAdmin } from '@/lib/supabase-server';

/**
 * Rôles structure — résolu depuis gd_structure_access_codes (priorité)
 * avec fallback longueur du code (rétrocompat).
 */
export type StructureRole = 'direction' | 'cds' | 'cds_delegated' | 'secretariat' | 'educateur';

export interface ResolvedAccess {
  structure: Record<string, unknown>;
  role: StructureRole;
  roles: string[];
  email: string | null;
  prenom: string | null;
  nom: string | null;
}

export async function resolveCodeToStructure(
  code: string
): Promise<ResolvedAccess | null> {
  const supabase = getSupabaseAdmin();
  const codeNorm = code.toUpperCase();
  const now = new Date().toISOString();

  // ── Priorité 1 : lookup dans gd_structure_access_codes ──
  const { data: accessCode } = await supabase
    .from('gd_structure_access_codes')
    .select('id, structure_id, role, roles, email, prenom, nom, expires_at')
    .eq('code', codeNorm)
    .eq('active', true)
    .single();

  if (accessCode) {
    // Vérifier expiration
    if (accessCode.expires_at && accessCode.expires_at < now) return null;

    // Charger la structure
    const { data: structure } = await supabase
      .from('gd_structures')
      .select('id, name, city, postal_code, type, email, code, rgpd_accepted_at, delegation_active_from, delegation_active_until, delegated_to_email')
      .eq('id', accessCode.structure_id)
      .eq('status', 'active')
      .single();

    if (!structure) return null;

    // Runtime guard — rejeter les rôles inconnus (sécurité)
    const VALID_ROLES: StructureRole[] = ['direction', 'cds', 'cds_delegated', 'secretariat', 'educateur'];
    const resolvedRole = accessCode.role as string;
    if (!VALID_ROLES.includes(resolvedRole as StructureRole)) {
      console.error(`[structure] Rôle inconnu dans gd_structure_access_codes: ${resolvedRole}`);
      return null;
    }

    return {
      structure,
      role: resolvedRole as StructureRole,
      roles: accessCode.roles || [resolvedRole],
      email: accessCode.email,
      prenom: accessCode.prenom,
      nom: accessCode.nom,
    };
  }

  // ── Fallback : logique longueur du code (rétrocompat anciens codes) ──

  // Code CDS (6 chars)
  if (codeNorm.length === 6) {
    const { data } = await supabase
      .from('gd_structures')
      .select('id, name, city, postal_code, type, email, code, code_expires_at, code_revoked_at, rgpd_accepted_at, delegation_active_from, delegation_active_until, delegated_to_email')
      .eq('code', codeNorm)
      .eq('status', 'active')
      .single();

    if (!data) return null;
    if (data.code_revoked_at) return null;
    if (data.code_expires_at && data.code_expires_at < now) return null;

    // U2 fix (2026-04-21) — guard migration restreint à role='direction'.
    // Historique : le check initial `count active > 0` se déclenchait dès
    // la 1re invitation (secrétariat/éducateur) et bloquait le CDS/direction
    // legacy — cassait l'usage Thanh (invite secrétariat → ne peut plus se
    // reconnecter). Seul la présence d'une entrée 'direction' migrée
    // (compte email+password actif) justifie de désactiver le code legacy.
    const { count: migratedDirectionCount } = await supabase
      .from('gd_structure_access_codes')
      .select('id', { count: 'exact', head: true })
      .eq('structure_id', data.id)
      .eq('role', 'direction')
      .eq('active', true);

    if (migratedDirectionCount && migratedDirectionCount > 0) {
      // Direction migrée : le code CDS legacy ne doit plus donner accès
      // (cohérence hiérarchique : si direction a basculé sur compte email+
      // password, la structure entière passe au mode migré).
      return null;
    }

    return {
      structure: data,
      role: 'cds',
      roles: ['cds', 'secretariat', 'educateur'],
      email: null,
      prenom: null,
      nom: null,
    };
  }

  // Code Directeur (10 chars)
  if (codeNorm.length === 10) {
    const { data } = await supabase
      .from('gd_structures')
      .select('id, name, city, postal_code, type, email, code, code_directeur_expires_at, code_directeur_revoked_at, rgpd_accepted_at, delegation_active_from, delegation_active_until, delegated_to_email')
      .eq('code_directeur', codeNorm)
      .eq('status', 'active')
      .single();

    if (!data) return null;
    if (data.code_directeur_revoked_at) return null;
    if (data.code_directeur_expires_at && data.code_directeur_expires_at < now) return null;

    // U2 fix (2026-04-21) — guard migration restreint à role='direction'.
    // Voir commentaire branche CDS ci-dessus : seule une entrée 'direction'
    // active (compte email+password créé) désactive le code_directeur
    // legacy. Une ligne 'secretariat' ou 'educateur' seule ne suffit pas
    // à considérer la direction comme migrée.
    const { count: migratedDirectionCount } = await supabase
      .from('gd_structure_access_codes')
      .select('id', { count: 'exact', head: true })
      .eq('structure_id', data.id)
      .eq('role', 'direction')
      .eq('active', true);

    if (migratedDirectionCount && migratedDirectionCount > 0) {
      return null;
    }

    return {
      structure: data,
      role: 'direction',
      roles: ['direction', 'cds', 'secretariat', 'educateur'],
      email: null,
      prenom: null,
      nom: null,
    };
  }

  return null;
}
