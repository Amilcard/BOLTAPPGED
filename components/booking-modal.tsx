'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Check, ChevronRight, ChevronLeft, Loader2, Shield, Star, Info, AlertCircle } from 'lucide-react';
import type { Stay, StaySession } from '@/lib/types';
import { formatDate, formatDateLong } from '@/lib/utils';

interface DepartureCity {
  city: string;
  extra_eur: number;
}

interface SessionPriceData {
  date_text: string;
  base_price_eur: number | null;
  promo_price_eur: number | null;
}

interface BookingModalProps {
  stay: Stay;
  sessions: StaySession[];
  departureCities?: DepartureCity[];
  enrichmentSessions?: SessionPriceData[]; // Nouveau: Tous les prix disponibles
  sessionBasePrice?: number | null; // Back-compat
  initialSessionId?: string;
  initialCity?: string;
  onClose: () => void;
}

interface Step1Data {
  organisation: string;
  addresseStructure?: string; // P0: Champ adresse ajouté
  socialWorkerName: string;
  email: string;
  phone: string;
}

interface Step2Data {
  childFirstName: string;
  childBirthDate: string; // Format JJ/MM/AAAA ou AAAA-MM-JJ (ISO)
  childSex?: string; // P0: Sexe de l'enfant
  consent: boolean;
}

// Villes de départ standard (même liste pour tous les séjours)
const STANDARD_CITIES = [
  'Paris', 'Lyon', 'Lille', 'Marseille', 'Bordeaux', 'Rennes'
];

export function BookingModal({ stay, sessions, departureCities = [], enrichmentSessions = [], sessionBasePrice: legacyBasePrice = null, initialSessionId = '', initialCity = '', onClose }: BookingModalProps) {
  // Déterminer le step initial (si pré-sélections, on peut sauter des étapes)
  const getInitialStep = () => {
    if (initialSessionId && initialCity) return 2; // Session + Ville déjà choisis → step Pro
    if (initialSessionId) return 1; // Session choisie → step Ville
    return 0; // Rien de pré-sélectionné → step Session
  };
  const [step, setStep] = useState(getInitialStep); // 0 = session, 1 = ville, 2 = pro info, 3 = child info, 4 = validation, 5 = success
  const [selectedSessionId, setSelectedSessionId] = useState<string>(initialSessionId);
  const [selectedCity, setSelectedCity] = useState<string>(initialCity);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // P0: Focus management refs
  const firstInputRef = useRef<HTMLInputElement>(null);
  const firstErrorRef = useRef<HTMLParagraphElement>(null);

  // P0: Focus on first input when step changes
  useEffect(() => {
    if (step < 5) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [step]);

  // P0: Focus on first error when errors appear
  useEffect(() => {
    const errorKeys = Object.keys(fieldErrors);
    if (errorKeys.length > 0) {
      setTimeout(() => firstErrorRef.current?.focus(), 100);
    }
  }, [fieldErrors]);

  // Helper: Get step label
  const getStepLabel = (currentStep: number) => {
    const labels = [
      'Étape 1/5 : Choisir une session',
      'Étape 2/5 : Ville de départ',
      'Étape 3/5 : Informations de la structure',
      'Étape 4/5 : Informations de l\'enfant',
      'Étape 5/5 : Validation de la réservation',
      '' // Step 5 (success) - no label needed
    ];
    return labels[currentStep] || '';
  };

  // Helper: Calculate age from birthdate
  const calculateAge = (birthDate: string): number | null => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Calcul du prix total dynamique (session + ville)
  const selectedSession = sessions?.find(s => s?.id === selectedSessionId);

  // Logique de matching de prix
  let sessionBasePrice: number | null = legacyBasePrice; // Valeur par défaut

  if (selectedSession && enrichmentSessions && enrichmentSessions.length > 0) {
     const start = new Date(selectedSession.startDate);
     const day = String(start.getDate()).padStart(2, '0');
     const month = String(start.getMonth() + 1).padStart(2, '0');
     const dateStr = `${day}/${month}`;

     const found = enrichmentSessions.find(s => s.date_text?.includes(dateStr));
     if (found) {
       sessionBasePrice = found.promo_price_eur || found.base_price_eur;
     } else if (sessionBasePrice === null) {
       // Fallback
       sessionBasePrice = enrichmentSessions[0]?.promo_price_eur || enrichmentSessions[0]?.base_price_eur || null;
     }
  }

  const selectedCityData = departureCities.find(dc => dc.city === selectedCity);
  const extraVille = selectedCityData?.extra_eur ?? 0;
  const totalPrice = sessionBasePrice !== null ? sessionBasePrice + extraVille : null;

  const [step1, setStep1] = useState<Step1Data>({
    organisation: '',
    socialWorkerName: '',
    email: '',
    phone: '',
  });

  const [step2, setStep2] = useState<Step2Data>({
    childFirstName: '',
    childBirthDate: '',
    consent: false,
  });

  const validSessions = sessions?.filter(s => (s?.seatsLeft ?? 0) > 0) ?? [];
  // Supprimer les doublons stricts (même startDate ET même endDate)
  const sessionsUnique = (sessions || []).filter((s, idx, arr) => {
    const key = `${s.startDate}-${s.endDate}`;
    return idx === arr.findIndex(x => `${x.startDate}-${x.endDate}` === key);
  });

  // Filtrer les villes de départ : uniquement la liste standard + "Sans transport"
  const standardDepartureCities = departureCities.filter(dc =>
    STANDARD_CITIES.some(std =>
      dc.city.toLowerCase().includes(std.toLowerCase())
    ) || dc.city === 'Sans transport'
  );

  const isStep1Valid = step1.addresseStructure && step1.addresseStructure.trim().length >= 10 && step1.organisation && step1.socialWorkerName && step1.email && step1.phone;
  const isStep2Valid = step2.childSex && step2.childFirstName && step2.childBirthDate && step2.consent;

  // Générer les années de naissance possibles (6-17 ans)
  const currentYear = new Date().getFullYear();
  const birthYears = Array.from({ length: 12 }, (_, i) => currentYear - 6 - i);

  const handleSubmit = async () => {
    if (!selectedSessionId) return;
    setLoading(true);
    setError('');

    try {
      // Convertir année en date (1er janvier de l'année pour compatibilité DB)
      const birthDate = step2.childBirthDate; // Format ISO attendu

      // P0: Stratégie Pass-through pour conserver Adresse, Ville et Sexe sans toucher au backend
      const addressNote = step1.addresseStructure ? `[ADRESSE]: ${step1.addresseStructure}` : '';
      const cityNote = selectedCity ? `[VILLE DEPART]: ${selectedCity}` : '';
      const finalNotes = [addressNote, cityNote].filter(Boolean).join('\n');

      const sexNote = step2.childSex ? `[SEXE]: ${step2.childSex}` : '';

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stayId: stay?.id,
          sessionId: selectedSessionId,
          // departureCity supprimé car non géré par le backend
          organisation: step1.organisation,
          socialWorkerName: step1.socialWorkerName,
          email: step1.email,
          phone: step1.phone,
          childFirstName: step2.childFirstName,
          childLastName: '', // Minimisation données
          childBirthDate: birthDate,
          notes: finalNotes, // Adresse + Ville concaténées
          childNotes: sexNote, // Transmis dans le champ childNotes existant
          consent: step2.consent,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? 'Erreur lors de la réservation');

      setBookingId(data?.id ?? '');
      setStep(5);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-primary-100 p-6 pb-4 z-10">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-primary text-lg">Réserver - {stay?.marketingTitle || stay?.title}</h2>
            <button onClick={onClose} className="p-1 hover:bg-primary-50 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Sticky recap for steps 3-4: shows session + city + price */}
          {(step === 3 || step === 4) && selectedSession && (
            <div className="mt-3 p-3 bg-primary-50 rounded-xl border border-primary-200">
              <div className="flex items-center justify-between text-sm">
                <div className="text-primary-700">
                  <div className="font-medium">{formatDate(selectedSession?.startDate ?? '')}</div>
                  <div className="text-xs text-primary-500">{selectedCity} • {totalPrice}€ TTC</div>
                </div>
              </div>
            </div>
          )}
          {/* Prix total dynamique et Récapitulatif Sticky */}
          {totalPrice !== null && step < 5 && (
            <div className="mt-3 p-3 bg-secondary/5 rounded-xl border border-secondary/20 flex flex-col gap-1">
              {/* Ligne 1: Récap (visible dès que sélectionné) */}
              {(selectedSession || selectedCity) && (
                <div className="flex flex-wrap gap-2 text-xs text-primary-600 border-b border-secondary/10 pb-1 mb-1">
                  {selectedSession && (
                    <span className="font-medium bg-white px-1.5 py-0.5 rounded border border-secondary/10">
                      📅 {formatDateLong(selectedSession.startDate)}
                    </span>
                  )}
                  {selectedCity && (
                    <span className="font-medium bg-white px-1.5 py-0.5 rounded border border-secondary/10">
                      📍 {selectedCity}
                    </span>
                  )}
                </div>
              )}
              {/* Ligne 2: Prix */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-primary-600">
                  <span className="font-medium">Total estimé</span>
                  {extraVille > 0 && <span className="text-xs ml-2 text-primary-500">(+{extraVille}€ transport)</span>}

                </div>
                <div className="text-lg font-bold text-secondary">{totalPrice} €</div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6">
          {/* Progress */}
          {step < 5 && (
            <div className="flex gap-2 mb-6">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= step ? 'bg-secondary' : 'bg-primary-100'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Step 0: Session Selection */}
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="font-medium text-primary">Étape 1/5 : Choisir une session</h3>
              <div className="space-y-2">
                {sessionsUnique.slice(0, showAllSessions ? undefined : 4).map(session => {
                  const isFull = (session?.seatsLeft ?? 0) === 0;
                  const isSelected = selectedSessionId === session?.id;
                  // Chercher prix pour display dans la liste
                  let displayPrice = '';
                  if (enrichmentSessions && enrichmentSessions.length > 0) {
                      const start = new Date(session.startDate);
                      const day = String(start.getDate()).padStart(2, '0');
                      const month = String(start.getMonth() + 1).padStart(2, '0');
                      const dateStr = `${day}/${month}`;
                      const found = enrichmentSessions.find(s => s.date_text?.includes(dateStr));
                      if (found && (found.base_price_eur || found.promo_price_eur)) {
                          displayPrice = `${found.promo_price_eur || found.base_price_eur}€`;
                      }
                  }

                  return (
                    <label
                      key={session?.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-secondary bg-secondary/5 ring-2 ring-secondary/20'
                          : isFull
                          ? 'border-primary-100 bg-primary-50 opacity-50 cursor-not-allowed'
                          : 'border-primary-100 hover:border-primary-200'
                      }`}
                    >
                      {/* Indicateur checkbox/radio visible */}
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected
                          ? 'border-secondary bg-secondary'
                          : isFull
                          ? 'border-primary-200 bg-primary-100'
                          : 'border-primary-300'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <input
                        type="radio"
                        name="session"
                        value={session?.id}
                        checked={isSelected}
                        onChange={e => !isFull && setSelectedSessionId(e.target.value)}
                        disabled={isFull}
                        className="sr-only"
                      />
                      <div className="flex-1 flex justify-between items-center">
                        <div>
                            <div className="font-medium text-sm">
                            {formatDateLong(session?.startDate ?? '')} - {formatDateLong(session?.endDate ?? '')}
                            </div>
                            <div className={`text-xs ${isFull ? 'text-red-500' : 'text-primary-500'}`}>
                            {isFull ? 'Complet' : `${session?.seatsLeft ?? 0} places restantes`}
                            </div>
                        </div>
                        {displayPrice && !isFull && (
                            <div className="text-secondary font-bold text-sm">
                                {displayPrice}
                            </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
              {sessionsUnique.length > 4 && !showAllSessions && (
                <button
                  onClick={() => setShowAllSessions(true)}
                  className="w-full py-2 text-sm text-secondary hover:underline"
                >
                  Voir toutes les dates ({sessionsUnique.length - 4} autres)
                </button>
              )}
              {/* Aide contextuelle step 1 */}
              <div className="bg-primary-50 rounded-lg p-3 text-xs text-primary-600">
                <p><strong>1.</strong> Sélectionne la session qui correspond le mieux à tes disponibilités</p>
              </div>
              <button
                onClick={() => setStep(1)}
                disabled={!selectedSessionId}
                className="w-full py-3 bg-secondary text-white rounded-full font-medium flex items-center justify-center gap-2 hover:bg-secondary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuer <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 1: Ville de départ */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-medium text-primary">Étape 2/5 : Ville de départ</h3>
              <p className="text-sm text-primary-500">Choisissez la ville de départ pour le transport</p>

              {standardDepartureCities && standardDepartureCities.length > 0 ? (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {standardDepartureCities
                    .slice()
                    .sort((a, b) => {
                      if (a.city === 'Sans transport') return -1;
                      if (b.city === 'Sans transport') return 1;
                      // Trier selon l'ordre de STANDARD_CITIES
                      const aIndex = STANDARD_CITIES.findIndex(std => a.city.toLowerCase().includes(std.toLowerCase()));
                      const bIndex = STANDARD_CITIES.findIndex(std => b.city.toLowerCase().includes(std.toLowerCase()));
                      if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
                      if (aIndex >= 0) return -1;
                      if (bIndex >= 0) return 1;
                      return a.city.localeCompare(b.city);
                    })
                    .map((city, idx) => {
                      const isCitySelected = selectedCity === city.city;
                      return (
                        <label
                          key={idx}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            isCitySelected
                              ? 'border-secondary bg-secondary/5 ring-2 ring-secondary/20'
                              : 'border-primary-200 hover:border-primary-300'
                          }`}
                        >
                          {/* Indicateur checkbox/radio visible */}
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            isCitySelected
                              ? 'border-secondary bg-secondary'
                              : 'border-primary-300'
                          }`}>
                            {isCitySelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <input
                            type="radio"
                            name="city"
                            value={city.city}
                            checked={isCitySelected}
                            onChange={e => setSelectedCity(e.target.value)}
                            className="sr-only"
                          />
                          <span className="flex-1 text-sm font-medium text-primary-700 capitalize">
                            {city.city === 'Sans transport' ? 'Sans transport' : city.city}
                          </span>
                          <span className={`text-sm font-semibold ${isCitySelected ? 'text-secondary' : 'text-primary-600'}`}>
                            {city.extra_eur === 0 ? 'Inclus' : `+${city.extra_eur}€`}
                          </span>
                        </label>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-primary-500 italic">Villes de départ non disponibles. Contactez-nous pour plus d'informations.</p>
              )}

              {/* Aide contextuelle */}
              <div className="bg-primary-50 rounded-lg p-3 text-xs text-primary-600">
                <p><strong>2.</strong> Choisis ta ville de départ — le total se met à jour automatiquement</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(0)}
                  className="flex-1 py-3 border border-primary-200 text-primary rounded-full font-medium flex items-center justify-center gap-2 hover:bg-primary-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Retour
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!selectedCity}
                  className="flex-1 py-3 bg-secondary text-white rounded-full font-medium flex items-center justify-center gap-2 hover:bg-secondary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuer <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Pro Info (anciennement step 1) */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-medium text-primary">{getStepLabel(2)}</h3>
              <div className="space-y-3">
                <input
                  ref={firstInputRef}
                  type="text"
                  placeholder="Organisation *"
                  value={step1.organisation}
                  onChange={e => setStep1({ ...step1, organisation: e.target.value })}
                  className="w-full px-4 py-3 border border-primary-200 rounded-xl focus:ring-2 focus:ring-secondary focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="Adresse postale de la structure *"
                  value={step1.addresseStructure || ''}
                  onChange={e => setStep1({ ...step1, addresseStructure: e.target.value })}
                  onBlur={() => {
                    if ((step1.addresseStructure?.trim().length || 0) > 0 && (step1.addresseStructure?.trim().length || 0) < 10) {
                      setError('Adresse trop courte : ajoute la rue + code postal + ville.');
                    } else if (error.includes('Adresse')) setError('');
                  }}
                  className="w-full px-4 py-3 border border-primary-200 rounded-xl focus:ring-2 focus:ring-secondary focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="Nom complet *"
                  value={step1.socialWorkerName}
                  onChange={e => setStep1({ ...step1, socialWorkerName: e.target.value })}
                  className="w-full px-4 py-3 border border-primary-200 rounded-xl focus:ring-2 focus:ring-secondary focus:border-transparent"
                />
                <input
                  type="email"
                  placeholder="Email *"
                  value={step1.email}
                  onChange={e => setStep1({ ...step1, email: e.target.value })}
                  onBlur={() => {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (step1.email.trim().length > 0 && !emailRegex.test(step1.email)) {
                      setError('Email invalide : vérifie le @ et le domaine.');
                    } else if (error.includes('Email')) setError('');
                  }}
                  className="w-full px-4 py-3 border border-primary-200 rounded-xl focus:ring-2 focus:ring-secondary focus:border-transparent"
                />
                <input
                  type="tel"
                  placeholder="Téléphone (portable de préférence) *"
                  value={step1.phone}
                  onChange={e => setStep1({ ...step1, phone: e.target.value })}
                  onBlur={() => {
                    const telRegex = /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;
                    if (step1.phone.trim().length > 0 && !telRegex.test(step1.phone.replace(/\s/g, ''))) {
                      setError('Téléphone invalide : utilise 10 chiffres (ex: 06 00 00 00 00).');
                    } else if (error.includes('Téléphone')) setError('');
                  }}
                  className="w-full px-4 py-3 border border-primary-200 rounded-xl focus:ring-2 focus:ring-secondary focus:border-transparent"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 border border-primary-200 text-primary rounded-full font-medium flex items-center justify-center gap-2 hover:bg-primary-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Retour
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!isStep1Valid}
                  className="flex-1 py-3 bg-secondary text-white rounded-full font-medium flex items-center justify-center gap-2 hover:bg-secondary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuer <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Child Info (anciennement step 2) */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-medium text-primary">{getStepLabel(3)}</h3>
              <p className="text-sm text-primary-500">Collecte minimale pour la pré-inscription</p>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Prénom de l'enfant *"
                  value={step2.childFirstName}
                  onChange={e => setStep2({ ...step2, childFirstName: e.target.value })}
                  className="w-full px-4 py-3 border border-primary-200 rounded-xl focus:ring-2 focus:ring-secondary focus:border-transparent"
                />
                <div>
                  <label className="text-sm text-primary-600 mb-1 block">Date de naissance *</label>
                  <input
                    ref={firstInputRef}
                    type="date"
                    value={step2.childBirthDate}
                    onChange={e => setStep2({ ...step2, childBirthDate: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                    min={new Date(currentYear - 17, 0, 1).toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border border-primary-200 rounded-xl focus:ring-2 focus:ring-secondary focus:border-transparent"
                    required
                  />
                  {step2.childBirthDate && calculateAge(step2.childBirthDate) !== null && (
                    <p className="mt-1 text-xs text-primary-500">
                      Âge : {calculateAge(step2.childBirthDate)} ans
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm text-primary-600 mb-1 block">Sexe *</label>
                  <select
                    value={step2.childSex || ''}
                    onChange={e => setStep2({ ...step2, childSex: e.target.value })}
                    className="w-full px-4 py-3 border border-primary-200 rounded-xl focus:ring-2 focus:ring-secondary focus:border-transparent"
                    required
                  >
                    <option value="">Sélectionner</option>
                    <option value="F">Fille</option>
                    <option value="M">Garçon</option>
                    <option value="Autre">Autre / Non précisé</option>
                  </select>
                </div>
                <label className="flex items-start gap-3 p-3 bg-primary-50 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={step2.consent}
                    onChange={e => setStep2({ ...step2, consent: e.target.checked })}
                    className="w-5 h-5 mt-0.5 text-secondary rounded"
                  />
                  <span className="text-sm text-primary-600">
                    J&apos;accepte les conditions générales et autorise le traitement des données *
                  </span>
                </label>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error}</div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 border border-primary-200 text-primary rounded-full font-medium flex items-center justify-center gap-2 hover:bg-primary-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Retour
                </button>
                <button
                  onClick={() => setStep(4)}
                  disabled={!isStep2Valid}
                  className="flex-1 py-3 bg-secondary text-white rounded-full font-medium flex items-center justify-center gap-2 hover:bg-secondary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuer <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Validation + Options éducatives */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-medium text-primary">{getStepLabel(4)}</h3>

              {/* Récapitulatif Final pour Validation */}
              <div className="bg-primary-50 p-4 rounded-xl space-y-2 border border-primary-100">
                <h4 className="font-semibold text-primary mb-2 flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" /> Récapitulatif de la demande
                </h4>
                <div className="space-y-1 text-sm text-primary-700">
                  <p><span className="font-medium text-primary-500">Séjour :</span> {stay?.marketingTitle || stay?.title}</p>
                  <p><span className="font-medium text-primary-500">Session :</span> {formatDateLong(selectedSession?.startDate ?? '')} - {formatDateLong(selectedSession?.endDate ?? '')}</p>
                  <p><span className="font-medium text-primary-500">Ville de départ :</span> {selectedCity} {extraVille > 0 ? `(+${extraVille}€)` : '(Inclus)'}</p>
                  <div className="border-t border-primary-200 my-2 pt-2">
                    <p><span className="font-medium text-primary-500">Enfant :</span> {step2.childFirstName} ({calculateAge(step2.childBirthDate)} ans)</p>
                    <p><span className="font-medium text-primary-500">Structure :</span> {step1.organisation} ({step1.socialWorkerName})</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-primary-200 flex items-center justify-between">
                  <span className="font-bold text-primary">Total estimé</span>
                  <span className="text-xl font-bold text-secondary">{totalPrice} €</span>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 py-3 border border-primary-200 text-primary rounded-full font-medium flex items-center justify-center gap-2 hover:bg-primary-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Retour
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 py-3 bg-secondary text-white rounded-full font-medium flex items-center justify-center gap-2 hover:bg-secondary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {loading ? 'Envoi...' : 'Confirmer'}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Success (anciennement step 3) */}
          {step === 5 && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-primary mb-2">Réservation confirmée !</h3>
              <p className="text-primary-600 mb-4">
                Votre demande pour <strong>{stay?.marketingTitle || stay?.title}</strong> a été enregistrée.
              </p>
              <div className="bg-primary-50 p-4 rounded-xl text-left text-sm space-y-1">
                <p><strong>Référence :</strong> {bookingId}</p>
                <p><strong>Session :</strong> {formatDateLong(selectedSession?.startDate ?? '')} - {formatDateLong(selectedSession?.endDate ?? '')}</p>
                <p><strong>Ville :</strong> {selectedCity}</p>
                <p><strong>Enfant :</strong> {step2.childFirstName} (né le {new Date(step2.childBirthDate).toLocaleDateString('fr-FR')})</p>
                <p><strong>Contact :</strong> {step1.email}</p>

              </div>
              <button
                onClick={onClose}
                className="mt-6 px-6 py-3 bg-primary text-white rounded-full font-medium hover:bg-primary-600 transition-colors"
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
