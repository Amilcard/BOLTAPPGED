import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireEditor } from '@/lib/auth-middleware';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateStaySchema = z.object({
  title: z.string().min(1).optional(),
  descriptionShort: z.string().min(1).optional(),
  programme: z.array(z.string()).optional(),
  geography: z.string().min(1).optional(),
  accommodation: z.string().min(1).optional(),
  supervision: z.string().min(1).optional(),
  priceFrom: z.number().positive().optional(),
  durationDays: z.number().positive().optional(),
  period: z.enum(['printemps', 'été']).optional(),
  ageMin: z.number().min(0).optional(),
  ageMax: z.number().min(0).optional(),
  themes: z.array(z.string()).optional(),
  imageCover: z.string().url().optional(),
  published: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireEditor(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non autorisé' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateStaySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } },
        { status: 400 }
      );
    }

    const stay = await prisma.stay.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(stay);
  } catch (error) {
    console.error('PUT /api/admin/stays/[id] error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireEditor(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non autorisé' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    await prisma.stay.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/admin/stays/[id] error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
