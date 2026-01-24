import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stays = await prisma.stay.findMany({
      where: { published: true },
      include: {
        sessions: {
          where: { startDate: { gte: new Date() } },
          orderBy: { startDate: 'asc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Prix exclus pour endpoint public (sécurité)
    const result = stays.map(stay => ({
      id: stay.id,
      slug: stay.slug,
      title: stay.title,
      descriptionShort: stay.descriptionShort,
      durationDays: stay.durationDays,
      period: stay.period,
      ageMin: stay.ageMin,
      ageMax: stay.ageMax,
      themes: stay.themes,
      imageCover: stay.imageCover,
      geography: stay.geography,
      nextSessionStart: stay.sessions[0]?.startDate?.toISOString() ?? null,
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
