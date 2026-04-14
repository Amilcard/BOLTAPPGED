import { NextRequest, NextResponse } from 'next/server';
import { requireEditor, requireAdmin } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
// PUT update stay fields
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEditor(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non autorisé' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params; // id = slug dans Supabase
    const body = await request.json();

    const supabase = getSupabaseAdmin();
    const updateData: Record<string, unknown> = {};

    // Whitelist des champs modifiables (pas de mass-assignment)
    if (body.published !== undefined) updateData.published = body.published;
    if (body.title !== undefined) { updateData.title = body.title; updateData.marketing_title = body.title; }
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
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Aucun champ à mettre à jour' } },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('gd_stays')
      .update(updateData)
      .eq('slug', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('PUT /api/admin/stays/[id] error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}

// DELETE stay
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non autorisé — ADMIN requis pour suppression' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('gd_stays')
      .delete()
      .eq('slug', id);

    if (error) {
      if ((error as { code?: string }).code === '23503') {
        return NextResponse.json(
          { error: { code: 'FK_VIOLATION', message: 'Ce séjour a des inscriptions actives. Annulez-les avant de supprimer le séjour.' } },
          { status: 409 }
        );
      }
      throw error;
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/admin/stays/[id] error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
