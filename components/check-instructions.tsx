'use client';

import { MapPin, Mail } from 'lucide-react';

interface CheckInstructionsProps {
  amount: number;
  paymentReference: string;
  childName: string;
  stayName: string;
  onClose: () => void;
}

export function CheckInstructions({
  amount,
  paymentReference,
  childName,
  stayName,
  onClose,
}: CheckInstructionsProps) {
  const checkAddress =
    process.env.NEXT_PUBLIC_CHECK_ADDRESS ||
    'Groupe & Découverte\n123 Rue Example\n75001 Paris';

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 border-l-4 border-gray-500 p-4 rounded-r-xl">
        <p className="text-sm text-gray-700 font-medium">
          ⏱️ Votre réservation sera confirmée sous 5-7 jours après réception du chèque
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-primary text-lg">Instructions de paiement par chèque</h3>

        {/* Montant */}
        <div className="bg-primary-50 p-4 rounded-xl border-2 border-primary-200">
          <div className="text-xs font-bold text-primary-600 uppercase mb-2">
            Montant du chèque
          </div>
          <div className="text-2xl font-bold text-primary">{amount} €</div>
        </div>

        {/* Ordre du chèque */}
        <div className="bg-gray-50 p-4 rounded-xl">
          <div className="text-xs font-bold text-gray-500 uppercase mb-2">
            À l'ordre de
          </div>
          <div className="text-lg font-bold text-gray-900">Groupe & Découverte</div>
        </div>

        {/* Dos du chèque */}
        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
          <div className="flex items-start gap-2">
            <Mail className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-yellow-700 uppercase mb-1">
                Au dos du chèque, indiquez :
              </div>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• Référence : <span className="font-mono font-bold">{paymentReference}</span></li>
                <li>• Enfant : <span className="font-bold">{childName}</span></li>
                <li>• Séjour : <span className="font-bold">{stayName}</span></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Adresse postale */}
        <div className="bg-white p-4 rounded-xl border-2 border-gray-200">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase mb-2">
                Adresse d'envoi
              </div>
              <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                {checkAddress}
              </div>
            </div>
          </div>
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
