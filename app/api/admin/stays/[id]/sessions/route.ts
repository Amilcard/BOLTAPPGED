import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('[supabase admin] SUPABASE_SERVICE_ROLE_KEY manquante');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
}

// GET sessions for a stay (by slug) from Supabase
export async function GET(
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
    const { id } = await params; // id = stay slug
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('gd_stay_sessions')
      .select('*')
      .eq('stay_slug', id)
      .order('start_date');

    if (error) throw error;

    // Mapper snake_case → camelCase pour compatibilité front admin
    const sessions = (data || []).map((s: Record<string, unknown>) => ({
      id: s.id,
      stayId: s.stay_slug,
      startDate: s.start_date,
      endDate: s.end_date,
      seatsTotal: (s.seats_total as number) ?? 0,
      seatsLeft: (s.seats_left as number) ?? -1,
    }));

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('GET /api/admin/stays/[id]/sessions error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
