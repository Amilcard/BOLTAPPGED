'use client';

import React, { useMemo } from 'react';
import { FileText, Phone, AlertTriangle, Heart, ArrowUpRight, ArrowDownLeft, Star } from 'lucide-react';

// ── Types ──

interface TimelineEvent {
  id: string;
  type: 'note' | 'appel' | 'evenement' | 'medical' | 'souhait';
  date: string;
  auteur: string;
  label: string;
  detail?: string;
  niveau?: 'info' | 'attention' | 'urgent';
  direction?: 'entrant' | 'sortant';
  status?: string;
}

interface Note { id: string; inscription_id: string; content: string; created_by: string; created_at: string; }
interface Appel { id: string; inscription_id: string; call_type: string; direction: string; interlocuteur: string; resume: string; created_by: string; created_at: string; }
interface Incident { id: string; inscription_id: string; category: string; severity: string; description: string; status: string; created_by: string; created_at: string; }
interface MedicalEvent { id: string; inscription_id: string; event_type: string; description: string; created_by: string; created_at: string; }

interface Souhait { id: string; kid_prenom: string; sejour_titre: string; motivation: string; status: string; created_at: string; }

interface Props {
  inscriptionId: string;
  enfantNom: string;
  notes: Note[];
  appels: Appel[];
  evenements: Incident[];
  medical: MedicalEvent[];
  souhaits?: Souhait[];
  showMedicalDetail: boolean; // false pour educateur (compteur seul)
}

// ── Config visuel ──

const TYPE_CONFIG = {
  note:      { icon: FileText,     color: 'text-gray-500',  bg: 'bg-gray-50',  border: 'border-l-gray-300',  label: 'Note' },
  appel:     { icon: Phone,        color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-l-emerald-400', label: 'Appel' },
  evenement: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-l-amber-400', label: 'Fait marquant' },
  souhait:   { icon: Star,         color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-l-violet-400', label: 'Souhait enfant' },
  medical:   { icon: Heart,        color: 'text-blue-600',  bg: 'bg-blue-50',  border: 'border-l-blue-400',  label: 'Medical' },
};

const NIVEAU_STYLES: Record<string, string> = {
  info:      '',
  attention: 'border-l-amber-500 bg-amber-50',
  urgent:    'border-l-red-500 bg-red-50 font-medium',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' +
         d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ── Composant ──

const ChildTimeline = React.memo(function ChildTimeline({
  inscriptionId, enfantNom, notes, appels, evenements, medical, souhaits = [], showMedicalDetail,
}: Props) {
  const timeline = useMemo(() => {
    const events: TimelineEvent[] = [];

    notes
      .filter(n => n.inscription_id === inscriptionId)
      .forEach(n => events.push({
        id: `note-${n.id}`, type: 'note', date: n.created_at,
        auteur: n.created_by, label: 'Note', detail: n.content,
      }));

    appels
      .filter(a => a.inscription_id === inscriptionId)
      .forEach(a => events.push({
        id: `appel-${a.id}`, type: 'appel', date: a.created_at,
        auteur: a.created_by, label: `Appel ${a.call_type.replace('_', ' ')}`,
        detail: a.resume, direction: a.direction as 'entrant' | 'sortant',
      }));

    evenements
      .filter(e => e.inscription_id === inscriptionId)
      .forEach(e => events.push({
        id: `evt-${e.id}`, type: 'evenement', date: e.created_at,
        auteur: e.created_by, label: `Evenement ${e.category}`,
        detail: e.description, niveau: e.severity as 'info' | 'attention' | 'urgent',
        status: e.status,
      }));

    // Souhaits enfants (parcours kids→pro)
    souhaits
      .filter(s => s.kid_prenom.toLowerCase() === enfantNom.split(' ')[0]?.toLowerCase())
      .forEach(s => events.push({
        id: `souhait-${s.id}`, type: 'souhait', date: s.created_at,
        auteur: s.kid_prenom,
        label: `Souhait — ${s.sejour_titre}`,
        detail: s.motivation,
        status: s.status === 'emis' ? 'À étudier' : s.status === 'vu' ? 'Vu par le référent' : s.status,
      }));

    if (showMedicalDetail) {
      medical
        .filter(m => m.inscription_id === inscriptionId)
        .forEach(m => events.push({
          id: `med-${m.id}`, type: 'medical', date: m.created_at,
          auteur: m.created_by, label: m.event_type, detail: m.description,
        }));
    }

    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [inscriptionId, notes, appels, evenements, medical, showMedicalDetail, enfantNom, souhaits]);

  if (timeline.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        Aucun evenement pour {enfantNom}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">
        Suivi {enfantNom} ({timeline.length})
      </h4>
      {timeline.map(evt => {
        const cfg = TYPE_CONFIG[evt.type];
        const Icon = cfg.icon;
        const niveauStyle = evt.niveau ? NIVEAU_STYLES[evt.niveau] || '' : '';

        return (
          <div
            key={evt.id}
            className={`border-l-4 rounded-lg p-3 ${niveauStyle || `${cfg.border} ${cfg.bg}`}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${cfg.color} flex-shrink-0`} />
              {evt.type === 'appel' && evt.direction && (
                evt.direction === 'entrant'
                  ? <ArrowDownLeft className="w-3 h-3 text-emerald-500" />
                  : <ArrowUpRight className="w-3 h-3 text-emerald-500" />
              )}
              <span className="text-xs font-medium text-gray-700">{evt.label}</span>
              {evt.status && evt.status !== 'ouvert' && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">{evt.status}</span>
              )}
              <span className="text-xs text-gray-400 ml-auto">{formatDate(evt.date)}</span>
            </div>
            {evt.detail && (
              <p className="text-sm text-gray-600 whitespace-pre-line pl-6">{evt.detail}</p>
            )}
            <p className="text-xs text-gray-400 pl-6 mt-1">{evt.auteur}</p>
          </div>
        );
      })}
    </div>
  );
});

export default ChildTimeline;
