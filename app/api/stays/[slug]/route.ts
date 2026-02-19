import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const stay = await prisma.gd_stays.findUnique({
      where: { slug },
      include: {
        gd_stay_sessions: {
          where: { start_date: { gte: new Date() } },
          orderBy: { start_date: 'asc' },
        },
      },
    });

    if (!stay || !stay.published) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Séjour non trouvé' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      slug: stay.slug,
      sourceUrl: stay.source_url,
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
    });
  } catch (error) {
    console.error('GET /api/stays/[slug] error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
