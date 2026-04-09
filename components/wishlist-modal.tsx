'use client';

import { useState, useEffect, useRef } from 'react';
import { Heart, Share2, X, Compass, AlertCircle, Info, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { updateWishlistMotivation} from '@/lib/utils';

interface WishlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  stayTitle: string;
  staySlug: string;
  stayUrl: string;
}

export function WishlistModal({ isOpen, onClose, stayTitle, staySlug, stayUrl }: WishlistModalProps) {
  const [motivation, setMotivation] = useState('');
  const [prenom, setPrenom] = useState('');
  const [prenomReferent, setPrenomReferent] = useState(''); // P0: Personnalisation
  const [emailStructure, setEmailStructure] = useState('');
  const [choixMode, setChoixMode] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showMailtoWarning, setShowMailtoWarning] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const maxChars = 280;
  const minMessageChars = 20;
  const emailLocked = process.env.NEXT_PUBLIC_EMAIL_STRUCTURE_LOCKED === 'true';
  const defaultEmail = process.env.NEXT_PUBLIC_DEFAULT_STRUCTURE_EMAIL || '';

  // P0: Focus management
  const prenomInputRef = useRef<HTMLInputElement>(null);
  const firstErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus on first input when modal opens
      setTimeout(() => prenomInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    // Focus on first error when errors appear
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      setTimeout(() => firstErrorRef.current?.focus(), 100);
    }
  }, [errors]);

  // P0: Validation stricte Email
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // P0: Validation champs requis
  const isFormValid = () => {
    const finalEmail = emailLocked ? defaultEmail : emailStructure;
    return (
      prenom.trim().length >= 2 &&
      validateEmail(finalEmail) &&
      motivation.trim().length >= minMessageChars
    );
  };

  if (!isOpen) return null;

  const handleSaveMotivation = async () => {
    if (isSubmitting) return;

    const finalEmail = emailLocked ? defaultEmail : emailStructure;

    setIsSubmitting(true);
    setError('');

    try {
      // Récupérer ou générer le kid_session_token (UUID anonyme persistant)
      let kidSessionToken = localStorage.getItem('gd_kid_session_token');
      if (!kidSessionToken) {
        kidSessionToken = crypto.randomUUID();
        localStorage.setItem('gd_kid_session_token', kidSessionToken);
      }

      // Enregistrer côté serveur
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
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Erreur serveur');
      }

      // Garder aussi le localStorage pour compatibilité /envies
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
      ? `Ce séjour m'intéresse : ${stayTitle}\nPourquoi : ${motivation.trim()}\n${stayUrl}`
      : `Ce séjour m'intéresse : ${stayTitle}\n${stayUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: stayTitle, text });
      } catch {
        // User cancelled
      }
    } else {
      // Show mailto warning first
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 duration-300">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-primary-50 hover:bg-primary-100 transition"
        >
          <X className="w-4 h-4 text-primary" />
        </button>

        {/* Success icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
            <Heart className="w-8 h-8 text-red-500 fill-current" />
          </div>
        </div>

        <h2 className="text-lg font-bold text-primary text-center mb-1">
          {saved ? "Super choix 👌" : "Mon souhait"}
        </h2>
        <p className="text-sm text-primary-500 text-center mb-6">{stayTitle}</p>

        {/* Info message */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-primary">
            <span className="font-medium">
              {saved
                ? `Super choix 👌 Pour que ton éducateur·trice le sache, clique sur "Envoyer à mon éducateur·trice".`
                : 'Dis-nous ce qui t\'attire. Ton éducateur·trice recevra ton choix.'
              }
            </span>
          </p>
        </div>

        {/* Prénom field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-primary mb-2">
            Ton prénom <span className="text-red-500">*</span>
          </label>
          <input
            ref={prenomInputRef}
            type="text"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value.slice(0, 30))}
            onBlur={() => {
              if (prenom.trim().length > 0 && prenom.trim().length < 2) {
                setErrors(prev => ({ ...prev, prenom: 'Ton prénom doit faire au moins 2 lettres.' }));
              } else {
                setErrors(prev => { const { prenom: _prenom, ...rest } = prev; return rest; });
              }
            }}
            placeholder="Ex: Alex"
            className="w-full border border-primary-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary"
            required
            aria-invalid={!!errors.prenom}
            aria-describedby={errors.prenom ? "error-prenom" : undefined}
          />
          {errors.prenom && (
            <p id="error-prenom" ref={firstErrorRef} tabIndex={-1} className="mt-1 text-xs text-orange-600">
              {errors.prenom}
            </p>
          )}
        </div>

        {/* Prénom référent field — optionnel, masqué par défaut */}
        <details className="mb-4 group">
          <summary className="text-xs text-primary-400 cursor-pointer hover:text-primary-600 transition list-none flex items-center gap-1">
            <span>+ Ajouter le prénom de ton éducateur·trice (optionnel)</span>
          </summary>
          <div className="mt-2">
            <input
              type="text"
              value={prenomReferent}
              onChange={(e) => setPrenomReferent(e.target.value.slice(0, 30))}
              placeholder="Ex: Marie"
              className="w-full border border-primary-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary"
            />
            <p className="mt-1 text-xs text-primary-400">Si tu le connais, ça aide à personnaliser le message.</p>
          </div>
        </details>

        {/* Email structure field */}
        {emailLocked && !defaultEmail && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-700">Configuration manquante : l'email référent n'est pas défini. Contactez l'administrateur.</p>
          </div>
        )}
        {!emailLocked && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-primary mb-2">
              Email de ton éducateur·trice <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={emailStructure}
              onChange={(e) => setEmailStructure(e.target.value)}
              onBlur={() => {
                if (!emailStructure.trim()) {
                  setErrors(prev => ({ ...prev, email: 'L\'email de ton éducateur·trice est requis.' }));
                } else if (!validateEmail(emailStructure)) {
                  setErrors(prev => ({ ...prev, email: 'Il manque le @ ou le domaine dans l\'email.' }));
                } else {
                  setErrors(prev => { const { email: _email, ...rest } = prev; return rest; });
                }
              }}
              placeholder="Ex: referent@structure.fr"
              className="w-full border border-primary-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary"
              required
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "error-email" : undefined}
            />
            {errors.email && (
              <p id="error-email" className="mt-1 text-xs text-orange-600">
                {errors.email}
              </p>
            )}
          </div>
        )}

        {/* Comment tu as trouvé ce séjour ? */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-primary mb-2">
            Comment tu as trouvé ce séjour ?
          </label>
          <div className="flex flex-wrap gap-2">
            {([
              { value: 'seul', label: 'Tout seul' },
              { value: 'ami', label: 'Avec un ami / une amie' },
              { value: 'educateur', label: 'Mon éducateur me l\u2019a montré' },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setChoixMode(choixMode === value ? null : value)}
                className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all border ${
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

        {/* Motivation field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-primary mb-2">
            Qu&apos;est-ce qui t&apos;attire dans ce séjour ? <span className="text-red-500">*</span>
          </label>
          <textarea
            value={motivation}
            onChange={(e) => setMotivation(e.target.value.slice(0, maxChars))}
            onBlur={() => {
              if (motivation.trim().length > 0 && motivation.trim().length < minMessageChars) {
                setErrors(prev => ({ ...prev, motivation: 'Dis-nous en un peu plus !' }));
              } else {
                setErrors(prev => { const { motivation: _motivation, ...rest } = prev; return rest; });
              }
            }}
            placeholder="Ex: avec qui tu veux partir, ce que tu veux découvrir, ce que tu veux apprendre, ce qui te fait envie…"
            className="w-full border border-primary-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary"
            rows={3}
            required
            aria-invalid={!!errors.motivation}
            aria-describedby={errors.motivation ? "error-motivation" : undefined}
          />
          {errors.motivation && (
            <p id="error-motivation" className="mt-1 text-xs text-orange-600">
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
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Mention RGPD — information préalable Art. 13 */}
        {!saved && (
          <p className="text-[11px] text-gray-400 mb-3 text-center">
            Ton prénom et ton message sont transmis à ton éducateur·trice référent uniquement. Ils ne sont visibles par personne d&apos;autre.{' '}
            <Link href="/confidentialite" target="_blank" className="underline">En savoir plus</Link>
          </p>
        )}

        {/* Save button */}
        {!saved && (
          <button
            onClick={() => { void handleSaveMotivation(); }}
            disabled={!isFormValid() || isSubmitting}
            className="w-full mb-4 py-3 bg-secondary text-white rounded-full font-medium flex items-center justify-center gap-2 hover:bg-secondary-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> On note ça...</>
            ) : (
              'Je veux ce séjour !'
            )}
          </button>
        )}

        {/* Success state with share action */}
        {saved && (
          <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <button
              onClick={handleShare}
              className="w-full py-3 bg-secondary text-white rounded-full font-medium flex items-center justify-center gap-2 hover:bg-secondary/90 transition"
            >
              <Share2 className="w-4 h-4" /> Envoyer à mon éducateur·trice
            </button>
            <Link
              href="/envies"
              className="w-full py-3 bg-primary-50 text-primary rounded-full font-medium flex items-center justify-center gap-2 hover:bg-primary-100 transition"
            >
              <Heart className="w-4 h-4" /> Voir Mes souhaits
            </Link>
            <button
              onClick={onClose}
              className="w-full py-3 text-primary-500 rounded-full font-medium flex items-center justify-center gap-2 hover:bg-primary-50 transition"
            >
              <Compass className="w-4 h-4" /> Je regarde d&apos;autres colos
            </button>
          </div>
        )}

        {/* Actions when not saved */}
        {!saved && (
          <div className="flex flex-col gap-2">
            <Link
              href="/envies"
              className="w-full py-3 bg-primary-50 text-primary rounded-full font-medium flex items-center justify-center gap-2 hover:bg-primary-100 transition"
            >
              <Heart className="w-4 h-4" /> Voir Mes souhaits
            </Link>
            <button
              onClick={onClose}
              className="w-full py-3 text-primary-500 rounded-full font-medium flex items-center justify-center gap-2 hover:bg-primary-50 transition"
            >
              <Compass className="w-4 h-4" /> Je regarde d&apos;autres colos
            </button>
          </div>
        )}

        {/* Mailto warning modal */}
        {showMailtoWarning && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowMailtoWarning(false)} />
            <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full animate-in fade-in zoom-in duration-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Info className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-primary">Envoyer par messagerie</h3>
              </div>
              <p className="text-sm text-primary-600 mb-6">
                Ton téléphone va ouvrir ton appli de messagerie pour envoyer ce séjour à ton éducateur·trice. C&apos;est normal !
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowMailtoWarning(false)}
                  className="flex-1 py-2.5 border border-primary-200 text-primary rounded-full font-medium hover:bg-primary-50 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={handleMailtoConfirm}
                  className="flex-1 py-2.5 bg-secondary text-white rounded-full font-medium hover:bg-secondary-600 transition"
                >
                  Ouvrir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
