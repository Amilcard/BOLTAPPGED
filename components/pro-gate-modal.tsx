'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useApp } from './providers';
import { Users, Mail, ArrowRight } from 'lucide-react';

interface ProGateModalProps {
  open: boolean;
  onClose: () => void;
  /** true = kid tried to toggle, false = pro wants email verification */
  variant: 'kids-block' | 'pro-verify';
}

export function ProGateModal({ open, onClose, variant }: ProGateModalProps) {
  const { setMode, setProEmailVerified } = useApp();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

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
            {error && <p className="text-xs text-red-500">{error}</p>}
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

  // variant === 'pro-verify'
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
            <br />
            <span className="font-medium text-gray-800">Pas de compte. Pas de formulaire. Juste une vérification.</span>
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
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button onClick={handleSubmitEmail} className="w-full">
            Voir les tarifs détaillés
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
