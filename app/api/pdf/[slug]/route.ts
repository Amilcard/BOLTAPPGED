export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug) {
    return new NextResponse('Paramètre slug manquant', { status: 400 });
  }

  const supabase = getSupabaseAdmin();

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
