export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { isRateLimited, getClientIpFromHeaders } from '@/lib/rate-limit';

/**
 * POST /api/waitlist
 * Inscrit un email sur la liste d'attente d'un séjour.
 * Silencieux si déjà inscrit (ON CONFLICT DO NOTHING).
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIpFromHeaders(req.headers);
    if (await isRateLimited('waitlist', ip, 10, 5)) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
        { status: 429, headers: { 'Retry-After': '300' } }
      );
    }

    const { email, sejourSlug, nom } = await req.json();

    if (!email || !sejourSlug || !email.includes('@')) {
      return NextResponse.json({ error: 'Email et séjour requis.' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Vérifier que le séjour existe
    const { data: stay } = await supabase
      .from('gd_stays')
      .select('slug')
      .eq('slug', sejourSlug)
      .single();

    if (!stay) {
      return NextResponse.json({ error: 'Séjour introuvable.' }, { status: 404 });
    }

    await supabase
      .from('gd_waitlist')
      .upsert(
        { email: email.toLowerCase().trim(), sejour_slug: sejourSlug, nom: nom || null },
        { onConflict: 'email,sejour_slug', ignoreDuplicates: true }
      );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[waitlist] Erreur:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
