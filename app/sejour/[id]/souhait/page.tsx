import { getSejourBySlug } from '@/lib/supabaseGed';
import { notFound } from 'next/navigation';
import { Header } from '@/components/header';
import { BottomNav } from '@/components/bottom-nav';
import { WishlistForm } from './wishlist-form';

export const dynamic = 'force-dynamic';

export default async function SouhaitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stay = await getSejourBySlug(id).catch(() => null);

  if (!stay) notFound();

  const stayTitle = stay.marketing_title || stay.title || 'Séjour';
  const staySlug = stay.slug;

  return (
    <div className="min-h-screen bg-muted pb-20 md:pb-0">
      <Header variant="minimal" />
      <main className="max-w-md mx-auto px-4 pt-6 pb-8">
        <WishlistForm
          stayTitle={stayTitle}
          staySlug={staySlug}
        />
      </main>
      <BottomNav />
    </div>
  );
}
