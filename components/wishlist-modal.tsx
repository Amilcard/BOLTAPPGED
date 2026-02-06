'use client';

import { useState } from 'react';
import { Heart, Share2, X, Compass, Check, AlertCircle } from 'lucide-react';
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
  const [shareSuccess, setShareSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const maxChars = 280;
  const minMessageChars = 20;
  const emailLocked = process.env.NEXT_PUBLIC_EMAIL_STRUCTURE_LOCKED === 'true';
  const defaultEmail = process.env.NEXT_PUBLIC_DEFAULT_STRUCTURE_EMAIL || '';

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

  const handleSaveMotivation = () => {
    const finalEmail = emailLocked ? defaultEmail : emailStructure;

    // Vérifier la limite de 3 demandes
    const check = canAddRequest(prenom.trim(), finalEmail);
    if (!check.allowed) {
      setError(check.message || 'Limite atteinte');
      return;
    }

    updateWishlistMotivation(staySlug, motivation.trim() || null, prenom.trim(), finalEmail);
    setSaved(true);
    setError('');
    setTimeout(() => setSaved(false), 1500);
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
      try {
        await navigator.clipboard.writeText(text);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      } catch {
        window.location.href = `mailto:?subject=${encodeURIComponent(`Ce séjour m'intéresse : ${stayTitle}`)}&body=${encodeURIComponent(text)}`;
      }
    }
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
            className="w-full border border-primary-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            required
            aria-invalid={!!errors.prenom}
            aria-describedby={errors.prenom ? "error-prenom" : undefined}
          />
          {errors.prenom && (
            <p id="error-prenom" className="mt-1 text-xs text-orange-600">
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
            className="w-full border border-primary-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
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
              className="w-full border border-primary-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
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
            className="w-full border border-primary-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
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
            disabled={!isFormValid()}
            className="w-full mb-4 py-3 bg-accent text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-accent-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saved ? (
              <><Check className="w-4 h-4" /> Enregistré !</>
            ) : (
              'Enregistrer ma demande'
            )}
          </button>
        )}

        {/* Share success */}
        {shareSuccess && (
          <div className="mb-4 px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm text-center">
            Copié dans le presse-papier !
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleShare}
            className="w-full py-3 bg-accent text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-accent/90 transition"
          >
            <Share2 className="w-4 h-4" /> Partager
          </button>
          <Link
            href="/envies"
            className="w-full py-3 bg-primary-50 text-primary rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-primary-100 transition"
          >
            <Heart className="w-4 h-4" /> Voir Mes souhaits
          </Link>
          <button
            onClick={onClose}
            className="w-full py-3 text-primary-500 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-primary-50 transition"
          >
            <Compass className="w-4 h-4" /> Continuer à explorer
          </button>
        </div>
      </div>
    </div>
  );
}
