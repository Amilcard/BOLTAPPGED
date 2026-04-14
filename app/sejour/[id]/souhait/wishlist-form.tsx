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

export function WishlistForm({ stayTitle, staySlug }: WishlistFormProps) {
  const router = useRouter();
  const [motivation, setMotivation] = useState('');
  const [prenom, setPrenom] = useState('');
  const [prenomReferent, setPrenomReferent] = useState('');
  const [emailStructure, setEmailStructure] = useState('');
  const [choixMode, setChoixMode] = useState<string | null>(null);
  const [avecFrere, setAvecFrere] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showMailtoWarning, setShowMailtoWarning] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const maxChars = 280;
  const minMessageChars = 20;
  const emailLocked = process.env.NEXT_PUBLIC_EMAIL_STRUCTURE_LOCKED === 'true';
  const defaultEmail = process.env.NEXT_PUBLIC_DEFAULT_STRUCTURE_EMAIL || '';

  const stayUrl = typeof window !== 'undefined' ? `${window.location.origin}/sejour/${staySlug}` : '';

  // Focus management
  const prenomInputRef = useRef<HTMLInputElement>(null);
  const firstErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setTimeout(() => prenomInputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      setTimeout(() => firstErrorRef.current?.focus(), 100);
    }
  }, [errors]);

  // Validation
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isFormValid = () => {
    const finalEmail = emailLocked ? defaultEmail : emailStructure;
    return (
      prenom.trim().length >= 2 &&
      validateEmail(finalEmail) &&
      motivation.trim().length >= minMessageChars
    );
  };

  const handleSaveMotivation = async () => {
    if (isSubmitting) return;

    const finalEmail = emailLocked ? defaultEmail : emailStructure;

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
          kidPrenom: prenom.trim(),
          kidPrenomReferent: prenomReferent.trim() || undefined,
          sejourSlug: staySlug,
          sejourTitre: stayTitle,
          motivation: motivation.trim(),
          educateurEmail: finalEmail,
          educateurPrenom: prenomReferent.trim() || undefined,
          choixMode: choixMode || undefined,
          avecFrere: avecFrere || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Erreur serveur');
      }

      updateWishlistMotivation(staySlug, motivation.trim() || null, prenom.trim(), finalEmail);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = async () => {
    const text = motivation.trim()
      ? `Ce s\u00e9jour m\u2019int\u00e9resse : ${stayTitle}\nPourquoi : ${motivation.trim()}\n${stayUrl}`
      : `Ce s\u00e9jour m\u2019int\u00e9resse : ${stayTitle}\n${stayUrl}`;

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
      ? `Ce s\u00e9jour m\u2019int\u00e9resse : ${stayTitle}\nPourquoi : ${motivation.trim()}\n${stayUrl}`
      : `Ce s\u00e9jour m\u2019int\u00e9resse : ${stayTitle}\n${stayUrl}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(`Ce s\u00e9jour m'int\u00e9resse : ${stayTitle}`)}&body=${encodeURIComponent(text)}`;
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
        {saved ? 'Super choix !' : 'Ce séjour m\u2019intéresse'}
      </h1>
      <p className="text-sm text-primary-500 text-center mb-6">{stayTitle}</p>

      {/* Info message */}
      <div className="mb-4 p-3 bg-muted border border-primary-100 rounded-xl">
        <p className="text-sm text-primary">
          <span className="font-medium">
            {saved
              ? 'Super choix ! Pour que ton \u00e9ducateur\u00b7trice le sache, clique sur "Envoyer \u00e0 mon \u00e9ducateur\u00b7trice".'
              : 'Dis-nous ce qui t\u2019attire. Ton \u00e9ducateur\u00b7trice recevra ton choix.'}
          </span>
        </p>
      </div>

      {/* Pr\u00e9nom field */}
      <div className="mb-4">
        <Label htmlFor="prenom" className="block text-sm font-medium text-primary mb-2">
          Ton pr\u00e9nom <span className="text-red-500">*</span>
        </Label>
        <Input
          id="prenom"
          ref={prenomInputRef}
          type="text"
          value={prenom}
          onChange={(e) => setPrenom(e.target.value.slice(0, 30))}
          onBlur={() => {
            if (prenom.trim().length > 0 && prenom.trim().length < 2) {
              setErrors(prev => ({ ...prev, prenom: 'Ton pr\u00e9nom doit faire au moins 2 lettres.' }));
            } else {
              setErrors(prev => { const { prenom: _prenom, ...rest } = prev; return rest; });
            }
          }}
          placeholder="Ex: Alex"
          className="focus-visible:ring-secondary"
          required
          aria-invalid={!!errors.prenom}
          aria-describedby={errors.prenom ? 'error-prenom' : undefined}
        />
        {errors.prenom && (
          <p id="error-prenom" ref={firstErrorRef} tabIndex={-1} className="mt-1 text-xs text-red-600" role="alert">
            {errors.prenom}
          </p>
        )}
      </div>

      {/* Pr\u00e9nom r\u00e9f\u00e9rent field */}
      <details className="mb-4 group">
        <summary className="text-xs text-primary-400 cursor-pointer hover:text-primary-600 transition list-none flex items-center gap-1">
          <span>+ Ajouter le pr\u00e9nom de ton \u00e9ducateur\u00b7trice (optionnel)</span>
        </summary>
        <div className="mt-2">
          <Input
            type="text"
            value={prenomReferent}
            onChange={(e) => setPrenomReferent(e.target.value.slice(0, 30))}
            placeholder="Ex: Marie"
            className="focus-visible:ring-secondary"
          />
          <p className="mt-1 text-xs text-primary-400">Si tu le connais, \u00e7a aide \u00e0 personnaliser le message.</p>
        </div>
      </details>

      {/* Email structure field */}
      {emailLocked && !defaultEmail && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl" role="alert">
          <p className="text-sm text-red-700">Configuration manquante : l&apos;email r\u00e9f\u00e9rent n&apos;est pas d\u00e9fini. Contactez l&apos;administrateur.</p>
        </div>
      )}
      {!emailLocked && (
        <div className="mb-4">
          <Label htmlFor="email-structure" className="block text-sm font-medium text-primary mb-2">
            Email de ton \u00e9ducateur\u00b7trice <span className="text-red-500">*</span>
          </Label>
          <Input
            id="email-structure"
            type="email"
            value={emailStructure}
            onChange={(e) => setEmailStructure(e.target.value)}
            onBlur={() => {
              if (!emailStructure.trim()) {
                setErrors(prev => ({ ...prev, email: 'L\u2019email de ton \u00e9ducateur\u00b7trice est requis.' }));
              } else if (!validateEmail(emailStructure)) {
                setErrors(prev => ({ ...prev, email: 'Il manque le @ ou le domaine dans l\u2019email.' }));
              } else {
                setErrors(prev => { const { email: _email, ...rest } = prev; return rest; });
              }
            }}
            placeholder="Ex: referent@structure.fr"
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
      )}

      {/* Comment tu as trouv\u00e9 ce s\u00e9jour ? */}
      <div className="mb-4">
        <Label className="block text-sm font-medium text-primary mb-2">
          Comment tu as trouv\u00e9 ce s\u00e9jour ?
        </Label>
        <div className="flex flex-wrap gap-2">
          {([
            { value: 'seul', label: 'Tout seul' },
            { value: 'ami', label: 'Avec un ami / une amie' },
            { value: 'educateur', label: 'Mon \u00e9ducateur me l\u2019a montr\u00e9' },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setChoixMode(choixMode === value ? null : value)}
              className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all border min-h-[44px] ${
                choixMode === value
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Partir avec frère/soeur */}
      <div className="mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={avecFrere}
            onChange={(e) => setAvecFrere(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-secondary focus:ring-secondary"
          />
          <span className="text-sm text-primary">Je souhaite partir avec mon fr\u00e8re ou ma soeur</span>
        </label>
      </div>

      {/* Motivation field */}
      <div className="mb-4">
        <Label htmlFor="motivation" className="block text-sm font-medium text-primary mb-2">
          Qu&apos;est-ce qui t&apos;attire dans ce s\u00e9jour ? <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="motivation"
          value={motivation}
          onChange={(e) => setMotivation(e.target.value.slice(0, maxChars))}
          onBlur={() => {
            if (motivation.trim().length > 0 && motivation.trim().length < minMessageChars) {
              setErrors(prev => ({ ...prev, motivation: 'Dis-nous en un peu plus !' }));
            } else {
              setErrors(prev => { const { motivation: _motivation, ...rest } = prev; return rest; });
            }
          }}
          placeholder="Ex: ce qui me donne envie, ce que j'aimerais d\u00e9couvrir, avec qui j'aimerais partir..."
          className="resize-none focus-visible:ring-secondary"
          rows={3}
          required
          aria-invalid={!!errors.motivation}
          aria-describedby={errors.motivation ? 'error-motivation' : undefined}
        />
        {errors.motivation && (
          <p id="error-motivation" className="mt-1 text-xs text-red-600" role="alert">
            {errors.motivation}
          </p>
        )}
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-primary-400">Pas besoin de ton nom complet — juste ce qui t&apos;attire !</span>
          <span className={`text-xs ${motivation.length >= maxChars ? 'text-red-500 font-medium' : motivation.length >= maxChars * 0.85 ? 'text-orange-500' : 'text-primary-400'}`}>{motivation.length}/{maxChars}</span>
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
      {!saved && (
        <p className="text-[11px] text-gray-400 mb-3 text-center">
          Ton pr\u00e9nom et ton message sont transmis \u00e0 ton \u00e9ducateur\u00b7trice r\u00e9f\u00e9rent uniquement. Ils ne sont visibles par personne d&apos;autre.{' '}
          <Link href="/confidentialite" target="_blank" className="underline">En savoir plus</Link>
        </p>
      )}

      {/* Save button */}
      {!saved && (
        <Button
          onClick={() => { void handleSaveMotivation(); }}
          disabled={!isFormValid() || isSubmitting}
          className="w-full mb-4"
          size="lg"
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> On note \u00e7a...</>
          ) : (
            'Je veux ce s\u00e9jour !'
          )}
        </Button>
      )}

      {/* Success state */}
      {saved && (
        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Button onClick={handleShare} className="w-full" size="lg">
            <Share2 className="w-4 h-4" aria-hidden="true" /> Envoyer \u00e0 mon \u00e9ducateur\u00b7trice
          </Button>
          <Button variant="secondary" asChild className="w-full" size="lg">
            <Link href="/envies">
              <Heart className="w-4 h-4" aria-hidden="true" /> Voir Mes souhaits
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

      {/* Actions when not saved */}
      {!saved && (
        <div className="flex flex-col gap-2">
          <Button variant="secondary" asChild className="w-full" size="lg">
            <Link href="/envies">
              <Heart className="w-4 h-4" aria-hidden="true" /> Voir Mes souhaits
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

      {/* Mailto warning Dialog */}
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
              Ton t\u00e9l\u00e9phone va ouvrir ton appli de messagerie pour envoyer ce s\u00e9jour \u00e0 ton \u00e9ducateur\u00b7trice. C&apos;est normal !
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
            <Button
              onClick={handleMailtoConfirm}
              className="flex-1"
            >
              Ouvrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
