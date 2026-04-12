'use client';

import React from 'react';
import { AlertOctagon, Phone } from 'lucide-react';

interface UrgentIncident {
  id: string;
  inscription_id: string;
  enfant_nom: string;
  category: string;
  description: string;
  created_by: string;
  created_at: string;
}

interface Props {
  incidents: UrgentIncident[];
  onCall?: (inscriptionId: string) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'Il y a moins d\'1h';
  if (hours < 24) return `Il y a ${hours}h`;
  return `Il y a ${Math.floor(hours / 24)}j`;
}

const SejourAlertsBanner = React.memo(function SejourAlertsBanner({ incidents, onCall }: Props) {
  if (incidents.length === 0) return null;

  return (
    <div className="sticky top-0 z-30 space-y-2">
      {incidents.map(inc => (
        <div
          key={inc.id}
          className="bg-red-50 border-2 border-red-300 rounded-xl p-4 animate-pulse-subtle"
        >
          <div className="flex items-start gap-3">
            <AlertOctagon className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-red-900 text-sm">
                ALERTE URGENTE — {inc.enfant_nom}
              </p>
              <p className="text-sm text-red-800 mt-1">{inc.description}</p>
              <p className="text-xs text-red-600 mt-2">
                Signale par {inc.created_by} — {timeAgo(inc.created_at)}
              </p>
            </div>
            {onCall && (
              <button
                onClick={() => onCall(inc.inscription_id)}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition flex-shrink-0"
              >
                <Phone className="w-4 h-4" />
                Appeler
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
});

export default SejourAlertsBanner;
