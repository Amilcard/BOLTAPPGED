'use client';

import { useState, useEffect, useRef } from 'react';
import { Heart, Share2, X, Compass, Check, AlertCircle, Info } from 'lucide-react';
import Link from 'next/link';
import { updateWishlistMotivation, canAddRequest } from '@/lib/utils';

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
    if (isSubmitting) return; // P0: Anti-double-submit

    const finalEmail = emailLocked ? defaultEmail : emailStructure;

    // Vérifier la limite de 3 demandes
    const check = canAddRequest(prenom.trim(), finalEmail);
    if (!check.allowed) {
      setError(check.message || 'Limite atteinte');
      return;
    }

    setIsSubmitting(true);
    updateWishlistMotivation(staySlug, motivation.trim() || null, prenom.trim(), finalEmail);
    setSaved(true);
    setError('');
    setTimeout(() => {
      setSaved(false);
      setIsSubmitting(false);
    }, 1500);
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

  const handleMailtoConfirm = async () => {
    const text = motivation.trim()
      ? `Ce séjour m'intéresse : ${stayTitle}\nPourquoi : ${motivation.trim()}\n${stayUrl}`
      : `Ce séjour m'intéresse : ${stayTitle}\n${stayUrl}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(`Ce séjour m'intéresse : ${stayTitle}`)}&body=${encodeURIComponent(text)}`;
    setShowMailtoWarning(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 duration-300">
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
          {saved ? "C'est noté !" : "Ce séjour te plaît ?"}
        </h2>
        <p className="text-sm text-primary-500 text-center mb-6">{stayTitle}</p>

        {/* Info message */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-primary">
            <span className="font-medium">
              {saved
                ? `Ta demande sera envoyée à ${prenomReferent.trim() || 'ton référent'}.`
                : 'Complète ce formulaire pour retrouver ce séjour dans "Mes souhaits".'
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
                setErrors(prev => ({ ...prev, prenom: 'Ton prénom semble trop court.' }));
              } else {
                setErrors(prev => { const { prenom, ...rest } = prev; return rest; });
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

        {/* Prénom référent field (P0: Personnalisation) */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-primary mb-2">
            Prénom de ton éducateur <span className="text-primary-400 font-normal">(optionnel)</span>
          </label>
          <input
            type="text"
            value={prenomReferent}
            onChange={(e) => setPrenomReferent(e.target.value.slice(0, 30))}
            placeholder="Ex: Marie"
            className="w-full border border-primary-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary"
          />
          <p className="mt-1 text-xs text-primary-400">Si tu le connais, ça aide à personnaliser le message.</p>
        </div>

        {/* Email structure field */}
        {!emailLocked && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-primary mb-2">
              Email de ton éducateur <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={emailStructure}
              onChange={(e) => setEmailStructure(e.target.value)}
              onBlur={() => {
                const finalEmail = emailLocked ? defaultEmail : emailStructure;
                if (finalEmail.trim().length > 0 && !validateEmail(finalEmail)) {
                  setErrors(prev => ({ ...prev, email: 'Il manque le @ ou le domaine dans l\'email.' }));
                } else {
                  setErrors(prev => { const { email, ...rest } = prev; return rest; });
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

        {/* Motivation field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-primary mb-2">
            Pourquoi ce séjour t'intéresse ? <span className="text-red-500">*</span>
          </label>
          <textarea
            value={motivation}
            onChange={(e) => setMotivation(e.target.value.slice(0, maxChars))}
            onBlur={() => {
              if (motivation.trim().length > 0 && motivation.trim().length < minMessageChars) {
                setErrors(prev => ({ ...prev, motivation: `Ajoute un peu de détail (au moins ${minMessageChars} caractères).` }));
              } else {
                setErrors(prev => { const { motivation, ...rest } = prev; return rest; });
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
            <span className="text-xs text-primary-400">N'écris pas de nom de famille, d'adresse ou d'infos perso.</span>
            <span className="text-xs text-primary-400">{motivation.length}/{maxChars}</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Save button */}
        {!saved && (
          <button
            onClick={handleSaveMotivation}
            disabled={!isFormValid() || isSubmitting}
            className="w-full mb-4 py-3 bg-secondary text-white rounded-full font-medium flex items-center justify-center gap-2 hover:bg-secondary-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>Enregistrement...</>
            ) : (
              'Enregistrer ma demande'
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
              <Share2 className="w-4 h-4" /> Partager à mon éducateur
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
              <Compass className="w-4 h-4" /> Continuer à explorer
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
              <Compass className="w-4 h-4" /> Continuer à explorer
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
                <h3 className="font-semibold text-primary">Ouverture de l'app mail</h3>
              </div>
              <p className="text-sm text-primary-600 mb-6">
                Ton téléphone va ouvrir ton application mail pour envoyer ce séjour à ton éducateur.
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
