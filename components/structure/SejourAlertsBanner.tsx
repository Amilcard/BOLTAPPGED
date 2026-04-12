'use client';

import React, { useState } from 'react';
import { AlertOctagon, Phone, Eye, CheckCircle } from 'lucide-react';

interface UrgentIncident {
  id: string;
  inscription_id: string;
  enfant_nom: string;
  category: string;
  titre?: string | null;
  description: string;
  created_by: string;
  created_at: string;
  vu_at?: string | null;
  vu_by_code?: string | null;
}

interface Props {
  incidents: UrgentIncident[];
  structureCode: string;
  onCall?: (inscriptionId: string) => void;
  onVu?: (incidentId: string) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'Il y a moins d\'1h';
  if (hours < 24) return `Il y a ${hours}h`;
  return `Il y a ${Math.floor(hours / 24)}j`;
}

const SejourAlertsBanner = React.memo(function SejourAlertsBanner({
  incidents,
  structureCode,
  onCall,
  onVu,
}: Props) {
  const [loadingVu, setLoadingVu] = useState<string | null>(null);
  const [vuDone, setVuDone] = useState<Set<string>>(new Set());

  if (incidents.length === 0) return null;

  async function handleVu(incidentId: string) {
    setLoadingVu(incidentId);
    try {
      await fetch(`/api/structure/${structureCode}/incidents`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id: incidentId, action: 'vu' }),
      });
      setVuDone(prev => new Set(prev).add(incidentId));
      onVu?.(incidentId);
    } catch {
      // silencieux — l'alerte reste visible
    } finally {
      setLoadingVu(null);
    }
  }

  return (
    <div className="sticky top-0 z-30 space-y-2">
      {incidents.map(inc => {
        const isVu = !!inc.vu_at || vuDone.has(inc.id);
        return (
          <div
            key={inc.id}
            className={`border-2 rounded-xl p-4 ${isVu ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-300 animate-pulse-subtle'}`}
          >
            <div className="flex items-start gap-3">
              <AlertOctagon className={`w-6 h-6 flex-shrink-0 mt-0.5 ${isVu ? 'text-orange-500' : 'text-red-600'}`} />
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm ${isVu ? 'text-orange-900' : 'text-red-900'}`}>
                  {inc.titre || `ALERTE URGENTE — ${inc.enfant_nom}`}
                </p>
                <p className={`text-sm mt-1 ${isVu ? 'text-orange-800' : 'text-red-800'}`}>
                  {inc.description}
                </p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className={`text-xs ${isVu ? 'text-orange-600' : 'text-red-600'}`}>
                    Signalé par {inc.created_by} — {timeAgo(inc.created_at)}
                  </span>
                  {isVu && (
                    <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
                      <CheckCircle className="w-3 h-3" />
                      Vu{inc.vu_by_code ? ` par ${inc.vu_by_code}` : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                {!isVu && (
                  <button
                    onClick={() => handleVu(inc.id)}
                    disabled={loadingVu === inc.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-300 text-red-700 rounded-lg text-xs font-medium hover:bg-red-50 transition disabled:opacity-50"
                  >
                    <Eye className="w-3 h-3" />
                    Marquer vu
                  </button>
                )}
                {onCall && (
                  <button
                    onClick={() => onCall(inc.inscription_id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition"
                  >
                    <Phone className="w-3 h-3" />
                    Appeler
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default SejourAlertsBanner;
