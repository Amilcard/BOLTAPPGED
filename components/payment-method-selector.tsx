'use client';

import { CreditCard, Building2, Mail } from 'lucide-react';

interface PaymentMethodSelectorProps {
  onSelectStripe: () => void;
  onSelectTransfer: () => void;
  onSelectCheck: () => void;
}

export function PaymentMethodSelector({
  onSelectStripe,
  onSelectTransfer,
  onSelectCheck,
}: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-primary mb-4">
        Choisissez votre mode de paiement
      </h3>

      {/* Stripe - Paiement en ligne */}
      <button
        onClick={onSelectStripe}
        className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-primary hover:bg-primary-50 transition-all group"
      >
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
          <CreditCard className="w-6 h-6 text-primary group-hover:text-white" />
        </div>
        <div className="flex-1 text-left">
          <div className="font-bold text-gray-900">Paiement sécurisé en ligne</div>
          <div className="text-sm text-gray-500">Carte bancaire via Stripe</div>
        </div>
        <div className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
          Immédiat
        </div>
      </button>

      {/* Virement bancaire */}
      <button
        onClick={onSelectTransfer}
        className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-primary hover:bg-primary-50 transition-all group"
      >
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
          <Building2 className="w-6 h-6 text-primary group-hover:text-white" />
        </div>
        <div className="flex-1 text-left">
          <div className="font-bold text-gray-900">Virement bancaire</div>
          <div className="text-sm text-gray-500">Délai : 2-3 jours ouvrés</div>
        </div>
        <div className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">
          2-3 jours
        </div>
      </button>

      {/* Chèque */}
      <button
        onClick={onSelectCheck}
        className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-primary hover:bg-primary-50 transition-all group"
      >
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
          <Mail className="w-6 h-6 text-primary group-hover:text-white" />
        </div>
        <div className="flex-1 text-left">
          <div className="font-bold text-gray-900">Paiement par chèque</div>
          <div className="text-sm text-gray-500">Délai : 5-7 jours ouvrés</div>
        </div>
        <div className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-full">
          5-7 jours
        </div>
      </button>
    </div>
  );
}
