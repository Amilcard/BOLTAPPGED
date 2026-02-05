'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  MapPin,
  Home,
  Users,
  Calendar,
  Clock,
  ChevronRight,
  ChevronDown,
  Tag,
  Share2,
  Bus,
  Download,
  X,
  Check,
  Shield,
} from 'lucide-react';
import type { Stay, StaySession } from '@/lib/types';
import { formatDateLong, getWishlistMotivation, addToWishlist } from '@/lib/utils';
import { getPriceBreakdown, findSessionPrice, getMinSessionPrice, type EnrichmentSessionData } from '@/lib/pricing';
import { useApp } from '@/components/providers';
import { BookingModal } from '@/components/booking-modal';
import { WishlistModal } from '@/components/wishlist-modal';
import { Button } from '@/components/ui/button';

// Types
type DepartureData = { city: string; extra_eur: number };
type SessionData = { date_text: string; base_price_eur: number | null; promo_price_eur: number | null };
type EnrichmentData = { source_url: string; departures: DepartureData[]; sessions: SessionData[] };

const PRIORITY_CITIES = ['paris', 'lyon', 'marseille', 'lille', 'bordeaux', 'rennes'];

export function StayDetail({ stay }: { stay: Stay & { sessions: StaySession[], price_base?: number | null, price_unit?: string, pro_price_note?: string, sourceUrl?: string | null, geoLabel?: string | null, geoPrecision?: string | null, accommodationLabel?: string | null, contentKids?: any, rawSessions?: any[], images?: string[] } }) {
  const { mode, mounted, refreshWishlist } = useApp();
  const [showBooking, setShowBooking] = useState(false);
  const [showWishlistModal, setShowWishlistModal] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [showDepartures, setShowDepartures] = useState(false);
  const [showFullProgramme, setShowFullProgramme] = useState(false);

  const [preSelectedSessionId, setPreSelectedSessionId] = useState<string>('');
  const [preSelectedCity, setPreSelectedCity] = useState<string>('');

  // Enrichment data
  const stayUrl = String((stay as any)?.sourceUrl ?? "").trim();
  const contentKidsParsed = typeof stay?.contentKids === 'string' ? JSON.parse(stay.contentKids) : stay?.contentKids;
  const allDepartureCities: DepartureData[] = contentKidsParsed?.departureCities ?? [];
  const sessionsFormatted = contentKidsParsed?.sessionsFormatted ?? [];

  const departureCities = allDepartureCities.map((dc: DepartureData) => ({
    city: dc.city === 'sans_transport' ? 'Sans transport' : (dc.city || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    extra_eur: dc.extra_eur || 0
  })).filter((dc: DepartureData) => dc.city && dc.city.trim() !== '');

  const initialEnrichment: EnrichmentData | null = departureCities.length > 0 ? {
    source_url: stayUrl,
    departures: departureCities,
    sessions: sessionsFormatted
  } : null;
  const [enrichment] = useState<EnrichmentData | null>(initialEnrichment);

  const isKids = mode === 'kids';
  const isPro = !isKids;
  const slug = stay?.slug ?? '';

  const displayTitle = isKids ? ((stay as any)?.titleKids || stay?.title) : ((stay as any)?.titlePro || stay?.title);
  const displayDesc = isKids ? ((stay as any)?.descriptionKids || stay?.descriptionShort) : ((stay as any)?.descriptionPro || stay?.descriptionShort);

  // Prix minimum (session la moins chère, sans transport)
  const minSessionPrice = getMinSessionPrice(enrichment?.sessions || []);

  const selectedCityData = enrichment?.departures?.find(d => d.city === preSelectedCity);
  const cityExtraEur = selectedCityData?.extra_eur ?? 0;

  const sessions = stay?.sessions ?? [];
  const selectedSession = preSelectedSessionId
    ? sessions.find(s => s.id === preSelectedSessionId)
    : null;

  const selectedSessionPrice = selectedSession && enrichment?.sessions
    ? findSessionPrice(selectedSession.startDate, selectedSession.endDate, enrichment.sessions)
    : null;

  const priceBreakdown = getPriceBreakdown({
    sessionPrice: selectedSessionPrice,
    cityExtraEur,
    optionType: null,
    minSessionPrice,
  });

  const handleKidsCTA = () => {
    if (slug) {
      addToWishlist(slug);
      refreshWishlist();
    }
    setShowWishlistModal(true);
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = stay?.title ?? 'Séjour';
    const motivation = getWishlistMotivation(slug);
    const text = motivation
      ? `Ce séjour m'intéresse : ${title}\nPourquoi : ${motivation}`
      : `Ce séjour m'intéresse : ${title}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // User cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      } catch {
        window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`;
      }
    }
  };

  const programme = Array.isArray(stay?.programme) ? stay.programme : [];
  const themes = Array.isArray(stay?.themes) ? stay.themes : [];

  // Lot 10B: Extraire les tranches d'âges depuis ageRangesDisplay (calculé côté serveur)
  // Fallback: utiliser rawSessions si ageRangesDisplay pas disponible (rétrocompatibilité)
  const ageRangesFromProps = (stay as any).ageRangesDisplay;
  const rawSessions = (stay as any).rawSessions || [];
  
  // Extraire les tranches individuelles depuis ageRangesDisplay
  // Format attendu: "6-8 / 9-11 / 12-14 ans" → ["6-8", "9-11", "12-14"]
  const uniqueAgeRanges = ageRangesFromProps
    ? ageRangesFromProps.replace(' ans', '').split(' / ')
    : Array.from(new Set(
        rawSessions
          .filter((s: any) => s.age_min != null && s.age_max != null)
          .map((s: any) => `${s.age_min}-${s.age_max}`)
      )).sort((a: any, b: any) => {
        const minA = parseInt(a.split('-')[0]);
        const minB = parseInt(b.split('-')[0]);
        return minA - minB;
      });

  // Lot 10B: Calcul des durées réelles depuis stay.sessions
  // 'sessions' est déjà défini plus haut
  const uniqueDurations = Array.from(new Set(
    sessions.map((s: any) => {
      const start = new Date(s.startDate);
      const end = new Date(s.endDate);
      return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    })
  )).sort((a, b) => a - b);

  const durationDisplay = uniqueDurations.length > 0
    ? (uniqueDurations.length > 1 
        ? `Durées disponibles: ${uniqueDurations.join(' / ')} jours`
        : `${uniqueDurations[0]}j`)
    : `${stay?.durationDays ?? 0}j`;

  const durationBadge = uniqueDurations.length > 1
     ? `${Math.min(...uniqueDurations)} à ${Math.max(...uniqueDurations)} jours`
     : (uniqueDurations.length === 1 ? `${uniqueDurations[0]}j` : `${stay?.durationDays ?? 0}j`);

  return (
    <main className="pb-12">
      {/* === HERO VISUEL === */}
      <section className="relative">
        {/* Gallery Grid - Desktop */}
        <div className="hidden md:grid grid-cols-4 grid-rows-2 h-[50vh] min-h-[400px] gap-2 p-2">
          {stay?.images && stay.images.length > 0 ? (
            <>
              {/* Main Image */}
              <div className="col-span-2 row-span-2 relative rounded-xl overflow-hidden shadow-sm group cursor-pointer">
                 <Image
                  src={stay.images[0] || '/og-image.png'}
                  alt={displayTitle ?? ''}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  priority
                />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
              </div>
              
              {/* Secondary Images */}
              <div className="col-span-1 row-span-1 relative rounded-xl overflow-hidden shadow-sm group cursor-pointer">
                {stay.images[1] ? (
                  <Image
                    src={stay.images[1]}
                    alt="Vue du séjour"
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                   <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">
                     <Users className="w-8 h-8 opacity-20" />
                   </div>
                )}
              </div>
              <div className="col-span-1 row-span-1 relative rounded-xl overflow-hidden shadow-sm group cursor-pointer">
                {stay.images[2] ? (
                  <Image
                    src={stay.images[2]}
                    alt="Vue du séjour"
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                   <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">
                      <Home className="w-8 h-8 opacity-20" />
                   </div>
                )}
              </div>
              <div className="col-span-1 row-span-1 relative rounded-xl overflow-hidden shadow-sm group cursor-pointer">
                {stay.images[3] ? (
                  <Image
                    src={stay.images[3]}
                    alt="Vue du séjour"
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                   <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">
                      <Shield className="w-8 h-8 opacity-20" />
                   </div>
                )}
              </div>
              <div className="col-span-1 row-span-1 relative rounded-xl overflow-hidden shadow-sm group cursor-pointer">
                {stay.images[4] ? (
                  <Image
                    src={stay.images[4]}
                    alt="Vue du séjour"
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                   <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">
                      <MapPin className="w-8 h-8 opacity-20" />
                   </div>
                )}
                {stay.images.length > 5 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-medium text-lg">
                    +{stay.images.length - 5}
                  </div>
                )}
              </div>
            </>
          ) : (
             <div className="col-span-4 row-span-2 relative rounded-xl overflow-hidden">
                <Image
                  src={stay?.imageCover ?? '/og-image.png'}
                  alt={displayTitle ?? ''}
                  fill
                  className="object-cover"
                  priority
                />
             </div>
          )}
        </div>

        {/* Mobile Single Image */}
        <div className="md:hidden relative h-[35vh]">
           <Image
              src={stay?.imageCover ?? '/og-image.png'}
              alt={displayTitle ?? ''}
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>

        {/* Mobile-only Overlay Elements */}
        <div className="md:hidden absolute top-3 left-3 z-10">
          <span className="px-2.5 py-1 bg-white/95 backdrop-blur text-gray-900 text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-primary" />
             {uniqueAgeRanges.length > 0 
                ? uniqueAgeRanges.join(' / ') 
                : `${stay?.ageMin}-${stay?.ageMax}`
             } ans
          </span>
        </div>

        <div className="absolute top-3 right-3 flex gap-2 z-10">
          <button
            onClick={handleShare}
            className="w-9 h-9 bg-white/95 backdrop-blur rounded-full flex items-center justify-center text-gray-700 hover:text-primary hover:bg-white transition-all shadow-sm ring-1 ring-black/5"
            aria-label="Partager"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        {shareSuccess && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium animate-in slide-in-from-top shadow-lg z-20">
            Lien copié !
          </div>
        )}

        {/* Mobile Back Button */}
        <div className="absolute bottom-4 left-4 z-10 md:hidden">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-black/20 backdrop-blur-md rounded-lg text-white text-sm font-medium hover:bg-black/30 transition-all border border-white/20"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Link>
        </div>
        
        {/* Desktop Back Button (outside image) */}
        <div className="hidden md:block absolute top-6 left-6 z-20">
           <Link
            href="/"
            className="inline-flex items-center justify-center w-10 h-10 bg-white rounded-full text-gray-700 hover:text-primary hover:scale-105 transition-all shadow-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* === PRÉSENTATION SÉJOUR === */}
        <section className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{displayTitle}</h1>
          
          {/* META ROW (Desktop aligned) */}
          <div className="flex flex-wrap items-center gap-4 md:gap-6 mt-4 mb-6 text-sm text-gray-600 border-b border-gray-100 pb-6">
            <div className="flex items-center gap-2">
               <Users className="w-4 h-4 text-primary" />
               <span className="font-medium text-gray-900">
                 {uniqueAgeRanges.length > 0 
                    ? uniqueAgeRanges.map((r: any) => `${r} ans`).join(' / ') 
                    : `${stay?.ageMin}-${stay?.ageMax} ans`
                 }
               </span>
            </div>
            
            <div className="hidden md:block w-1 h-1 bg-gray-300 rounded-full" />
            
            <div className="flex items-center gap-2">
               <Clock className="w-4 h-4 text-primary" />
               <span>{durationBadge}</span>
            </div>

            <div className="hidden md:block w-1 h-1 bg-gray-300 rounded-full" />
            
            <div className="flex items-center gap-2">
               <MapPin className="w-4 h-4 text-primary" />
               <span>{stay?.geography}</span>
            </div>

             {themes.length > 0 && (
                <>
                  <div className="hidden md:block w-1 h-1 bg-gray-300 rounded-full" />
                  <div className="flex flex-wrap gap-2">
                    {themes.slice(0, 3).map(theme => (
                      <span key={theme} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-md">
                        {theme.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </>
             )}
          </div>

          <p className="text-lg text-gray-600 leading-relaxed mb-6">{displayDesc}</p>
          
          {/* Info Durées Multiples si pertinent */}
          {uniqueDurations.length > 1 && (
             <p className="text-sm text-primary font-medium mt-2">{durationDisplay}</p>
          )}

        </section>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* === INFORMATIONS CLÉS === */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                Informations clés
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col items-center text-center p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all group">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                     <MapPin className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Lieu</span>
                  <span className="text-sm font-bold text-gray-900">{stay?.geography}</span>
                </div>
                <div className="flex flex-col items-center text-center p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all group">
                  <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                     <Home className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Hébergement</span>
                  <span className="text-sm font-bold text-gray-900">{stay?.accommodation}</span>
                </div>
                <div className="flex flex-col items-center text-center p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all group">
                  <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                     {isPro ? <Tag className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                  </div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    {isPro ? 'Tarif (référence)' : 'Encadrement'}
                  </span>
                  {isPro && minSessionPrice !== null ? (
                    <>
                      <span className="text-sm font-bold text-gray-900">À partir de {minSessionPrice}€</span>
                      <span className="text-[10px] text-gray-500 mt-0.5">sans transport</span>
                    </>
                  ) : isPro ? (
                    <span className="text-sm font-bold text-gray-900">Sur devis</span>
                  ) : (
                    <span className="text-sm font-bold text-gray-900">{stay?.supervision}</span>
                  )}
                </div>
                <div className="flex flex-col items-center text-center p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all group">
                  <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                     <Calendar className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Période</span>
                  <span className="text-sm font-bold text-gray-900">{stay?.period === 'printemps' ? 'Printemps' : 'Été'}</span>
                </div>
              </div>
            </section>

            {/* === CONTENU DU SÉJOUR === */}
            <section className="bg-white rounded-xl shadow-brand p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Contenu du séjour</h2>
              <ul className="space-y-2 mb-4">
                {programme.slice(0, 5).map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
              
              {programme.length > 5 && (
                <button
                  onClick={() => setShowFullProgramme(!showFullProgramme)}
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-600 transition-colors"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${showFullProgramme ? 'rotate-180' : ''}`} />
                  {showFullProgramme ? 'Masquer le détail' : `Voir le détail complet (${programme.length - 5} activités)`}
                </button>
              )}

              {showFullProgramme && (
                <ol className="space-y-3 mt-4 pt-4 border-t border-gray-100">
                  {programme.slice(5).map((item, i) => (
                    <li key={i + 5} className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-primary/10 text-primary text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
                        {i + 6}
                      </span>
                      <span className="text-sm text-gray-700">{item}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* === VILLES DE DÉPART === */}
            {enrichment?.departures && enrichment.departures.length > 0 && (
              <section className="bg-white rounded-xl shadow-brand p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Bus className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-bold text-gray-900">Villes de départ</h2>
                  <span className="text-xs text-gray-500">({enrichment.departures.length} villes)</span>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {enrichment.departures
                    .slice()
                    .sort((a, b) => {
                      if (a.city === 'Sans transport') return -1;
                      if (b.city === 'Sans transport') return 1;
                      const aIndex = PRIORITY_CITIES.findIndex(std => String(a.city || '').toLowerCase().includes(std.toLowerCase()));
                      const bIndex = PRIORITY_CITIES.findIndex(std => String(b.city || '').toLowerCase().includes(std.toLowerCase()));
                      if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
                      if (aIndex >= 0) return -1;
                      if (bIndex >= 0) return 1;
                      return a.city.localeCompare(b.city);
                    })
                    .slice(0, 6)
                    .map((dep, i) => {
                      const isCitySelected = preSelectedCity === dep.city;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setPreSelectedCity(dep.city)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-all flex items-center gap-1.5 ${
                            isCitySelected
                              ? 'border-primary bg-primary text-white'
                              : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-primary/40'
                          }`}
                        >
                          {isCitySelected && <Check className="w-3 h-3" />}
                          {dep.city}
                          {!isKids && !isCitySelected && dep.extra_eur > 0 && (
                            <span className="text-gray-500">+{dep.extra_eur}€</span>
                          )}
                        </button>
                      );
                    })}
                  {enrichment.departures.length > 6 && (
                    <button
                      type="button"
                      onClick={() => setShowDepartures(true)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      +{enrichment.departures.length - 6}
                    </button>
                  )}
                </div>

                {preSelectedCity && (
                  <div className="flex items-center gap-2 text-xs text-primary font-medium bg-primary/5 px-3 py-2 rounded-lg">
                    <Check className="w-3.5 h-3.5" />
                    Ville sélectionnée : {preSelectedCity}
                    {!isKids && (() => {
                      const cityData = enrichment.departures.find(d => d.city === preSelectedCity);
                      return cityData && cityData.extra_eur > 0 ? ` (+${cityData.extra_eur}€)` : ' (inclus)';
                    })()}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* === SIDEBAR: SESSIONS & CTA === */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 bg-white rounded-xl shadow-brand p-6">
              <h3 className="font-bold text-gray-900 mb-4">Sessions disponibles</h3>
              {sessions.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune session disponible</p>
              ) : (
                <div className="space-y-2 mb-6">
                  {sessions.map(session => {
                    const isFull = (session?.seatsLeft ?? 0) === 0;
                    const isSelected = preSelectedSessionId === session?.id;
                    return (
                      <button
                        key={session?.id}
                        type="button"
                        disabled={isFull}
                        onClick={() => !isFull && setPreSelectedSessionId(session?.id ?? '')}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : isFull
                            ? 'border-red-200 bg-red-50 opacity-60 cursor-not-allowed'
                            : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isSelected ? 'border-primary bg-primary' : 'border-gray-300'
                          }`}>
                            {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {formatDateLong(session?.startDate ?? '')}
                            </div>
                            <div className="text-xs text-gray-500">
                              au {formatDateLong(session?.endDate ?? '')}
                            </div>
                            <div className={`text-xs mt-1 ${isFull ? 'text-red-500' : 'text-green-600'}`}>
                              {isFull ? 'Complet' : `${session?.seatsLeft ?? 0} places`}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* === TOTAL TTC DYNAMIQUE (PRO uniquement) === */}
              {isPro && (
                <div className="border-t border-gray-100 pt-4 mb-4">
                  <div className="bg-gradient-to-br from-primary/5 to-accent/5 border-2 border-primary/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Tag className="w-4 h-4 text-primary" />
                      <span className="text-sm font-bold text-gray-900">Ce que vous allez payer</span>
                    </div>
                    
                    {priceBreakdown.baseSession !== null ? (
                      <div className="space-y-2">
                        {/* Base session */}
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Session</span>
                          <span className="font-semibold text-gray-900">{priceBreakdown.baseSession}€</span>
                        </div>
                        
                        {/* Transport */}
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Transport</span>
                          <span className="font-semibold text-gray-900">
                            {cityExtraEur > 0 ? `+${cityExtraEur}€` : '0€'}
                            <span className="text-xs text-gray-500 ml-1">
                              ({preSelectedCity || 'Sans transport'})
                            </span>
                          </span>
                        </div>
                        
                        {/* Séparateur */}
                        <div className="border-t border-gray-200 my-2" />
                        
                        {/* Total TTC */}
                        <div className="flex justify-between items-center">
                          <span className="text-base font-bold text-gray-900">Total TTC</span>
                          <span className="text-xl font-bold text-accent">{priceBreakdown.total}€</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 text-center py-2">
                        Sélectionnez une session pour afficher le total
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CTA */}
              {isKids ? (
                <Button
                  onClick={handleKidsCTA}
                  className="w-full"
                  size="lg"
                >
                  Ce séjour m'intéresse
                </Button>
              ) : (
                <Button
                  onClick={() => setShowBooking(true)}
                  disabled={sessions.filter(s => (s?.seatsLeft ?? 0) > 0).length === 0}
                  className="w-full"
                  size="lg"
                >
                  Inscrire un enfant
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showBooking && (
        <BookingModal
          stay={stay}
          sessions={sessions}
          departureCities={enrichment?.departures}
          initialSessionId={preSelectedSessionId}
          initialCity={preSelectedCity}
          onClose={() => setShowBooking(false)}
        />
      )}

      {showWishlistModal && (
        <WishlistModal
          isOpen={showWishlistModal}
          onClose={() => setShowWishlistModal(false)}
          stayTitle={stay?.title ?? ''}
          staySlug={slug}
          stayUrl={typeof window !== 'undefined' ? window.location.href : ''}
        />
      )}

      {/* Modal villes */}
      {showDepartures && enrichment?.departures && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDepartures(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 p-6 pb-4 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900 text-xl">Villes de départ</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {enrichment.departures.length} villes disponibles
                </p>
              </div>
              <button onClick={() => setShowDepartures(false)} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-4 space-y-1 max-h-[50vh] overflow-y-auto">
              {enrichment.departures
                .slice()
                .sort((a, b) => {
                  if (a.city === 'Sans transport') return -1;
                  if (b.city === 'Sans transport') return 1;
                  const aIndex = PRIORITY_CITIES.findIndex(std => String(a.city || '').toLowerCase().includes(std.toLowerCase()));
                  const bIndex = PRIORITY_CITIES.findIndex(std => String(b.city || '').toLowerCase().includes(std.toLowerCase()));
                  if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
                  if (aIndex >= 0) return -1;
                  if (bIndex >= 0) return 1;
                  return a.city.localeCompare(b.city);
                })
                .map((dep, i) => {
                  const isCitySelected = preSelectedCity === dep.city;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setPreSelectedCity(dep.city);
                        setTimeout(() => setShowDepartures(false), 150);
                      }}
                      className={`w-full flex items-center justify-between py-3 px-4 rounded-xl transition-all ${
                        isCitySelected
                          ? 'bg-primary/10 border-2 border-primary'
                          : 'hover:bg-gray-50 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isCitySelected ? 'border-primary bg-primary' : 'border-gray-300'
                        }`}>
                          {isCitySelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className={`text-sm font-medium ${isCitySelected ? 'text-primary' : 'text-gray-700'}`}>
                          {dep.city}
                        </span>
                      </div>
                      {!isKids && (
                        <span className={`text-sm font-semibold ${isCitySelected ? 'text-primary' : 'text-gray-600'}`}>
                          {dep.extra_eur === 0 ? 'Inclus' : `+${dep.extra_eur}€`}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}
      {/* Mobile Sticky Action Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-8 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-4">
          <div className="flex-1">
             {priceBreakdown.minPrice ? (
               <div className="flex flex-col">
                  <span className="text-xs text-gray-500">À partir de</span>
                  <span className="text-xl font-bold text-primary">{priceBreakdown.minPrice}€</span>
                  <span className="text-[10px] text-gray-400">sans transport</span>
               </div>
             ) : (
                <span className="text-sm font-medium text-gray-500">
                  {stay?.pro_price_note || "Sur devis"}
                </span>
             )}
          </div>
          <div className="flex-1">
            {isKids ? (
              <Button onClick={handleKidsCTA} className="w-full" size="default">
                Ça m'intéresse
              </Button>
            ) : (
              <Button 
                onClick={() => setShowBooking(true)} 
                disabled={sessions.filter(s => (s?.seatsLeft ?? 0) > 0).length === 0}
                className="w-full"
                size="default"
              >
                Réserver
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
