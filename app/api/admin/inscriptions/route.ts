export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/inscriptions
 * Liste les inscriptions depuis Supabase gd_inscriptions (source de vérité).
 * Remplace l'ancien GET /api/admin/bookings qui lisait Prisma.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Non autorisé' } },
        { status: 401 }
      );
    }

    // Paramètres optionnels de filtrage
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    let query = supabase
      .from('gd_inscriptions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('GET /api/admin/inscriptions Supabase error:', error);
      throw error;
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('GET /api/admin/inscriptions error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
