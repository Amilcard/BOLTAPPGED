export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';


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
