'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useApp } from './providers';
import { Users, Mail, ArrowRight, Building2, KeyRound, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface ProGateModalProps {
  open: boolean;
  onClose: () => void;
  variant: 'kids-block' | 'pro-verify' | 'pro-auth';
  /** Slug du séjour — utilisé pour redirect après auth pro */
  sejourSlug?: string;
  /** Paramètres de session/ville pré-sélectionnés */
  reserverParams?: string;
  /** Callback appelé après auth réussie — remplace le redirect si fourni */
  onAuthSuccess?: () => void;
}

export function ProGateModal({ open, onClose, variant, sejourSlug, reserverParams, onAuthSuccess }: ProGateModalProps) {
  const router = useRouter();
  const { setMode, setProEmailVerified } = useApp();
  const [email, setEmail] = useState('');
  const [structureCode, setStructureCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'code' | 'no-code'>('code');

  const handleSubmitEmail = () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setError('Veuillez saisir un email professionnel valide.');
      return;
    }
    setProEmailVerified(trimmed);
    setMode('pro');
    onClose();
  };

  const handleProAuth = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setError('Veuillez saisir un email professionnel valide.');
      return;
    }
    const codeNorm = structureCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(codeNorm)) {
      setError('Le code structure doit contenir 6 caractères (lettres et chiffres).');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/pro-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, structureCode: codeNorm }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data?.error?.code === 'CODE_INVALIDE') {
          setError('Code structure invalide. Vérifiez auprès de votre responsable.');
        } else if (data?.error?.code === 'CODE_EXPIRED') {
          setError('Ce code a expiré. Contactez votre référent GED.');
        } else if (data?.error?.code === 'RATE_LIMITED') {
          setError('Trop de tentatives. Réessayez dans 5 minutes.');
        } else {
          setError(data?.error?.message || 'Erreur de connexion.');
        }
        return;
      }

      // Succès — cookie posé automatiquement
      setProEmailVerified(trimmedEmail);
      setMode('pro');
      onClose();

      if (onAuthSuccess) {
        onAuthSuccess();
      } else if (sejourSlug) {
        const params = reserverParams ? `?${reserverParams}` : '';
        router.push(`/sejour/${sejourSlug}/reserver${params}`);
      }
    } catch {
      setError('Erreur réseau. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  };

  // ── Variant kids-block (existant) ──
  if (variant === 'kids-block') {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader className="items-center">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-2">
              <Users className="w-6 h-6 text-accent" />
            </div>
            <DialogTitle className="text-lg">Espace réservé aux pros</DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mt-2 leading-relaxed">
              Cet espace est réservé aux professionnels.
              <br />
              <span className="font-medium text-gray-800">Tu cherches une colo ? Tu es au bon endroit.</span>
            </DialogDescription>
          </DialogHeader>

          <div className="border-t border-gray-100 pt-4 mt-2 space-y-3">
            <p className="text-xs text-gray-500 font-medium">Vous êtes un professionnel ?</p>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                placeholder="votre.email@structure.fr"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitEmail()}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>
            {error && <p className="text-xs text-red-500" role="alert">{error}</p>}
            <p className="text-[11px] text-gray-400">
              Votre email est utilisé uniquement pour vous identifier en tant que professionnel. Il n&apos;est ni partagé ni utilisé à des fins commerciales.
            </p>
            <Button onClick={handleSubmitEmail} className="w-full" size="sm">
              Accéder à l&apos;espace pro
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          <button
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1"
          >
            Rester en mode Kids
          </button>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Variant pro-verify (existant, inchangé) ──
  if (variant === 'pro-verify') {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-lg">Accès tarifs professionnels</DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mt-2 leading-relaxed">
              Vous êtes professionnel de la protection de l&apos;enfance ?
              <br />
              Un email suffit pour accéder aux tarifs détaillés.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                placeholder="votre.email@structure.fr"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitEmail()}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>
            {error && <p className="text-xs text-red-500" role="alert">{error}</p>}
            <Button onClick={handleSubmitEmail} className="w-full">
              Voir les tarifs détaillés
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Variant pro-auth (NOUVEAU — auth par code structure) ──
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle className="text-lg">Espace professionnel</DialogTitle>
          <DialogDescription className="text-sm text-gray-600 mt-1">
            Pour inscrire un enfant, identifiez-vous avec votre code structure.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div role="tablist" aria-label="Type d'accès" className="flex border-b border-gray-200 mt-2">
          <button
            role="tab"
            aria-selected={tab === 'code'}
            aria-controls="tab-panel-code"
            id="tab-code"
            onClick={() => { setTab('code'); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'code' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <KeyRound className="w-4 h-4 inline mr-1.5" aria-hidden="true" />
            J&apos;ai un code
          </button>
          <button
            role="tab"
            aria-selected={tab === 'no-code'}
            aria-controls="tab-panel-no-code"
            id="tab-no-code"
            onClick={() => { setTab('no-code'); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'no-code' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Pas encore de code
          </button>
        </div>

        {tab === 'code' ? (
          <div role="tabpanel" id="tab-panel-code" aria-labelledby="tab-code" className="space-y-3 mt-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email professionnel</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  placeholder="votre.email@structure.fr"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Code structure (6 caractères)</label>
              <input
                type="text"
                placeholder="Ex : AB12CD"
                value={structureCode}
                onChange={(e) => { setStructureCode(e.target.value.toUpperCase()); setError(''); }}
                maxLength={6}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-mono tracking-widest text-center uppercase focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Ce code vous a été communiqué par votre structure ou par GED.
              </p>
            </div>

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {error}
              </div>
            )}

            <p className="text-[11px] text-gray-400">
              Vos données sont traitées conformément à notre{' '}
              <Link href="/confidentialite" target="_blank" className="underline">politique de confidentialité</Link>.
            </p>

            <Button
              onClick={handleProAuth}
              disabled={loading || !email || (structureCode.length !== 6 && structureCode.length !== 10)}
              className="w-full"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
              {loading ? 'Vérification...' : 'Accéder et inscrire'}
            </Button>
          </div>
        ) : (
          <div role="tabpanel" id="tab-panel-no-code" aria-labelledby="tab-no-code" className="space-y-4 mt-3">
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-sm text-blue-800 font-medium mb-1">
                Votre structure n&apos;est pas encore enregistrée ?
              </p>
              <p className="text-xs text-blue-700">
                Faites une demande d&apos;accès — nous vous recontactons sous 24h avec vos identifiants.
              </p>
            </div>
            <Button
              onClick={() => {
                onClose();
                router.push(`/acceder-pro${sejourSlug ? `?sejour=${sejourSlug}` : ''}`);
              }}
              variant="outline"
              className="w-full"
            >
              Demander un accès professionnel
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
