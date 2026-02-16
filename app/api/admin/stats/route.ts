import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: { code: 'unauthorized', message: 'Non autorisé' } }, { status: 401 });

  const [stays, sessions, bookings, bookingsNew] = await Promise.all([
    prisma.stay.count(),
    prisma.staySession.count(),
    prisma.booking.count(),
    prisma.booking.count({ where: { status: 'new' } }),
  ]);

  return NextResponse.json({ stays, sessions, bookings, bookingsNew });
}
