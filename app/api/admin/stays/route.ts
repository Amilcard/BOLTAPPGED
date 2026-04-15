import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
// GET all stays from Supabase (source de vérité)
export async function GET(request: NextRequest) {
  const auth = await requireEditor(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Accès réservé aux éditeurs et administrateurs.' } },
      { status: 403 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('gd_stays')
      .select('*')
      .order('title');

    if (error) throw error;

    // Compteurs waitlist par séjour
    const { data: waitlistCounts } = await supabase
      .from('gd_waitlist')
      .select('sejour_slug')
      .is('notified_at', null);

    const waitlistBySlug: Record<string, number> = Object.create(null) as Record<string, number>;
    for (const w of (waitlistCounts || []) as Array<{ sejour_slug: string }>) {
      waitlistBySlug[w.sejour_slug] = (waitlistBySlug[w.sejour_slug] || 0) + 1;
    }

    // Mapper snake_case → camelCase pour compatibilité avec le front admin
    const stays = (data || []).map((s: Record<string, unknown>) => ({
      id: s.slug, // slug comme identifiant unique
      slug: s.slug,
      title: (s.marketing_title as string) || (s.title as string),
      rawTitle: s.title as string, // Nom UFOVAL brut (pour l'admin)
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
      waitlistCount: waitlistBySlug[s.slug as string] || 0,
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

// POST create a new stay
export async function POST(request: NextRequest) {
  const auth = await requireEditor(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Accès réservé aux éditeurs et administrateurs.' } },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const title = (body.title || '').trim();
    if (!title) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Le titre est obligatoire.' } },
        { status: 400 }
      );
    }

    // Générer un slug unique à partir du titre
    const slug = title
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      || `sejour-${Date.now()}`;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('gd_stays')
      .insert({
        slug,
        title,
        marketing_title: title,
        description_short: body.descriptionShort || null,
        programme: Array.isArray(body.programme) ? body.programme : null,
        location_region: body.geography || null,
        accommodation: body.accommodation || null,
        supervision: body.supervision || null,
        price_from: body.priceFrom || null,
        duration_days: body.durationDays || null,
        period: body.period || 'ete',
        age_min: body.ageMin || null,
        age_max: body.ageMax || null,
        image_cover: body.imageCover || null,
        published: body.published ?? false,
      })
      .select()
      .single();

    if (error) {
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json(
          { error: { code: 'DUPLICATE', message: 'Un séjour avec ce titre existe déjà.' } },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/stays error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
