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
    const stays = await prisma.stay.findMany({
      where: { published: true },
      include: {
        sessions: {
          where: { startDate: { gte: new Date() } },
          orderBy: { startDate: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = stays.map(stay => ({
      id: stay.id,
      slug: stay.slug,
      title: stay.title,
      descriptionShort: stay.descriptionShort,
      programme: stay.programme,
      geography: stay.geography,
      accommodation: stay.accommodation,
      supervision: stay.supervision,
      priceFrom: stay.priceFrom, // Prix inclus pour PRO
      durationDays: stay.durationDays,
      period: stay.period,
      ageMin: stay.ageMin,
      ageMax: stay.ageMax,
      themes: stay.themes,
      imageCover: stay.imageCover,
      sessions: stay.sessions.map(s => ({
        id: s.id,
        startDate: s.startDate.toISOString(),
        endDate: s.endDate.toISOString(),
        seatsLeft: s.seatsLeft,
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
