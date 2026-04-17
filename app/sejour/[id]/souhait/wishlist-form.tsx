'use client';

import { useState, useEffect, useRef } from 'react';
import { Heart, Share2, Compass, AlertCircle, Info, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateWishlistMotivation } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface WishlistFormProps {
  stayTitle: string;
  staySlug: string;
}

type DiscoveryOrigin = 'app' | 'educator_or_structure' | 'friend' | 'alone' | null;

const ORIGIN_OPTIONS: { value: DiscoveryOrigin; label: string }[] = [
  { value: 'app',                   label: 'Sur l\'application' },
  { value: 'educator_or_structure', label: 'Avec mon éducateur / ma structure' },
  { value: 'friend',                label: 'Avec un(e) ami(e)' },
  { value: 'alone',                 label: 'Tout seul' },
];

// Mapper les valeurs front → valeurs back (choix_mode)
function toChoixMode(origin: DiscoveryOrigin): string | null {
  switch (origin) {
    case 'educator_or_structure': return 'educateur';
    case 'friend':                return 'ami';
    case 'alone':                 return 'seul';
    case 'app':                   return 'app';
    default:                      return null;
  }
}

export function WishlistForm({ stayTitle, staySlug }: WishlistFormProps) {
  const router = useRouter();
  const [motivation, setMotivation]             = useState('');
  const [educateurEmail, setEducateurEmail]     = useState('');
  const [discoveryOrigin, setDiscoveryOrigin]   = useState<DiscoveryOrigin>(null);
  const [saved, setSaved]                       = useState(false);
  const [error, setError]                       = useState('');
  const [errors, setErrors]                     = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting]         = useState(false);
  const [showMailtoWarning, setShowMailtoWarning] = useState(false);

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const maxChars = 280;
  const minMessageChars = 20;

  const stayUrl = typeof window !== 'undefined' ? `${window.location.origin}/sejour/${staySlug}` : '';

  const motivationRef = useRef<HTMLTextAreaElement>(null);
  const firstErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setTimeout(() => motivationRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      setTimeout(() => firstErrorRef.current?.focus(), 100);
    }
  }, [errors]);

  const isFormValid = () =>
    motivation.trim().length >= minMessageChars && validateEmail(educateurEmail);

  const handleSaveMotivation = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError('');

    try {
      let kidSessionToken = localStorage.getItem('gd_kid_session_token');
      if (!kidSessionToken) {
        kidSessionToken = crypto.randomUUID();
        localStorage.setItem('gd_kid_session_token', kidSessionToken);
      }

      const res = await fetch('/api/souhaits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kidSessionToken,
          sejourSlug: staySlug,
          sejourTitre: stayTitle,
          motivation: motivation.trim(),
          educateurEmail: educateurEmail.trim(),
          choixMode: toChoixMode(discoveryOrigin),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data?.error || 'Erreur serveur');
      }

      updateWishlistMotivation(staySlug, motivation.trim() || null);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = async () => {
    const text = motivation.trim()
      ? `Ce séjour m'intéresse : ${stayTitle}\nPourquoi : ${motivation.trim()}\n${stayUrl}`
      : `Ce séjour m'intéresse : ${stayTitle}\n${stayUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: stayTitle, text });
      } catch {
        // User cancelled
      }
    } else {
      setShowMailtoWarning(true);
    }
  };

  const handleMailtoConfirm = () => {
    const text = motivation.trim()
      ? `Ce séjour m'intéresse : ${stayTitle}\nPourquoi : ${motivation.trim()}\n${stayUrl}`
      : `Ce séjour m'intéresse : ${stayTitle}\n${stayUrl}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(`Ce séjour m'intéresse : ${stayTitle}`)}&body=${encodeURIComponent(text)}`;
    setShowMailtoWarning(false);
  };

  return (
    <div className="bg-card rounded-brand shadow-card p-6">
      {/* Retour au séjour */}
      <Link
        href={`/sejour/${staySlug}`}
        className="inline-flex items-center gap-1 text-sm text-primary-400 hover:text-primary mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Retour au séjour
      </Link>

      {/* Heart icon */}
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
          <Heart className="w-8 h-8 text-red-500 fill-current" aria-hidden="true" />
        </div>
      </div>

      <h1 className="text-lg font-bold text-primary text-center mb-1">
        {saved ? 'Super choix !' : 'Ce séjour me plaît'}
      </h1>
      <p className="text-sm text-primary-500 text-center mb-1">{stayTitle}</p>

      {!saved && (
        <p className="text-sm text-primary-400 text-center mb-6">
          Dis-nous ce qui te donne envie de partir.
        </p>
      )}

      {/* Info / réassurance */}
      <div className="mb-4 p-3 bg-muted border border-primary-100 rounded-xl">
        <p className="text-sm text-primary">
          <span className="font-medium">
            {saved
              ? 'C\'est noté ! Ton message sera transmis à ton éducateur pour en discuter avec toi.'
              : 'Ton message sera transmis à ton éducateur pour en discuter avec toi.'}
          </span>
        </p>
      </div>

      {!saved && (
        <>
          {/* Email éducateur */}
          <div className="mb-4">
            <Label htmlFor="educateur-email" className="block text-sm font-medium text-primary mb-2">
              Email de ton éducateur <span className="text-red-500">*</span>
            </Label>
            <Input
              id="educateur-email"
              type="email"
              value={educateurEmail}
              onChange={(e) => setEducateurEmail(e.target.value)}
              onBlur={() => {
                if (!educateurEmail.trim()) {
                  setErrors(prev => ({ ...prev, email: 'L\'email de ton éducateur est requis.' }));
                } else if (!validateEmail(educateurEmail)) {
                  setErrors(prev => ({ ...prev, email: 'Il manque le @ ou le domaine.' }));
                } else {
                  setErrors(prev => { const { email: _e, ...rest } = prev; return rest; });
                }
              }}
              placeholder="Ex: marie.dupont@structure.fr"
              className="focus-visible:ring-secondary"
              required
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'error-email' : undefined}
            />
            {errors.email && (
              <p id="error-email" className="mt-1 text-xs text-red-600" role="alert">
                {errors.email}
              </p>
            )}
          </div>

          {/* Motivation field */}
          <div className="mb-4">
            <Label htmlFor="motivation" className="block text-sm font-medium text-primary mb-2">
              Qu'est-ce qui te donne envie de partir ? <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="motivation"
              ref={motivationRef}
              value={motivation}
              onChange={(e) => setMotivation(e.target.value.slice(0, maxChars))}
              onBlur={() => {
                if (motivation.trim().length > 0 && motivation.trim().length < minMessageChars) {
                  setErrors(prev => ({ ...prev, motivation: 'Dis-nous en un peu plus !' }));
                } else {
                  setErrors(prev => { const { motivation: _m, ...rest } = prev; return rest; });
                }
              }}
              placeholder="Ce que tu aimerais faire, découvrir… ou avec qui tu voudrais partir"
              className="resize-none focus-visible:ring-secondary"
              rows={3}
              required
              aria-invalid={!!errors.motivation}
              aria-describedby={errors.motivation ? 'error-motivation' : undefined}
            />
            {errors.motivation && (
              <p id="error-motivation" ref={firstErrorRef} tabIndex={-1} className="mt-1 text-xs text-red-600" role="alert">
                {errors.motivation}
              </p>
            )}
            <div className="flex justify-end mt-1">
              <span className={`text-xs ${motivation.length >= maxChars ? 'text-red-500 font-medium' : motivation.length >= maxChars * 0.85 ? 'text-orange-500' : 'text-primary-400'}`}>
                {motivation.length}/{maxChars}
              </span>
            </div>
          </div>

          {/* Origine de découverte */}
          <div className="mb-4">
            <Label className="block text-sm font-medium text-primary mb-2">
              Comment tu as découvert ce séjour ?
            </Label>
            <div className="flex flex-wrap gap-2">
              {ORIGIN_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDiscoveryOrigin(discoveryOrigin === value ? null : value)}
                  className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all border min-h-[44px] ${
                    discoveryOrigin === value
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                  aria-pressed={discoveryOrigin === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2" role="alert">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Mention RGPD */}
          <p className="text-[11px] text-gray-400 mb-3 text-center">
            Ton message est transmis à ton éducateur uniquement. Il n&apos;est visible par personne d&apos;autre.{' '}
            <Link href="/confidentialite" target="_blank" className="underline">En savoir plus</Link>
          </p>

          {/* CTA principal */}
          <Button
            onClick={() => { void handleSaveMotivation(); }}
            disabled={!isFormValid() || isSubmitting}
            className="w-full mb-4"
            size="lg"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> On note ça...</>
            ) : (
              'Envoyer mon envie'
            )}
          </Button>

          {/* CTAs secondaires */}
          <div className="flex flex-col gap-2">
            <Button variant="secondary" asChild className="w-full" size="lg">
              <Link href="/envies">
                <Heart className="w-4 h-4" aria-hidden="true" /> Voir mes envies
              </Link>
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push(`/sejour/${staySlug}`)}
              className="w-full"
              size="lg"
            >
              <Compass className="w-4 h-4" aria-hidden="true" /> Je regarde d&apos;autres colos
            </Button>
          </div>
        </>
      )}

      {/* État sauvegardé */}
      {saved && (
        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Button onClick={handleShare} className="w-full" size="lg">
            <Share2 className="w-4 h-4" aria-hidden="true" /> Envoyer à mon éducateur
          </Button>
          <Button variant="secondary" asChild className="w-full" size="lg">
            <Link href="/envies">
              <Heart className="w-4 h-4" aria-hidden="true" /> Voir mes envies
            </Link>
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push(`/sejour/${staySlug}`)}
            className="w-full"
            size="lg"
          >
            <Compass className="w-4 h-4" aria-hidden="true" /> Je regarde d&apos;autres colos
          </Button>
        </div>
      )}

      {/* Dialog mailto fallback */}
      <Dialog open={showMailtoWarning} onOpenChange={setShowMailtoWarning}>
        <DialogContent className="max-w-sm rounded-brand">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                <Info className="w-5 h-5 text-primary" aria-hidden="true" />
              </div>
              <DialogTitle className="font-semibold text-primary">Envoyer par messagerie</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-primary-600 pt-2">
              Ton téléphone va ouvrir ton appli de messagerie pour envoyer ce séjour à ton éducateur. C&apos;est normal !
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setShowMailtoWarning(false)}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button onClick={handleMailtoConfirm} className="flex-1">
              Ouvrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
