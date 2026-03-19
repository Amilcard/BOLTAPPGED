export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;

  if (!slug) {
    return new NextResponse('Paramètre slug manquant', { status: 400 });
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('gd_stays')
    .select('pdf_url')
    .eq('slug', slug)
    .single();

  if (error || !data?.pdf_url) {
    return new NextResponse('Fiche PDF non disponible', { status: 404 });
  }

  // 307 Temporary Redirect — conserve la méthode GET, pas de mise en cache par les CDN
  return NextResponse.redirect(data.pdf_url, { status: 307 });
}
