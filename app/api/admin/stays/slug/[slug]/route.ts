import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = requireAdmin(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non autorisé' } },
      { status: 401 }
    );
  }

  try {
    const { slug } = await params;
    const stay = await prisma.stay.findUnique({
      where: { slug },
      include: { sessions: { orderBy: { startDate: 'asc' } } },
    });

    if (!stay) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Séjour non trouvé' } },
        { status: 404 }
      );
    }

    return NextResponse.json(stay);
  } catch (error) {
    console.error('GET /api/admin/stays/slug/[slug] error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
