import { getSejours } from '@/lib/supabaseGed';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sejours = await getSejours();
  const debug = sejours.slice(0, 5).map((s: any) => ({
    slug: s.slug,
    images_type: typeof s.images,
    images_isArray: Array.isArray(s.images),
    images_length: s.images?.length,
    images_0: s.images?.[0]?.substring(0, 80),
    image_cover: s.image_cover?.substring(0, 80),
    imageCover_mapped: (s.images?.[0] || '').substring(0, 80),
  }));
  return NextResponse.json(debug);
}
