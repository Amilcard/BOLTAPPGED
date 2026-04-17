// lib/structure-guard.ts
import { NextRequest, NextResponse } from 'next/server';
import { resolveCodeToStructure, type ResolvedAccess, type StructureRole } from '@/lib/structure';

export type GuardResult =
  | { ok: true; resolved: ResolvedAccess }
  | { ok: false; response: NextResponse };

interface RequireStructureRoleOptions {
  /** Rôles explicitement autorisés (inclusion). Exclusif avec `excludeRoles`. */
  allowRoles?: readonly StructureRole[];
  /** Rôles explicitement refusés (exclusion). Exclusif avec `allowRoles`. */
  excludeRoles?: readonly StructureRole[];
  /** Message d'erreur personnalisé pour la 403. */
  forbiddenMessage?: string;
}

/**
 * Guard réutilisable pour les routes /api/structure/[code]/*.
 * Vérifie le code structure, résout le rôle, et applique une whitelist/blacklist de rôles.
 *
 * - allowRoles : autoriser uniquement ces rôles (ex: ['direction'])
 * - excludeRoles : autoriser tout sauf ces rôles (ex: ['secretariat'])
 * - Exactement une des deux options doit être fournie.
 *
 * Usage :
 *   const guard = await requireStructureRole(req, code, { allowRoles: ['direction'] });
 *   if (!guard.ok) return guard.response;
 *   const resolved = guard.resolved; // ResolvedAccess dispo
 */
export async function requireStructureRole(
  _req: NextRequest,
  code: string,
  options: RequireStructureRoleOptions,
): Promise<GuardResult> {
  const { allowRoles, excludeRoles, forbiddenMessage } = options;

  if ((!allowRoles && !excludeRoles) || (allowRoles && excludeRoles)) {
    throw new Error('requireStructureRole: fournir exactement allowRoles OU excludeRoles');
  }

  if (!code) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: 'INVALID_CODE', message: 'Code structure requis.' } },
        { status: 400 }
      ),
    };
  }

  const resolved = await resolveCodeToStructure(code);
  if (!resolved) {
    // Iso-comportement avec les 13 routes préexistantes : 403 pour code invalide.
    // Le 401 serait sémantiquement plus correct mais casserait la compat des tests + front.
    // À reconsidérer dans un commit dédié (changement breaking côté API).
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: 'INVALID_CODE', message: 'Code invalide, expiré ou révoqué.' } },
        { status: 403 }
      ),
    };
  }

  const role = resolved.role;
  const authorized = allowRoles
    ? allowRoles.includes(role)
    : !excludeRoles!.includes(role);

  if (!authorized) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: forbiddenMessage ?? 'Accès non autorisé pour ce rôle.',
          },
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true, resolved };
}
