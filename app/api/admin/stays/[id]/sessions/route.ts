import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth-middleware';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const sessionSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  seatsTotal: z.number().positive(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non autorisé' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = sessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const session = await prisma.staySession.create({
      data: {
        stayId: id,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        seatsTotal: data.seatsTotal,
        seatsLeft: data.seatsTotal,
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/stays/[id]/sessions error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
