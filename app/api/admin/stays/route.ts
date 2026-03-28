import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';


// GET all stays from Supabase (source de vérité)
export async function GET(request: NextRequest) {
  const auth = verifyAuth(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non autorisé' } },
      { status: 401 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('gd_stays')
      .select('*')
      .order('title');

    if (error) throw error;

    // Mapper snake_case → camelCase pour compatibilité avec le front admin
    const stays = (data || []).map((s: Record<string, unknown>) => ({
      id: s.slug, // slug comme identifiant unique
      slug: s.slug,
      title: (s.marketing_title as string) || (s.title as string),
      descriptionShort: s.description_short || '',
      programme: s.programme || [],
      geography: s.location_region || '',
      accommodation: s.accommodation || '',
      supervision: s.supervision || '',
      priceFrom: s.price_from || 0,
      durationDays: s.duration_days || 7,
      period: s.period || 'ete',
      ageMin: s.age_min || 6,
      ageMax: s.age_max || 17,
      themes: [],
      imageCover: s.image_cover || '',
      published: s.published ?? false,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    return NextResponse.json(stays);
  } catch (error) {
    console.error('GET /api/admin/stays error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
