'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Users, AlertTriangle, Phone, PhoneCall, FileText, Heart, ClipboardList, Shield, Lock, ChevronRight } from 'lucide-react';
import IncidentsPanel from '@/components/structure/IncidentsPanel';
import MedicalSummary from '@/components/structure/MedicalSummary';
import CallsPanel from '@/components/structure/CallsPanel';
import NotesPanel from '@/components/structure/NotesPanel';
import ChildCard, { type ChildCardInscription } from '@/components/structure/ChildCard';
import CodeAccesBox from '@/components/structure/CodeAccesBox';
import ChildTimeline from '@/components/structure/ChildTimeline';
import EducatifActionsPanel from '@/components/structure/EducatifActionsPanel';
import SejourAlertsBanner from '@/components/structure/SejourAlertsBanner';
import BilanReadOnly from '@/components/structure/BilanReadOnly';

// ── Types ──────────────────────────────────────────────────────────────────

interface Inscription {
  id: string;
  suivi_token?: string;
  jeune_prenom: string;
  jeune_nom: string;
  referent_nom: string;
  sejour_titre: string;
  sejour_slug: string;
  status: string;
  besoins_specifiques?: string | null;
  dossier_completude: { bulletin: boolean; sanitaire: boolean; liaison: boolean; renseignements: boolean } | null;
}

interface SouhaitData {
  id: string;
  kid_prenom: string;
  sejour_titre: string;
  motivation: string;
  status: string;
  created_at: string;
}

interface Props {
  code: string;
  role: string | null;
  inscriptions: Inscription[];
  incidentCounts: Record<string, number>;
  callsCount: number;
  notesCount: number;
  medicalCount: number;
  souhaits?: SouhaitData[];
}

type Section = 'enfants' | 'incidents' | 'medical' | 'appels' | 'notes' | 'bilan' | null;

// ── Composant ──────────────────────────────────────────────────────────────

export default function StructureEduTab({
  code, role, inscriptions, incidentCounts,
  callsCount, notesCount, medicalCount, souhaits = [],
}: Props) {
  const [openSection, setOpenSection] = useState<Section>('enfants');
  const [selectedEnfant, setSelectedEnfant] = useState<string | null>(
    inscriptions.length > 0 ? inscriptions[0].id : null
  );

  // Timeline data (lazy loaded)
  const [notes, setNotes] = useState<Array<{ id: string; inscription_id: string; content: string; created_by: string; created_at: string }>>([]);
  const [calls, setCalls] = useState<Array<{ id: string; inscription_id: string; call_type: string; direction: string; interlocuteur: string; resume: string; created_by: string; created_at: string }>>([]);
  const [incidents, setIncidents] = useState<Array<{ id: string; inscription_id: string; category: string; severity: string; titre?: string | null; description: string; status: string; created_by: string; created_at: string; vu_at?: string | null; vu_by_code?: string | null }>>([]);
  const [medical, setMedical] = useState<Array<{ id: string; inscription_id: string; event_type: string; description: string; created_by: string; created_at: string }>>([]);
  const [timelineLoaded, setTimelineLoaded] = useState(false);

  const canWrite = role === 'direction' || role === 'cds' || role === 'cds_delegated';
  const showMedicalDetail = role === 'direction' || role === 'cds';

  const enfantsEnSejour = inscriptions.filter(i => i.status === 'validee');
  const totalIncidents = Object.values(incidentCounts).reduce((a, b) => a + b, 0);
  const enfantsAvecBesoins = inscriptions.filter(i => i.besoins_specifiques);
  const inscriptionsList = inscriptions.map(i => ({ id: i.id, jeune_prenom: i.jeune_prenom, jeune_nom: i.jeune_nom }));

  // Lazy load timeline data when enfants section opens
  const loadTimelineData = useCallback(async () => {
    if (timelineLoaded) return;
    try {
      const [notesRes, callsRes, incRes, medRes] = await Promise.all([
        fetch(`/api/structure/${code}/notes`),
        fetch(`/api/structure/${code}/calls`),
        fetch(`/api/structure/${code}/incidents`),
        fetch(`/api/structure/${code}/medical`),
      ]);
      if (notesRes.ok) { const d = await notesRes.json(); setNotes(d.notes || d || []); }
      if (callsRes.ok) { const d = await callsRes.json(); setCalls(d.calls || d || []); }
      if (incRes.ok) { const d = await incRes.json(); setIncidents(d.incidents || d || []); }
      if (medRes.ok) { const d = await medRes.json(); setMedical(d.detail || d.events || []); }
      setTimelineLoaded(true);
    } catch { /* silencieux — les panneaux individuels font aussi leur fetch */ }
  }, [code, timelineLoaded]);

  useEffect(() => {
    if (openSection === 'enfants' || openSection === 'bilan') {
      loadTimelineData();
    }
  }, [openSection, loadTimelineData]);

  // Urgent incidents pour le bandeau
  const urgentIncidents = incidents
    .filter(e => e.severity === 'urgent' && e.status === 'ouvert')
    .map(e => {
      const ins = inscriptions.find(i => i.id === e.inscription_id);
      return {
        ...e,
        enfant_nom: ins ? `${ins.jeune_prenom} ${ins.jeune_nom.charAt(0)}.` : 'Enfant',
      };
    });

  // Selected enfant data
  const selectedInscription = inscriptions.find(i => i.id === selectedEnfant);

  function toggle(section: Section) {
    setOpenSection(prev => prev === section ? null : section);
  }

  // ── KPI cards ──
  const kpiCards: Array<{
    key: Section; label: string; value: number | string; sub: string;
    icon: typeof Users; color: string; accent: string; ring: string;
    alert?: boolean; locked?: boolean;
  }> = [
    {
      key: 'enfants', label: 'Enfants en sejour',
      value: enfantsEnSejour.length, sub: `${inscriptions.length} inscrit${inscriptions.length > 1 ? 's' : ''} au total`,
      icon: Users, color: 'bg-primary', accent: 'text-primary', ring: 'ring-primary/30',
    },
    {
      key: 'incidents', label: 'Faits marquants',
      value: totalIncidents > 0 ? totalIncidents : 0,
      sub: totalIncidents > 0 ? 'Fait(s) signal\u00e9(s)' : 'Aucun fait signal\u00e9',
      icon: AlertTriangle,
      color: totalIncidents > 0 ? 'bg-red-600' : 'bg-green-600',
      accent: totalIncidents > 0 ? 'text-red-700' : 'text-green-700',
      ring: totalIncidents > 0 ? 'ring-red-300' : 'ring-green-300',
      alert: totalIncidents > 0,
    },
    {
      key: 'medical', label: 'Medical',
      value: medicalCount > 0 ? medicalCount : 0,
      sub: medicalCount > 0 ? 'Evenement(s) trace(s)' : 'Aucun signalement',
      icon: Heart, color: 'bg-rose-500', accent: 'text-rose-700', ring: 'ring-rose-300',
      locked: true,
    },
    {
      key: 'appels', label: 'Appels & Rappels',
      value: callsCount > 0 ? callsCount : '0',
      sub: callsCount > 0 ? 'Appel(s) trace(s)' : 'Aucun appel',
      icon: PhoneCall, color: 'bg-blue-500', accent: 'text-blue-700', ring: 'ring-blue-300',
    },
    {
      key: 'notes', label: 'Notes',
      value: notesCount > 0 ? notesCount : '0',
      sub: notesCount > 0 ? 'Note(s) ajoutee(s)' : 'Aucune note',
      icon: FileText, color: 'bg-violet-500', accent: 'text-violet-700', ring: 'ring-violet-300',
      locked: true,
    },
    {
      key: 'bilan', label: 'Bilan sejours',
      value: enfantsEnSejour.length, sub: 'Synthese par enfant',
      icon: ClipboardList, color: 'bg-gray-600', accent: 'text-gray-700', ring: 'ring-gray-300',
    },
  ];

  return (
    <div className="space-y-6">

      {/* ── ALERTES URGENTES (sticky) ── */}
      <SejourAlertsBanner incidents={urgentIncidents} structureCode={code} role={role || undefined} />

      {/* ── BANDEAU URGENCE ASTREINTE ── */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 sticky top-0 z-20">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-red-700 flex-shrink-0" />
            <div>
              <p className="font-bold text-red-800 text-sm">GED Astreinte 24h/24 — 7j/7</p>
              <p className="text-xl font-bold text-red-900">06 12 34 56 78</p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-red-600 font-medium">Bureau</p>
            <p className="text-sm font-bold text-red-800">lun.–ven. 9h–18h</p>
          </div>
        </div>
      </div>

      {/* ── Besoins specifiques ── */}
      {enfantsAvecBesoins.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">{enfantsAvecBesoins.length} enfant{enfantsAvecBesoins.length > 1 ? 's' : ''} avec besoins specifiques</p>
          </div>
          <div className="space-y-1">
            {enfantsAvecBesoins.map(i => (
              <p key={i.id} className="text-xs text-amber-700">
                <span className="font-medium">{i.jeune_prenom} {i.jeune_nom}</span> — {i.besoins_specifiques}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map(kpi => {
          const isOpen = openSection === kpi.key;
          return (
            <button
              key={kpi.key}
              onClick={() => toggle(kpi.key)}
              className={`relative bg-white rounded-xl border-2 p-5 text-left transition-all hover:shadow-md group ${
                isOpen ? `${kpi.ring} ring-2 border-transparent shadow-md` : 'border-gray-100 hover:border-gray-200'
              } ${kpi.alert ? 'animate-pulse-subtle' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`w-11 h-11 ${kpi.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <kpi.icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-right flex-1 min-w-0">
                  <p className={`text-3xl font-bold ${kpi.accent}`}>{kpi.value}</p>
                  <p className="text-xs font-semibold text-gray-600 mt-0.5 leading-tight">{kpi.label}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-[11px] text-gray-400">{kpi.sub}</p>
                <div className="flex items-center gap-1">
                  {kpi.locked && <Lock className="w-3 h-3 text-gray-300" />}
                  <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform group-hover:text-gray-500 ${isOpen ? 'rotate-90' : ''}`} />
                </div>
              </div>
              {isOpen && (
                <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 rotate-45 bg-white border-b-2 border-r-2 ${
                  kpi.ring.replace('ring-', 'border-').replace('/30', '')
                }`} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── SECTION ENFANTS — NOUVEAU LAYOUT LISTE + PANEL ── */}
      {openSection === 'enfants' && (
        <div className="animate-in fade-in duration-200">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-primary" />
            Enfants inscrits — suivi educatif
            <span className="text-xs font-normal text-gray-400">
              {role === 'educateur' ? 'Vos inscriptions uniquement' : `${inscriptions.length} inscription(s)`}
            </span>
          </h3>

          {inscriptions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
              Aucune inscription pour le moment.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Colonne gauche : liste enfants */}
              <div className="lg:col-span-4 space-y-3">
                {inscriptions.map(ins => (
                  <ChildCard
                    key={ins.id}
                    inscription={ins as ChildCardInscription}
                    selected={selectedEnfant === ins.id}
                    onSelect={setSelectedEnfant}
                    canWrite={canWrite}
                  />
                ))}
              </div>

              {/* Colonne droite : panel detail */}
              <div className="lg:col-span-8 space-y-6">
                {/* Actions prioritaires */}
                <EducatifActionsPanel
                  inscriptions={inscriptions as ChildCardInscription[]}
                  calls={calls}
                  incidents={incidents}
                  onSelectEnfant={setSelectedEnfant}
                />

                {/* Timeline enfant selectionne */}
                {selectedInscription ? (
                  <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-800">
                        {selectedInscription.jeune_prenom} {selectedInscription.jeune_nom.charAt(0)}.
                      </h4>
                      {selectedInscription.suivi_token && (
                        <Link
                          href={`/suivi/${selectedInscription.suivi_token}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Dossier complet →
                        </Link>
                      )}
                    </div>
                    {timelineLoaded ? (
                      <ChildTimeline
                        inscriptionId={selectedInscription.id}
                        enfantNom={`${selectedInscription.jeune_prenom} ${selectedInscription.jeune_nom.charAt(0)}.`}
                        notes={notes}
                        appels={calls}
                        evenements={incidents}
                        medical={medical}
                        souhaits={souhaits}
                        showMedicalDetail={showMedicalDetail}
                      />
                    ) : (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin h-6 w-6 border-3 border-primary border-t-transparent rounded-full" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Selectionnez un enfant pour voir son suivi</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* EVENEMENTS */}
      {openSection === 'incidents' && (
        <div className="animate-in fade-in duration-200">
          <IncidentsPanel code={code} role={role || ''} inscriptions={inscriptionsList} />
        </div>
      )}

      {/* MEDICAL */}
      {openSection === 'medical' && (
        <div className="animate-in fade-in duration-200">
          <div className="flex items-center gap-2 mb-3 text-xs text-gray-400">
            <Lock className="w-3.5 h-3.5" />
            <span>Donnees Art. 9 RGPD — acces restreint et trace</span>
          </div>
          <MedicalSummary code={code} role={role || ''} inscriptions={inscriptionsList} />
        </div>
      )}

      {/* APPELS */}
      {openSection === 'appels' && (
        <div className="animate-in fade-in duration-200">
          <CallsPanel code={code} role={role || ''} inscriptions={inscriptionsList} />
        </div>
      )}

      {/* NOTES */}
      {openSection === 'notes' && (
        <div className="animate-in fade-in duration-200">
          <div className="flex items-center gap-2 mb-3 text-xs text-gray-400">
            <Lock className="w-3.5 h-3.5" />
            <span>Notes non editables — tracabilite RGPD</span>
          </div>
          <NotesPanel code={code} role={role || ''} inscriptions={inscriptionsList} />
        </div>
      )}

      {/* BILAN */}
      {openSection === 'bilan' && (
        <div className="animate-in fade-in duration-200">
          {!timelineLoaded ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <BilanReadOnly inscriptions={inscriptions} incidents={incidents} calls={calls} notes={notes} />
          )}
        </div>
      )}

      {/* ── CODE ACCES compact (direction/cds uniquement) ── */}
      {(role === 'direction' || role === 'cds' || role === 'cds_delegated') && (
        <CodeAccesBox code={code} />
      )}

    </div>
  );
}
