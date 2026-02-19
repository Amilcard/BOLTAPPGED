import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stays = await prisma.gd_stays.findMany({
      where: { published: true },
      include: {
        gd_stay_sessions: {
          where: { start_date: { gte: new Date() } },
          orderBy: { start_date: 'asc' },
          take: 1,
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const result = stays.map(stay => ({
      slug: stay.slug,
      title: stay.title,
      descriptionShort: stay.description_kids ?? stay.description_pro,
      durationDays: stay.duration_days,
      period: stay.season,
      ageMin: stay.age_min,
      ageMax: stay.age_max,
      themes: stay.tags,
      imageCover: stay.images,
      geography: stay.location_region,
      nextSessionStart: stay.gd_stay_sessions[0]?.start_date?.toISOString() ?? null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/stays error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
