import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: { code: 'unauthorized', message: 'Non autorisé' } }, { status: 401 });

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      stay: { select: { title: true, slug: true } },
      session: { select: { startDate: true, endDate: true } },
    },
  });

  if (!booking) return NextResponse.json({ error: { code: 'not_found', message: 'Demande non trouvée' } }, { status: 404 });

  return NextResponse.json(booking);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(req);
  if (!auth || !['ADMIN', 'EDITOR'].includes(auth.role)) {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'Non autorisé' } }, { status: 401 });
  }

  const body = await req.json();
  const { status } = body;

  if (!['new', 'in_review', 'accepted', 'refused'].includes(status)) {
    return NextResponse.json({ error: { code: 'validation_error', message: 'Statut invalide' } }, { status: 400 });
  }

  const booking = await prisma.booking.update({
    where: { id: params.id },
    data: { status },
  });

  return NextResponse.json(booking);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(req);
  if (!auth || auth.role !== 'ADMIN') {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'Admin requis' } }, { status: 401 });
  }

  await prisma.booking.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
