import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

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
    const supabase = getSupabaseAdmin();

    const { data: stay, error } = await supabase
      .from('gd_stays')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !stay) {
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
