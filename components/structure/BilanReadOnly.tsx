'use client';

import React from 'react';
import { AlertTriangle, Phone, FileText, ClipboardCheck, Send } from 'lucide-react';

interface Incident {
  id: string;
  inscription_id: string;
  category: string;
  severity: string;
  status: string;
  titre?: string | null;
  description: string;
  created_at: string;
  vu_at?: string | null;
  resolution_note?: string | null;
}

interface Call {
  id: string;
  inscription_id: string;
  call_type: string;
  direction: string;
  resume: string;
  created_at: string;
}

interface Note {
  id: string;
  inscription_id: string;
  content: string;
  created_by: string;
  created_at: string;
}

interface Inscription {
  id: string;
  jeune_prenom: string;
  jeune_nom: string;
  sejour_titre: string;
  session_date?: string | null;
  session_end_date?: string | null;
  status: string;
}

function relative(target: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  const diff = Math.ceil((t.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return 'demain';
  if (diff > 0) return `dans ${diff}j`;
  return `il y a ${Math.abs(diff)}j`;
}

interface Props {
  inscriptions: Inscription[];
  incidents: Incident[];
  calls?: Call[];
  notes?: Note[];
}

const SEVERITY_STYLES: Record<string, string> = {
  info:      'text-gray-600',
  attention: 'text-amber-600',
  urgent:    'text-red-600 font-medium',
};

function fmt(iso: string) {
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return iso; }
}

const BilanReadOnly = React.memo(function BilanReadOnly({ inscriptions, incidents, calls = [], notes = [] }: Props) {
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
      <h4 className="text-sm font-semibold text-gray-700">Bilan sejours — suivi terrain</h4>

      {enSejour.map(ins => {
        const insIncidents = incidents.filter(e => e.inscription_id === ins.id);
        const insCalls     = calls.filter(c => c.inscription_id === ins.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
        const insNotes     = notes.filter(n => n.inscription_id === ins.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
        const hasUrgent    = insIncidents.some(e => e.severity === 'urgent' && e.status === 'ouvert');

        // Logique bilan intelligente — cohérence métier protection enfance
        const sessionStart = ins.session_date ? new Date(ins.session_date) : null;
        const sessionEnd = ins.session_end_date ? new Date(ins.session_end_date) : null;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const sejourPasCommence = sessionStart && now < sessionStart;
        const sejourTermine = sessionEnd && now > sessionEnd;

        // Ignorer les appels bilan antérieurs au début du séjour (incohérents)
        const bilanCall = insCalls.find(c =>
          (c.call_type === 'bilan' || c.resume?.toLowerCase().includes('bilan') || c.resume?.toLowerCase().includes('cadre'))
          && (!sessionStart || new Date(c.created_at) >= sessionStart)
        );
        const bilanDate = bilanCall ? fmt(bilanCall.created_at) : null;

        const bilanDeadline = sessionStart ? new Date(sessionStart.getTime() + 5 * 24 * 60 * 60 * 1000) : null;
        const suiviJ3 = sessionStart ? new Date(sessionStart.getTime() + 3 * 24 * 60 * 60 * 1000) : null;
        const isSuiviEnCours = sessionStart && !sejourPasCommence && suiviJ3 && now < suiviJ3 && !bilanDate;
        const isEnRetard = bilanDeadline && !bilanDate && !isSuiviEnCours && now > bilanDeadline;

        return (
          <div key={ins.id} className={`rounded-xl border p-4 ${hasUrgent ? 'border-red-200 bg-red-50/50' : 'border-gray-100 bg-white'}`}>
            {/* En-tête enfant */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <p className="font-medium text-gray-900 text-sm">{ins.jeune_prenom} {ins.jeune_nom.charAt(0)}.</p>
                <p className="text-xs text-gray-500">{ins.sejour_titre}</p>
              </div>
              {/* Bilan intelligent */}
              {sejourTermine && bilanDate ? (
                <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1 flex-shrink-0">
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs font-medium text-blue-700">Bilan final envoye le {bilanDate}</span>
                </div>
              ) : sejourTermine ? (
                <div className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1 flex-shrink-0">
                  <ClipboardCheck className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs font-medium text-gray-600">Termine — bilan final attendu</span>
                </div>
              ) : bilanDate ? (
                <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1 flex-shrink-0">
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs font-medium text-blue-700">Envoye le {bilanDate}</span>
                </div>
              ) : sejourPasCommence ? (
                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 flex-shrink-0">
                  <ClipboardCheck className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-medium text-gray-500">Non debute</span>
                </div>
              ) : isSuiviEnCours ? (
                <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1 flex-shrink-0">
                  <ClipboardCheck className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-xs font-medium text-green-700">Suivi en cours</span>
                </div>
              ) : isEnRetard ? (
                <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1 flex-shrink-0">
                  <ClipboardCheck className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-xs font-medium text-red-700">En retard ({bilanDeadline ? relative(bilanDeadline) : ''})</span>
                </div>
              ) : bilanDeadline ? (
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 flex-shrink-0">
                  <ClipboardCheck className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-amber-700">A transmettre avant le {fmt(bilanDeadline.toISOString())} ({relative(bilanDeadline)})</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 flex-shrink-0">
                  <ClipboardCheck className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-amber-700">Bilan intermediaire a transmettre</span>
                </div>
              )}
            </div>

            {/* Suivi terrain masqué si séjour pas commencé ou terminé */}
            {sejourPasCommence ? (
              <p className="text-xs text-gray-400 italic">Sejour non debute — aucune activite a afficher.</p>
            ) : sejourTermine ? (
              <p className="text-xs text-gray-400 italic">Sejour termine le {sessionEnd ? fmt(sessionEnd.toISOString()) : ''}. {bilanDate ? 'Bilan transmis.' : 'Bilan final en attente.'}</p>
            ) : (<>
            {/* Evenements */}
            {insIncidents.length > 0 && (
              <div className="space-y-1 mb-3">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Faits marquants</p>
                {insIncidents.slice(0, 3).map(e => (
                  <div key={e.id} className="flex items-start gap-2">
                    <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${SEVERITY_STYLES[e.severity] || 'text-gray-400'}`} />
                    <p className={`text-xs ${SEVERITY_STYLES[e.severity] || 'text-gray-600'}`}>
                      {e.description.length > 90 ? e.description.slice(0, 90) + '…' : e.description}
                      <span className="text-gray-400 ml-1">— {fmt(e.created_at)}</span>
                    </p>
                  </div>
                ))}
                {insIncidents.length > 3 && (
                  <p className="text-xs text-gray-400 pl-5">+{insIncidents.length - 3} autre{insIncidents.length - 3 > 1 ? 's' : ''}</p>
                )}
              </div>
            )}

            {/* Appels terrain */}
            {insCalls.length > 0 && (
              <div className="space-y-1 mb-3">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Appels & echanges</p>
                {insCalls.slice(0, 2).map(c => (
                  <div key={c.id} className="flex items-start gap-2">
                    <Phone className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-400" />
                    <p className="text-xs text-gray-600">
                      {c.resume.length > 90 ? c.resume.slice(0, 90) + '…' : c.resume}
                      <span className="text-gray-400 ml-1">— {fmt(c.created_at)}</span>
                    </p>
                  </div>
                ))}
                {insCalls.length > 2 && (
                  <p className="text-xs text-gray-400 pl-5">+{insCalls.length - 2} autre{insCalls.length - 2 > 1 ? 's' : ''}</p>
                )}
              </div>
            )}

            {/* Notes terrain */}
            {insNotes.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Notes educatives</p>
                {insNotes.slice(0, 2).map(n => (
                  <div key={n.id} className="flex items-start gap-2">
                    <FileText className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-violet-400" />
                    <p className="text-xs text-gray-600">
                      {n.content.length > 90 ? n.content.slice(0, 90) + '…' : n.content}
                      <span className="text-gray-400 ml-1">— {fmt(n.created_at)}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Aucun element terrain */}
            {insIncidents.length === 0 && insCalls.length === 0 && insNotes.length === 0 && (
              <p className="text-xs text-gray-400 italic">Aucun element terrain enregistre — veuillez documenter le suivi.</p>
            )}
            </>)}
          </div>
        );
      })}
    </div>
  );
});

export default BilanReadOnly;
