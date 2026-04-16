'use client';

import React from 'react';
import { FileText, Phone, AlertCircle } from 'lucide-react';
import { getDemoNow } from '@/lib/demo-date';

interface DossierCompletude {
  bulletin: boolean;
  sanitaire: boolean;
  liaison: boolean;
  renseignements: boolean;
}

export interface ChildCardInscription {
  id: string;
  suivi_token?: string;
  jeune_prenom: string;
  jeune_nom: string;
  referent_nom: string;
  sejour_titre: string;
  sejour_slug: string;
  session_date?: string | null;
  session_end_date?: string | null;
  status: string;
  besoins_specifiques?: string | null;
  dossier_completude: DossierCompletude | null;
}

interface Props {
  inscription: ChildCardInscription;
  selected: boolean;
  onSelect: (id: string) => void;
  canWrite: boolean;
  onAddNote?: (inscriptionId: string) => void;
  onAddAppel?: (inscriptionId: string) => void;
  onAddEvenement?: (inscriptionId: string) => void;
  hasUrgentEvent?: boolean;
  medicalCount?: number;
  ragStatus?: 'rouge' | 'amber' | 'vert';
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  validee:    { label: 'En s\u00e9jour',   color: 'text-green-700', bg: 'bg-green-100' },
  en_attente: { label: 'En attente',  color: 'text-amber-700', bg: 'bg-amber-100' },
  refusee:    { label: 'Non retenu',  color: 'text-gray-600',  bg: 'bg-gray-100' },
  annulee:    { label: 'Annule',      color: 'text-gray-600',  bg: 'bg-gray-100' },
};

function fichesScore(d: DossierCompletude | null): number {
  if (!d) return 0;
  return [d.bulletin, d.sanitaire, d.liaison, d.renseignements].filter(Boolean).length;
}

const RAG_DOT: Record<'rouge' | 'amber' | 'vert', string> = {
  rouge: 'bg-red-500',
  amber: 'bg-amber-400',
  vert:  'bg-green-500',
};

const ChildCard = React.memo(function ChildCard({
  inscription: ins,
  selected,
  onSelect,
  canWrite,
  onAddNote,
  onAddAppel,
  onAddEvenement,
  hasUrgentEvent,
  medicalCount,
  ragStatus,
}: Props) {
  const score = fichesScore(ins.dossier_completude);
  const status = STATUS_MAP[ins.status] || STATUS_MAP.en_attente;
  const scoreColor = score === 4 ? 'text-green-600 bg-green-50' : score >= 2 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';

  // Countdown label
  const countdownLabel = (() => {
    if (!ins.session_date) return null;
    const today = getDemoNow();
    today.setHours(0, 0, 0, 0);
    const start = new Date(ins.session_date);
    start.setHours(0, 0, 0, 0);
    const diffStart = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffStart > 0) return `D\u00e9part dans ${diffStart}j`;
    if (!ins.session_end_date) return `En s\u00e9jour — J+${Math.abs(diffStart)}`;
    const end = new Date(ins.session_end_date);
    end.setHours(0, 0, 0, 0);
    const diffEnd = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffEnd < 0) return `Termin\u00e9 le ${end.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`;
    if (diffEnd <= 2) return `Retour dans ${diffEnd}j`;
    return `En s\u00e9jour — J+${Math.abs(diffStart)}`;
  })();

  return (
    <button
      onClick={() => onSelect(ins.id)}
      className={`relative w-full text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${
        selected
          ? 'border-primary bg-blue-50/50 shadow-card'
          : 'border-gray-100 bg-white hover:border-gray-200'
      }`}
    >
      {ragStatus && (
        <span
          className={`absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full ${RAG_DOT[ragStatus]}`}
          title={ragStatus === 'rouge' ? 'Incident urgent ouvert' : ragStatus === 'amber' ? 'Incident en attention' : 'Aucun incident ouvert'}
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{ins.jeune_prenom} {ins.jeune_nom.charAt(0)}.</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.bg} ${status.color}`}>
              {status.label}
            </span>
            {hasUrgentEvent && (
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse-subtle flex-shrink-0" title="Evenement urgent" />
            )}
            {(medicalCount ?? 0) > 0 && (
              <span className="text-xs text-blue-600 font-medium" title="Evenement medical actif">
                Md
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1 truncate">{ins.sejour_titre}</p>
          {countdownLabel && <p className="text-[11px] text-primary-400 mt-0.5">{countdownLabel}</p>}
          <p className="text-xs text-gray-400 mt-0.5">Ref. {ins.referent_nom}</p>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${scoreColor}`}>
          {score}/4
        </span>
      </div>

      {ins.besoins_specifiques && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-2 truncate">
          {ins.besoins_specifiques}
        </p>
      )}

      {canWrite && selected && (
        <div className="flex gap-1 mt-3 pt-2 border-t border-gray-100">
          {onAddNote && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddNote(ins.id); }}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition"
              title="Ajouter une note"
            >
              <FileText className="w-4 h-4" />
            </button>
          )}
          {onAddAppel && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddAppel(ins.id); }}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition"
              title="Tracer un appel"
            >
              <Phone className="w-4 h-4" />
            </button>
          )}
          {onAddEvenement && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddEvenement(ins.id); }}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition"
              title="Signaler un evenement"
            >
              <AlertCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </button>
  );
});

export default ChildCard;
