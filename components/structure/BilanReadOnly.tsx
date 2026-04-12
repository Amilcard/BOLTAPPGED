'use client';

import React from 'react';
import { ClipboardCheck, AlertTriangle, CheckCircle } from 'lucide-react';

interface Incident {
  id: string;
  inscription_id: string;
  category: string;
  severity: string;
  status: string;
  description: string;
  created_at: string;
}

interface Inscription {
  id: string;
  jeune_prenom: string;
  jeune_nom: string;
  sejour_titre: string;
  status: string;
}

interface Props {
  inscriptions: Inscription[];
  incidents: Incident[];
}

const SEVERITY_STYLES: Record<string, string> = {
  info:      'text-gray-600',
  attention: 'text-amber-600',
  urgent:    'text-red-600 font-medium',
};

const BilanReadOnly = React.memo(function BilanReadOnly({ inscriptions, incidents }: Props) {
  const enSejour = inscriptions.filter(i => i.status === 'validee');

  if (enSejour.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-sm text-gray-500">Aucun enfant en sejour actuellement.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-700">Bilan sejours</h4>

      {enSejour.map(ins => {
        const insIncidents = incidents.filter(e => e.inscription_id === ins.id);
        const hasUrgent = insIncidents.some(e => e.severity === 'urgent' && e.status === 'ouvert');

        return (
          <div key={ins.id} className={`rounded-xl border p-4 ${hasUrgent ? 'border-red-200 bg-red-50/50' : 'border-gray-100 bg-white'}`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div>
                <p className="font-medium text-gray-900 text-sm">{ins.jeune_prenom} {ins.jeune_nom.charAt(0)}.</p>
                <p className="text-xs text-gray-500">{ins.sejour_titre}</p>
              </div>
              {insIncidents.length === 0 ? (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-xs font-medium">RAS</span>
                </div>
              ) : (
                <span className="text-xs font-medium text-amber-600">
                  {insIncidents.length} evenement{insIncidents.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {insIncidents.length > 0 && (
              <div className="space-y-1 mt-2 pt-2 border-t border-gray-100">
                {insIncidents.slice(0, 3).map(e => (
                  <div key={e.id} className="flex items-start gap-2">
                    <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${SEVERITY_STYLES[e.severity] || 'text-gray-400'}`} />
                    <p className={`text-xs ${SEVERITY_STYLES[e.severity] || 'text-gray-600'}`}>
                      {e.description.length > 80 ? e.description.slice(0, 80) + '...' : e.description}
                    </p>
                  </div>
                ))}
                {insIncidents.length > 3 && (
                  <p className="text-xs text-gray-400 pl-5">+{insIncidents.length - 3} autre{insIncidents.length - 3 > 1 ? 's' : ''}</p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Message reassurance */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center mt-4">
        <ClipboardCheck className="h-8 w-8 text-blue-400 mx-auto mb-2" />
        <p className="text-sm text-blue-800 font-medium">Bilan complet en preparation</p>
        <p className="text-xs text-blue-600 mt-1">
          Le bilan detaille (respect du cadre, participation, relations, autonomie)
          sera complete par l'equipe sejour et transmis dans les delais prevus.
        </p>
      </div>
    </div>
  );
});

export default BilanReadOnly;
