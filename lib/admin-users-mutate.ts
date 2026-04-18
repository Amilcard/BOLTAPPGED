import { getSupabaseAdmin } from '@/lib/supabase-server';
import { UUID_RE } from '@/lib/validators';

/**
 * Shared mutation helpers for admin users.
 * Partagés entre :
 *   - PUT /api/admin/users/[id] (legacy, conservé)
 *   - DELETE /api/admin/users/[id] (legacy, conservé)
 *   - POST /api/admin/users/update (body-based, anti-SSRF préemptif)
 *   - POST /api/admin/users/delete (body-based, anti-SSRF préemptif)
 *
 * Pattern cohérent avec commits bf4e8f4, 07261f2, c087698.
 * Aucun NextRequest/NextResponse ici — la logique HTTP reste dans les routes.
 *
 * Auth (requireAdmin) reste responsabilité de chaque route appelante.
 */

const ALLOWED_ROLES = ['ADMIN', 'EDITOR', 'VIEWER'] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

export interface UpdateUserFields {
  email?: string;
  role?: string;
  password?: string;
}

export interface UpdateUserOk {
  data: {
    id: string;
    email: string | undefined;
    role: string;
    createdAt: string;
  };
  error?: undefined;
  status?: undefined;
}

export interface UpdateUserErr {
  data?: undefined;
  error: string;
  status: number;
}

export type UpdateUserResult = UpdateUserOk | UpdateUserErr;

export async function runUpdateUser(
  id: string,
  fields: UpdateUserFields
): Promise<UpdateUserResult> {
  if (!UUID_RE.test(id)) {
    return { error: 'ID invalide', status: 400 };
  }

  const { email, role, password } = fields ?? {};

  if (role !== undefined && !ALLOWED_ROLES.includes(role as AllowedRole)) {
    return { error: 'Rôle invalide', status: 400 };
  }

  try {
    const supabase = getSupabaseAdmin();
    const updates: Record<string, unknown> = {};
    if (email) updates.email = email;
    if (password) updates.password = password;
    if (role) updates.app_metadata = { role };

    const { data, error } = await supabase.auth.admin.updateUserById(id, updates);
    if (error) throw error;

    return {
      data: {
        id: data.user.id,
        email: data.user.email,
        role: (data.user.app_metadata?.role as string) || 'VIEWER',
        createdAt: data.user.created_at,
      },
    };
  } catch (err) {
    console.error('runUpdateUser error:', err);
    return { error: 'Erreur serveur', status: 500 };
  }
}

export interface DeleteUserOk {
  success: true;
  error?: undefined;
  status?: undefined;
}

export interface DeleteUserErr {
  success?: undefined;
  error: string;
  status: number;
}

export type DeleteUserResult = DeleteUserOk | DeleteUserErr;

export async function runDeleteUser(
  id: string,
  actorUserId: string
): Promise<DeleteUserResult> {
  if (!UUID_RE.test(id)) {
    return { error: 'ID invalide', status: 400 };
  }

  // Anti self-delete : un admin ne peut pas supprimer son propre compte
  if (id === actorUserId) {
    return {
      error: 'Impossible de supprimer votre propre compte.',
      status: 400,
    };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('runDeleteUser error:', err);
    return { error: 'Erreur serveur', status: 500 };
  }
}
