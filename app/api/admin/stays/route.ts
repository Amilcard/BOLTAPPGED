import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireEditor, verifyAuth } from '@/lib/auth-middleware';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET all stays (admin/editor/viewer)
export async function GET(request: NextRequest) {
  const auth = verifyAuth(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non autorisé' } },
      { status: 401 }
    );
  }

  try {
    const stays = await prisma.stay.findMany({
      include: { sessions: { orderBy: { startDate: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(stays);
  } catch (error) {
    console.error('GET /api/admin/stays error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}

const createStaySchema = z.object({
  title: z.string().min(1),
  descriptionShort: z.string().min(1),
  programme: z.array(z.string()),
  geography: z.string().min(1),
  accommodation: z.string().min(1),
  supervision: z.string().min(1),
  priceFrom: z.number().positive(),
  durationDays: z.number().positive(),
  period: z.enum(['printemps', 'été']),
  ageMin: z.number().min(0),
  ageMax: z.number().min(0),
  themes: z.array(z.string()),
  imageCover: z.string().url(),
  published: z.boolean().optional(),
});

// POST create stay (admin/editor)
export async function POST(request: NextRequest) {
  const auth = requireEditor(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non autorisé' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createStaySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message } },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const slug = data.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      + '-' + Date.now().toString(36);

    const stay = await prisma.stay.create({
      data: { ...data, slug },
    });

    return NextResponse.json(stay, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/stays error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
