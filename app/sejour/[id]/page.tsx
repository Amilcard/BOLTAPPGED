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
import { getStayAgeData, getStayDurationDays, getStayPeriod } from '@/lib/age-utils';

export const dynamic = 'force-dynamic';

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

  // Sprint 1: Calcul unifié âges + durée via helpers centralisés
  const sessionAgeData = staySessions.map(s => ({ age_min: s.age_min, age_max: s.age_max }));
  const { ageMin, ageMax, ageRangesDisplay } = getStayAgeData(sessionAgeData);
  const sessionDateData = staySessions.map(s => ({ start_date: s.start_date, end_date: s.end_date }));
  const durationDays = getStayDurationDays(sessionDateData, 7);

  // Dédupliquer sessions par dates (éviter doublons ville)
  const sessionsMap = new Map<string, typeof sessionPrices[0]>();
  for (const s of sessionPrices) {
    const key = `${s.start_date}-${s.end_date}`;
    if (!sessionsMap.has(key)) {
      sessionsMap.set(key, s);
    }
  }
  const uniqueSessions = Array.from(sessionsMap.values());

  // Parse price_includes_features (jsonb → string[])
  const priceIncludesRaw = stay.price_includes_features;
  const priceIncludesFeatures: string[] | null = Array.isArray(priceIncludesRaw)
    ? priceIncludesRaw
    : null;

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
    period: getStayPeriod(sessionDateData, 'été'),
    ageMin,
    ageMax,
    ageRangesDisplay, // NEW: Detailed age ranges for display
    themes: themesMap[stay.slug] || [], // Multi-thèmes depuis gd_stay_themes
    imageCover: stay.images?.[0] || '',
    images: stay.images || [],
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
    rawSessions: staySessions, // Prop "NO CASCADE" pour passer les âges sans modifier les types globaux

    // === CHAMPS PREMIUM (fallback null = le front utilise les champs legacy) ===
    marketingTitle: stay.marketing_title || null,
    punchline: stay.punchline || null,
    expertPitch: stay.expert_pitch || null,
    emotionTag: stay.emotion_tag || null,
    carouselGroup: stay.carousel_group || null,
    spotLabel: stay.spot_label || null,
    standingLabel: stay.standing_label || null,
    expertiseLabel: stay.expertise_label || null,
    intensityLabel: stay.intensity_label || null,
    priceIncludesFeatures,
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header variant="minimal" />
      <StayDetail stay={stayData} />
      <BottomNav />
    </div>
  );
}
