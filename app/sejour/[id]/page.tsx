import {
  getSejourBySlug,
  getSessionPrices,
  getDepartureCitiesFormatted,
  getStaySessions,
  getSessionPricesFormatted,
  getAllStayThemes
} from '@/lib/supabaseGed';
import { notFound } from 'next/navigation';
import { Header } from '@/components/header';
import { BottomNav } from '@/components/bottom-nav';
import { StayDetail } from './stay-detail';
import { mapDbStayToViewModel } from '@/lib/mappers/stay';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

// SEO — Meta tags dynamiques pour chaque séjour
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const stay = await getSejourBySlug(id).catch(() => null);

  if (!stay) {
    return { title: 'Séjour introuvable — Groupe & Découverte' };
  }

  const title = stay.marketing_title || 'Séjour';
  const description = stay.punchline || stay.expert_pitch || `Séjour ${title} avec Groupe & Découverte`;
  const image = Array.isArray(stay.images) && stay.images.length > 0 ? (stay.images as string[])[0] : undefined;

  return {
    title: `${title} — Groupe & Découverte`,
    description,
    openGraph: {
      title: `${title} — Groupe & Découverte`,
      description,
      type: 'website',
      ...(image ? { images: [{ url: image, width: 1200, height: 630, alt: title }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function StayPage({ params }: { params: Promise<{ id: string }> }) {
  // Verification Round 5 - Force Revalidation: 2026-02-06 13:20
  const { id } = await params;

  // id = slug dans GED
  const stay = await getSejourBySlug(id).catch(() => null);

  if (!stay) notFound();

  // Récupérer sessions, villes formatées, âges et thèmes en parallèle
  const [sessionPrices, departureCities, staySessions, sessionPricesFormatted, themesMap] = await Promise.all([
    getSessionPrices(id),
    getDepartureCitiesFormatted(id), // Nouveau: retourne {city, extra_eur}[]
    getStaySessions(id), // Nouveau: pour les âges
    getSessionPricesFormatted(id), // Nouveau: pour le matching prix
    getAllStayThemes(), // Nouveau: pour les thèmes multi-tags depuis gd_stay_themes
  ]);

  // Mapping centralisé DB → ViewModel (lib/mappers/stay.ts)
  const stayData = mapDbStayToViewModel(
    stay,
    sessionPrices,
    staySessions,
    departureCities,
    sessionPricesFormatted,
    themesMap,
  );

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header variant="minimal" />
      <StayDetail stay={stayData} />
      <BottomNav />
    </div>
  );
}
