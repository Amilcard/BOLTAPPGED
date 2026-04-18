import { getSupabaseAdmin } from '@/lib/supabase-server';

/**
 * Shared mutation helpers for admin stays.
 * Partagés entre :
 *   - PUT /api/admin/stays/[id]     (legacy, conservé)
 *   - DELETE /api/admin/stays/[id]  (legacy, conservé)
 *   - PATCH /api/admin/stays/update (body-based, anti-SSRF préemptif)
 *   - POST  /api/admin/stays/delete (body-based, anti-SSRF préemptif)
 *
 * Pattern cohérent avec lib/admin-users-mutate.ts.
 * Aucun NextRequest/NextResponse ici — la logique HTTP reste dans les routes.
 *
 * Auth (requireEditor pour update, requireAdmin pour delete)
 * reste responsabilité de chaque route appelante.
 *
 * Identifiant = slug Supabase (pas UUID).
 */

// Slug admissible : 1 à 100 chars alphanum + tirets, commence par alphanum.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,99}$/i;

export interface UpdateStayOk {
  data: unknown;
  error?: undefined;
  code?: undefined;
  status?: undefined;
}

export interface UpdateStayErr {
  data?: undefined;
  error: string;
  code?: string;
  status: number;
}

export type UpdateStayResult = UpdateStayOk | UpdateStayErr;

export async function runUpdateStay(
  slug: string,
  body: Record<string, unknown>
): Promise<UpdateStayResult> {
  if (!slug || !SLUG_RE.test(slug)) {
    return { error: 'Slug invalide', code: 'VALIDATION_ERROR', status: 400 };
  }

  try {
    const supabase = getSupabaseAdmin();
    const updateData: Record<string, unknown> = {};

    // Whitelist des champs modifiables (pas de mass-assignment) — 12 champs.
    // Préserve le mapping title → marketing_title (legacy).
    if (body.published !== undefined) updateData.published = body.published;
    if (body.title !== undefined) {
      updateData.title = body.title;
      updateData.marketing_title = body.title;
    }
    if (body.descriptionShort !== undefined) updateData.description_short = body.descriptionShort;
    if (body.programme !== undefined) updateData.programme = Array.isArray(body.programme) ? body.programme : null;
    if (body.geography !== undefined) updateData.location_region = body.geography;
    if (body.accommodation !== undefined) updateData.accommodation = body.accommodation;
    if (body.supervision !== undefined) updateData.supervision = body.supervision;
    if (body.priceFrom !== undefined) updateData.price_from = body.priceFrom;
    if (body.durationDays !== undefined) updateData.duration_days = body.durationDays;
    if (body.period !== undefined) updateData.period = body.period;
    if (body.ageMin !== undefined) updateData.age_min = body.ageMin;
    if (body.ageMax !== undefined) updateData.age_max = body.ageMax;
    if (body.imageCover !== undefined) updateData.image_cover = body.imageCover;

    if (Object.keys(updateData).length === 0) {
      return { error: 'Aucun champ à mettre à jour', code: 'VALIDATION_ERROR', status: 400 };
    }

    const { data, error } = await supabase
      .from('gd_stays')
      .update(updateData)
      .eq('slug', slug)
      .select()
      .single();

    if (error) throw error;
    return { data };
  } catch (err) {
    console.error('runUpdateStay error:', err);
    return { error: 'Erreur serveur', code: 'INTERNAL_ERROR', status: 500 };
  }
}

export interface DeleteStayOk {
  success: true;
  error?: undefined;
  code?: undefined;
  status?: undefined;
}

export interface DeleteStayErr {
  success?: undefined;
  error: string;
  code?: string;
  status: number;
}

export type DeleteStayResult = DeleteStayOk | DeleteStayErr;

export async function runDeleteStay(slug: string): Promise<DeleteStayResult> {
  if (!slug || !SLUG_RE.test(slug)) {
    return { error: 'Slug invalide', code: 'VALIDATION_ERROR', status: 400 };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('gd_stays')
      .delete()
      .eq('slug', slug);

    if (error) {
      if ((error as { code?: string }).code === '23503') {
        return {
          error: 'Séjour référencé par des sessions, inscriptions ou souhaits. Annulez-les avant de supprimer.',
          code: '23503',
          status: 409,
        };
      }
      throw error;
    }
    return { success: true };
  } catch (err) {
    console.error('runDeleteStay error:', err);
    return { error: 'Erreur serveur', code: 'INTERNAL_ERROR', status: 500 };
  }
}
