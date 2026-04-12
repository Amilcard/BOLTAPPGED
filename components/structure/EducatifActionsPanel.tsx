'use client';

import React, { useMemo } from 'react';
import { ClipboardList, Phone, AlertCircle, FileCheck } from 'lucide-react';
import type { ChildCardInscription } from './ChildCard';

interface Call { id: string; inscription_id: string; created_at: string; }
interface Incident { id: string; inscription_id: string; severity: string; status: string; }

interface Props {
  inscriptions: ChildCardInscription[];
  calls: Call[];
  incidents: Incident[];
  onSelectEnfant: (id: string) => void;
}

interface Action {
  id: string;
  inscriptionId: string;
  enfantNom: string;
  type: 'fiche' | 'appel' | 'evenement' | 'validation';
  label: string;
  priorite: 0 | 1 | 2;
}

const PRIORITE_STYLES: Record<number, string> = {
  0: 'border-l-red-500 bg-red-50',
  1: 'border-l-amber-400 bg-amber-50',
  2: 'border-l-blue-300 bg-blue-50',
};

const TYPE_ICONS = {
  fiche: FileCheck,
  appel: Phone,
  evenement: AlertCircle,
  validation: ClipboardList,
};

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

const EducatifActionsPanel = React.memo(function EducatifActionsPanel({
  inscriptions, calls, incidents, onSelectEnfant,
}: Props) {
  const actions = useMemo(() => {
    const result: Action[] = [];

    inscriptions.forEach(ins => {
      const nom = `${ins.jeune_prenom} ${ins.jeune_nom.charAt(0)}.`;

      // P1 : Fiche incomplete
      const d = ins.dossier_completude;
      const score = d ? [d.bulletin, d.sanitaire, d.liaison, d.renseignements].filter(Boolean).length : 0;
      if (score < 4) {
        result.push({
          id: `fiche-${ins.id}`, inscriptionId: ins.id, enfantNom: nom,
          type: 'fiche', label: `Completer fiche (${score}/4)`, priorite: 1,
        });
      }

      // P1 : Statut en attente
      if (ins.status === 'en_attente') {
        result.push({
          id: `valid-${ins.id}`, inscriptionId: ins.id, enfantNom: nom,
          type: 'validation', label: 'Inscription en attente', priorite: 1,
        });
      }

      // P2 : Pas d'appel trace depuis 7 jours
      const insAppels = calls.filter(c => c.inscription_id === ins.id);
      const dernierAppel = insAppels.length > 0 ? insAppels.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] : null;
      if (!dernierAppel || daysSince(dernierAppel.created_at) > 7) {
        result.push({
          id: `appel-${ins.id}`, inscriptionId: ins.id, enfantNom: nom,
          type: 'appel', label: dernierAppel ? `Dernier appel il y a ${daysSince(dernierAppel.created_at)}j` : 'Aucun appel trace', priorite: 2,
        });
      }

      // P0 : Evenement urgent ouvert
      const urgents = incidents.filter(e =>
        e.inscription_id === ins.id && e.severity === 'urgent' && e.status === 'ouvert'
      );
      urgents.forEach(e => {
        result.push({
          id: `evt-${e.id}`, inscriptionId: ins.id, enfantNom: nom,
          type: 'evenement', label: 'Evenement urgent', priorite: 0,
        });
      });
    });

    return result.sort((a, b) => a.priorite - b.priorite);
  }, [inscriptions, calls, incidents]);

  if (actions.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
        <p className="text-sm text-green-700 font-medium">Aucune action en attente</p>
        <p className="text-xs text-green-600 mt-1">Tous les suivis sont a jour</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-700">
        Actions a faire ({actions.length})
      </h4>
      {actions.map(action => {
        const Icon = TYPE_ICONS[action.type];
        return (
          <button
            key={action.id}
            onClick={() => onSelectEnfant(action.inscriptionId)}
            className={`w-full text-left p-3 rounded-lg border-l-4 flex items-center justify-between gap-3 hover:shadow-sm transition ${PRIORITE_STYLES[action.priorite]}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Icon className="w-4 h-4 flex-shrink-0 text-gray-500" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{action.enfantNom}</p>
                <p className="text-xs text-gray-600 truncate">{action.label}</p>
              </div>
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">Voir</span>
          </button>
        );
      })}
    </div>
  );
});

export default EducatifActionsPanel;
