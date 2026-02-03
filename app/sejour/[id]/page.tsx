import {
  getSejourBySlug,
  getSessionPrices,
  getDepartureCitiesFormatted,
  getStaySessions,
  getSessionPricesFormatted
} from '@/lib/supabaseGed';
import { notFound } from 'next/navigation';
import { Header } from '@/components/header';
import { BottomNav } from '@/components/bottom-nav';
import { StayDetail } from './stay-detail';

export const dynamic = 'force-dynamic';

export default async function StayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // id = slug dans GED
  const stay = await getSejourBySlug(id).catch(() => null);

  if (!stay) notFound();

  // Récupérer sessions, villes formatées et âges en parallèle
  const [sessionPrices, departureCities, staySessions, sessionPricesFormatted] = await Promise.all([
    getSessionPrices(id),
    getDepartureCitiesFormatted(id), // Nouveau: retourne {city, extra_eur}[]
    getStaySessions(id), // Nouveau: pour les âges
    getSessionPricesFormatted(id), // Nouveau: pour le matching prix
  ]);

  // Calculer les vraies tranches d'âge depuis gd_stay_sessions
  const ageMin = staySessions.length > 0
    ? Math.min(...staySessions.map(s => s.age_min || 6))
    : 6;
  const ageMax = staySessions.length > 0
    ? Math.max(...staySessions.map(s => s.age_max || 17))
    : 17;

  // Calculer durée depuis la première session
  const firstSession = sessionPrices[0];
  let durationDays = 7;
  if (firstSession?.start_date && firstSession?.end_date) {
    const start = new Date(firstSession.start_date);
    const end = new Date(firstSession.end_date);
    durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  // Dédupliquer sessions par dates (éviter doublons ville)
  const sessionsMap = new Map<string, typeof sessionPrices[0]>();
  for (const s of sessionPrices) {
    const key = `${s.start_date}-${s.end_date}`;
    if (!sessionsMap.has(key)) {
      sessionsMap.set(key, s);
    }
  }
  const uniqueSessions = Array.from(sessionsMap.values());

  // Mapper vers le format attendu par StayDetail
  const stayData = {
    id: stay.slug,
    slug: stay.slug,
    title: stay.title || 'Sans titre',
    descriptionShort: stay.accroche || '',
    // CityCrunch: titres/descriptions Pro/Kids (optionnel, fallback côté client)
    titlePro: stay.title_pro || undefined,
    titleKids: stay.title_kids || undefined,
    descriptionPro: stay.description_pro || undefined,
    descriptionKids: stay.description_kids || undefined,
    programme: stay.programme ? stay.programme.split('\n').filter(Boolean) : [],
    geography: stay.location_region || stay.location_city || '',
    accommodation: stay.centre_name || '',
    supervision: 'Équipe Groupe & Découverte',
    durationDays,
    period: 'été',
    ageMin,
    ageMax,
    themes: [stay.ged_theme || 'PLEIN_AIR'],
    imageCover: stay.images?.[0] || '',
    published: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    departureCity: null,
    educationalOption: null,
    geoLabel: stay.location_city || null,
    geoPrecision: stay.location_region || null,
    accommodationLabel: stay.centre_name || null,
    // Nouveau format: villes avec extra_eur + sessions formatées pour le prix
    contentKids: {
      departureCities, // {city, extra_eur}[]
      sessionsFormatted: sessionPricesFormatted // Pour matching prix
    },
    sourceUrl: stay.source_url || null,
    pdfUrl: null,
    price_base: uniqueSessions[0]?.price_ged_total || null,
    price_unit: '€',
    pro_price_note: 'Tarif communiqué aux professionnels',
    sessions: uniqueSessions.map((s, idx) => ({
      id: `${stay.slug}-${idx}`,
      stayId: stay.slug,
      startDate: s.start_date,
      endDate: s.end_date,
      seatsLeft: 30,
    })),
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header variant="minimal" />
      <StayDetail stay={stayData} />
      <BottomNav />
    </div>
  );
}
