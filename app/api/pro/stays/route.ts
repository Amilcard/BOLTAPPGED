import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

// Endpoint PRO: retourne les séjours AVEC les prix (authentification requise)
export async function GET(request: NextRequest) {
  const auth = verifyAuth(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentification requise' } },
      { status: 401 }
    );
  }

  try {
    const stays = await prisma.gd_stays.findMany({
      where: { published: true },
      include: {
        gd_stay_sessions: {
          where: { start_date: { gte: new Date() } },
          orderBy: { start_date: 'asc' },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const result = stays.map(stay => ({
      slug: stay.slug,
      title: stay.title,
      descriptionShort: stay.description_kids ?? stay.description_pro,
      programme: stay.programme,
      geography: stay.location_region,
      accommodation: stay.logistics_json,
      supervision: null,
      durationDays: stay.duration_days,
      period: stay.season,
      ageMin: stay.age_min,
      ageMax: stay.age_max,
      themes: stay.tags,
      imageCover: stay.images,
      sessions: stay.gd_stay_sessions.map(s => ({
        staySlug: s.stay_slug,
        startDate: s.start_date.toISOString(),
        endDate: s.end_date.toISOString(),
        seatsLeft: s.seats_left,
      })),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/pro/stays error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
