import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: { code: 'unauthorized', message: 'Non autorisé' } }, { status: 401 });

  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      stay: { select: { title: true, slug: true } },
      session: { select: { startDate: true, endDate: true } },
    },
  });

  return NextResponse.json(bookings);
}
