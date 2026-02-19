'use client';

import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface TransferInstructionsProps {
  amount: number;
  paymentReference: string;
  onClose: () => void;
}

export function TransferInstructions({
  amount,
  paymentReference,
  onClose,
}: TransferInstructionsProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const iban = process.env.NEXT_PUBLIC_IBAN || 'FR76XXXXXXXXXXXXXXXXX';
  const bic = process.env.NEXT_PUBLIC_BIC || 'XXXXXXX';

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-xl">
        <p className="text-sm text-orange-800 font-medium">
          ⏱️ Votre réservation sera confirmée sous 2-3 jours après réception du virement
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-primary text-lg">Coordonnées bancaires</h3>

        {/* IBAN */}
        <div className="bg-gray-50 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">IBAN</span>
            <button
              onClick={() => copyToClipboard(iban, 'iban')}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary-600"
            >
              {copied === 'iban' ? (
                <>
                  <Check className="w-3 h-3" /> Copié
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" /> Copier
                </>
              )}
            </button>
          </div>
          <div className="font-mono text-sm font-bold text-gray-900">{iban}</div>
        </div>

        {/* BIC */}
        <div className="bg-gray-50 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">BIC</span>
            <button
              onClick={() => copyToClipboard(bic, 'bic')}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary-600"
            >
              {copied === 'bic' ? (
                <>
                  <Check className="w-3 h-3" /> Copié
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" /> Copier
                </>
              )}
            </button>
          </div>
          <div className="font-mono text-sm font-bold text-gray-900">{bic}</div>
        </div>

        {/* Montant */}
        <div className="bg-primary-50 p-4 rounded-xl border-2 border-primary-200">
          <div className="text-xs font-bold text-primary-600 uppercase mb-2">
            Montant exact à virer
          </div>
          <div className="text-2xl font-bold text-primary">{amount} €</div>
        </div>

        {/* Référence */}
        <div className="bg-red-50 p-4 rounded-xl border-2 border-red-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-red-600 uppercase">
              ⚠️ Référence obligatoire
            </span>
            <button
              onClick={() => copyToClipboard(paymentReference, 'ref')}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
            >
              {copied === 'ref' ? (
                <>
                  <Check className="w-3 h-3" /> Copié
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" /> Copier
                </>
              )}
            </button>
          </div>
          <div className="font-mono text-lg font-bold text-red-700">{paymentReference}</div>
          <p className="text-xs text-red-600 mt-2">
            Indiquez impérativement cette référence pour un traitement rapide
          </p>
        </div>
      </div>

      <div className="pt-4">
        <button
          onClick={onClose}
          className="w-full py-3 bg-primary text-white rounded-full font-bold hover:bg-primary-600 transition-colors"
        >
          J'ai noté les informations
        </button>
      </div>
    </div>
  );
}
