import { getSupabaseAdmin } from '@/lib/supabase-server';
import { UUID_RE } from '@/lib/validators';
import { assertAuthUser } from '@/lib/supabase-guards';
import { auditLog } from '@/lib/audit-log';

/**
 * Shared mutation helpers for admin users.
 * Partagés entre :
 *   - PUT /api/admin/users/[id] (legacy, conservé)
 *   - DELETE /api/admin/users/[id] (legacy, conservé)
 *   - POST /api/admin/users (create)
 *   - POST /api/admin/users/update (body-based, anti-SSRF préemptif)
 *   - POST /api/admin/users/delete (body-based, anti-SSRF préemptif)
 *
 * Pattern cohérent avec commits bf4e8f4, 07261f2, c087698.
 * Aucun NextRequest/NextResponse ici — la logique HTTP reste dans les routes.
 *
 * Auth (requireAdmin) reste responsabilité de chaque route appelante.
 * L'acteur (email + éventuellement userId) est passé en paramètre pour
 * traçabilité auditLog (règle #15 CLAUDE.md — RGPD).
 *
 * Anti-PII metadata : les entrées auditLog ne contiennent JAMAIS la
 * valeur brute du password ni de l'email (booléens *_changed seulement).
 * actor_id = email de l'admin qui a agi (identification CNIL).
 */

const ALLOWED_ROLES = ['ADMIN', 'EDITOR', 'VIEWER'] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

type AdminUserRow = {
  id: string;
  email: string | undefined;
  role: string;
  createdAt: string;
};

function normalizeUser(user: {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  created_at: string;
}): AdminUserRow {
  return {
    id: user.id,
    email: user.email,
    role: (user.app_metadata?.role as string) || 'VIEWER',
    createdAt: user.created_at,
  };
}

export interface CreateUserFields {
  email?: string;
  password?: string;
  role?: string;
}

export interface CreateUserOk {
  data: AdminUserRow;
  status: 201;
  error?: undefined;
}

export interface CreateUserErr {
  data?: undefined;
  error: string;
  status: number;
}

export type CreateUserResult = CreateUserOk | CreateUserErr;

export async function runCreateUser(
  fields: CreateUserFields,
  actorEmail: string,
): Promise<CreateUserResult> {
  const { email, password, role } = fields ?? {};

  if (!email || !password || !role) {
    return { error: 'email, password et role requis', status: 400 };
  }
  if (!ALLOWED_ROLES.includes(role as AllowedRole)) {
    return { error: 'Rôle invalide', status: 400 };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      app_metadata: { role },
      email_confirm: true,
    });
    if (error) throw error;

    const user = assertAuthUser(data, 'admin_create_user', 'insert');
    const row = normalizeUser(user);

    await auditLog(supabase, {
      action: 'create',
      resourceType: 'admin_user',
      resourceId: row.id,
      actorType: 'admin',
      actorId: actorEmail,
      metadata: {
        role: row.role,
        has_email_set: true,
        has_password_set: true,
      },
    });

    return { data: row, status: 201 };
  } catch (err) {
    console.error('runCreateUser error:', err);
    return { error: 'Erreur serveur', status: 500 };
  }
}

export interface UpdateUserFields {
  email?: string;
  role?: string;
  password?: string;
}

export interface UpdateUserOk {
  data: AdminUserRow;
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
  fields: UpdateUserFields,
  actorEmail: string,
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

    const user = assertAuthUser(data, 'admin_update_user', 'update');
    const row = normalizeUser(user);

    await auditLog(supabase, {
      action: 'update',
      resourceType: 'admin_user',
      resourceId: id,
      actorType: 'admin',
      actorId: actorEmail,
      metadata: {
        email_changed: Boolean(email),
        role_changed: Boolean(role),
        password_changed: Boolean(password),
        ...(role ? { new_role: role } : {}),
      },
    });

    return { data: row };
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
  actorUserId: string,
  actorEmail: string,
): Promise<DeleteUserResult> {
  if (!UUID_RE.test(id)) {
    return { error: 'ID invalide', status: 400 };
  }

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

    await auditLog(supabase, {
      action: 'delete',
      resourceType: 'admin_user',
      resourceId: id,
      actorType: 'admin',
      actorId: actorEmail,
    });

    return { success: true };
  } catch (err) {
    console.error('runDeleteUser error:', err);
    return { error: 'Erreur serveur', status: 500 };
  }
}
