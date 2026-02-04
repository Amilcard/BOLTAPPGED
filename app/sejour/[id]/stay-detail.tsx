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
import { getPriceBreakdown, findSessionPrice } from '@/lib/pricing';
import { useApp } from '@/components/providers';
import { BookingModal } from '@/components/booking-modal';
import { WishlistModal } from '@/components/wishlist-modal';
import { Button } from '@/components/ui/button';

// Types
type DepartureData = { city: string; extra_eur: number };
type SessionData = { date_text: string; base_price_eur: number | null; promo_price_eur: number | null };
type EnrichmentData = { source_url: string; departures: DepartureData[]; sessions: SessionData[] };

const PRIORITY_CITIES = ['paris', 'lyon', 'marseille', 'lille', 'bordeaux', 'rennes'];

export function StayDetail({ stay }: { stay: Stay & { sessions: StaySession[], price_base?: number | null, price_unit?: string, pro_price_note?: string, sourceUrl?: string | null, geoLabel?: string | null, geoPrecision?: string | null, accommodationLabel?: string | null, contentKids?: any } }) {
  const { mode, mounted, refreshWishlist } = useApp();
  const [showBooking, setShowBooking] = useState(false);
  const [showWishlistModal, setShowWishlistModal] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [showDepartures, setShowDepartures] = useState(false);
  const [showPriceEstimation, setShowPriceEstimation] = useState(false);
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

  // Prix minimum
  const minSessionPrice = (() => {
    if (!enrichment?.sessions || enrichment.sessions.length === 0) return null;
    const prices = enrichment.sessions
      .map(s => s.promo_price_eur ?? s.base_price_eur)
      .filter((n): n is number => n !== null && Number.isFinite(n));
    if (prices.length === 0) return null;
    return Math.min(...prices);
  })();

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

  return (
    <main className="pb-12">
      {/* === HERO VISUEL === */}
      <section className="relative h-[30vh] min-h-[200px] max-h-[300px]">
        <Image
          src={stay?.imageCover ?? '/og-image.png'}
          alt={displayTitle ?? ''}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        {/* Badges discrets (coins) */}
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="px-2.5 py-1 bg-white/95 text-gray-800 text-xs font-bold rounded-lg shadow-sm flex items-center gap-1">
            <Users className="w-3 h-3 text-primary" />
            {stay?.ageMin ?? 0}-{stay?.ageMax ?? 0} ans
          </span>
        </div>
        <div className="absolute top-3 right-3 flex gap-2">
          <span className="px-2.5 py-1 bg-white/95 text-gray-800 text-xs font-bold rounded-lg shadow-sm flex items-center gap-1">
            <Clock className="w-3 h-3 text-primary" />
            {stay?.durationDays ?? 0}j
          </span>
          <button
            onClick={handleShare}
            className="w-9 h-9 bg-white/95 backdrop-blur rounded-lg flex items-center justify-center text-primary hover:bg-white transition-all shadow-sm"
            aria-label="Partager"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        {shareSuccess && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium animate-in slide-in-from-top shadow-lg">
            Lien copié !
          </div>
        )}

        <div className="absolute bottom-4 left-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-lg text-white text-sm font-medium hover:bg-white/30 transition-all border border-white/30"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Link>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* === PRÉSENTATION SÉJOUR === */}
        <section className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{displayTitle}</h1>
          <p className="text-lg text-gray-600 leading-relaxed">{displayDesc}</p>
          {themes.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {themes.map(theme => (
                <span key={theme} className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full border border-primary/20">
                  {theme}
                </span>
              ))}
            </div>
          )}
        </section>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* === INFORMATIONS CLÉS === */}
            <section className="bg-white rounded-xl shadow-brand p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Informations clés</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col items-center text-center p-3 bg-gray-50 rounded-lg">
                  <MapPin className="w-5 h-5 text-primary mb-2" />
                  <span className="text-xs font-medium text-gray-700">{stay?.geography}</span>
                </div>
                <div className="flex flex-col items-center text-center p-3 bg-gray-50 rounded-lg">
                  <Home className="w-5 h-5 text-primary mb-2" />
                  <span className="text-xs font-medium text-gray-700">{stay?.accommodation}</span>
                </div>
                <div className="flex flex-col items-center text-center p-3 bg-gray-50 rounded-lg">
                  <Shield className="w-5 h-5 text-primary mb-2" />
                  <span className="text-xs font-medium text-gray-700">{stay?.supervision}</span>
                </div>
                <div className="flex flex-col items-center text-center p-3 bg-gray-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-primary mb-2" />
                  <span className="text-xs font-medium text-gray-700">{stay?.period === 'printemps' ? 'Printemps' : 'Été'}</span>
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

              {/* Prix (Pro uniquement) */}
              {!isKids && mounted && (
                <div className="border-t border-gray-100 pt-4 mb-4">
                  {!showPriceEstimation ? (
                    <button
                      onClick={() => setShowPriceEstimation(true)}
                      className="w-full py-2.5 bg-gray-50 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                    >
                      <Tag className="w-4 h-4" />
                      Voir l'estimation tarifaire
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900">Estimation tarifaire</span>
                        <button
                          onClick={() => setShowPriceEstimation(false)}
                          className="p-1 hover:bg-gray-50 rounded-lg transition"
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                      {priceBreakdown.minPrice !== null ? (
                        <div className="space-y-2">
                          <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                            <div className="text-xs text-gray-600 mb-1">À partir de</div>
                            <div className="text-lg font-bold text-primary">{priceBreakdown.minPrice} €</div>
                          </div>
                          {priceBreakdown.total !== null && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                              <div className="text-xs text-gray-600 mb-1">Votre estimation</div>
                              <div className="text-base font-bold text-gray-900">{priceBreakdown.total} €</div>
                              <div className="text-xs text-gray-500 space-y-0.5 mt-1">
                                {priceBreakdown.baseSession !== null && (
                                  <div>Session : {priceBreakdown.baseSession}€</div>
                                )}
                                {cityExtraEur > 0 && (
                                  <div>Transport : +{cityExtraEur}€</div>
                                )}
                              </div>
                            </div>
                          )}
                          {!priceBreakdown.hasSelection && (
                            <div className="text-xs text-gray-400 text-center">
                              Sélectionnez une session pour une estimation précise
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 text-center py-2">
                          {stay?.pro_price_note || "Tarif communiqué aux professionnels"}
                        </div>
                      )}
                    </div>
                  )}
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
    </main>
  );
}
