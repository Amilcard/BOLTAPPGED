'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users, AlertTriangle, Phone, PhoneCall, FileText, Heart, ClipboardList, Shield } from 'lucide-react';
import IncidentsPanel from '@/components/structure/IncidentsPanel';
import MedicalSummary from '@/components/structure/MedicalSummary';
import CallsPanel from '@/components/structure/CallsPanel';
import NotesPanel from '@/components/structure/NotesPanel';

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
}

interface Props {
  code: string;
  role: string | null;
  inscriptions: Inscription[];
  incidentCounts: Record<string, number>;
  callsCount: number;
  notesCount: number;
  medicalCount: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const EDU_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  validee:    { label: 'En séjour',   color: '#166534', bg: '#dcfce7' },
  en_attente: { label: 'En attente',  color: '#1d4ed8', bg: '#dbeafe' },
  refusee:    { label: 'Non retenu',  color: '#6b7280', bg: '#f3f4f6' },
  annulee:    { label: 'Annulé',      color: '#6b7280', bg: '#f3f4f6' },
};

type Section = 'enfants' | 'incidents' | 'medical' | 'appels' | 'notes' | 'bilan' | null;

// ── Composant ──���───────────────────────────────────────────────────────────

export default function StructureEduTab({
  code, role, inscriptions, incidentCounts,
  callsCount, notesCount, medicalCount,
}: Props) {
  const [openSection, setOpenSection] = useState<Section>('enfants');

  const enfantsEnSejour = inscriptions.filter(i => i.status === 'validee');
  const totalIncidents = Object.values(incidentCounts).reduce((a, b) => a + b, 0);
  const enfantsAvecBesoins = inscriptions.filter(i => i.besoins_specifiques);
  const inscriptionsList = inscriptions.map(i => ({ id: i.id, jeune_prenom: i.jeune_prenom, jeune_nom: i.jeune_nom }));

  function toggle(section: Section) {
    setOpenSection(prev => prev === section ? null : section);
  }

  // ── KPI cards data ──
  const kpiCards: Array<{
    key: Section;
    label: string;
    value: number | string;
    sub: string;
    icon: typeof Users;
    color: string;
    accent: string;
    ring: string;
    alert?: boolean;
  }> = [
    {
      key: 'enfants', label: 'Enfants en séjour',
      value: enfantsEnSejour.length, sub: `${inscriptions.length} inscrit${inscriptions.length > 1 ? 's' : ''} au total`,
      icon: Users, color: 'bg-primary', accent: 'text-primary', ring: 'ring-primary/30',
    },
    {
      key: 'incidents', label: 'Incidents',
      value: totalIncidents > 0 ? totalIncidents : 'RAS',
      sub: totalIncidents > 0 ? 'Non résolus' : 'Aucun incident',
      icon: AlertTriangle,
      color: totalIncidents > 0 ? 'bg-red-600' : 'bg-green-600',
      accent: totalIncidents > 0 ? 'text-red-700' : 'text-green-700',
      ring: totalIncidents > 0 ? 'ring-red-300' : 'ring-green-300',
      alert: totalIncidents > 0,
    },
    {
      key: 'medical', label: 'Médical',
      value: medicalCount > 0 ? medicalCount : 'RAS',
      sub: medicalCount > 0 ? 'Événement(s) tracé(s)' : 'Rien à signaler',
      icon: Heart, color: 'bg-rose-500', accent: 'text-rose-700', ring: 'ring-rose-300',
    },
    {
      key: 'appels', label: 'Appels & Rappels',
      value: callsCount > 0 ? callsCount : '0',
      sub: callsCount > 0 ? 'Appel(s) tracé(s)' : 'Aucun appel',
      icon: PhoneCall, color: 'bg-blue-500', accent: 'text-blue-700', ring: 'ring-blue-300',
    },
    {
      key: 'notes', label: 'Notes',
      value: notesCount > 0 ? notesCount : '0',
      sub: notesCount > 0 ? 'Note(s) ajoutée(s)' : 'Aucune note',
      icon: FileText, color: 'bg-violet-500', accent: 'text-violet-700', ring: 'ring-violet-300',
    },
    {
      key: 'bilan', label: 'Bilan séjours',
      value: enfantsEnSejour.length, sub: 'Synthèse par enfant',
      icon: ClipboardList, color: 'bg-gray-600', accent: 'text-gray-700', ring: 'ring-gray-300',
    },
  ];

  return (
    <div className="space-y-6">

      {/* ── BANDEAU URGENCE ── */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 sticky top-0 z-20">
        <div className="flex items-center gap-3 mb-2">
          <Phone className="w-5 h-5 text-red-700 flex-shrink-0" />
          <div>
            <p className="font-bold text-red-800 text-sm">GED Astreinte H24</p>
            <a href="tel:0423161671" className="text-xl font-bold text-red-900 min-h-[44px] flex items-center">04 23 16 16 71</a>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-medium">
          <span className="px-2 py-1 bg-red-100 text-red-800 rounded">SAMU 15</span>
          <span className="px-2 py-1 bg-red-100 text-red-800 rounded">Police 17</span>
          <span className="px-2 py-1 bg-red-100 text-red-800 rounded">Pompiers 18</span>
          <span className="px-2 py-1 bg-red-100 text-red-800 rounded">Enfants en danger 119</span>
        </div>
      </div>

      {/* ── Besoins spécifiques (alerte si > 0) ── */}
      {enfantsAvecBesoins.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">{enfantsAvecBesoins.length} enfant{enfantsAvecBesoins.length > 1 ? 's' : ''} avec besoins spécifiques</p>
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

      {/* ── KPI CARDS GRILLE (cliquables → ouvrent le contenu) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map(kpi => {
          const isOpen = openSection === kpi.key;
          return (
            <button
              key={kpi.key}
              onClick={() => toggle(kpi.key)}
              className={`relative bg-white rounded-xl border-2 p-5 text-left transition-all hover:shadow-md ${
                isOpen ? `${kpi.ring} ring-2 border-transparent shadow-md` : 'border-gray-100 hover:border-gray-200'
              } ${kpi.alert ? 'animate-pulse-subtle' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`w-11 h-11 ${kpi.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <kpi.icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-right flex-1 min-w-0">
                  <p className={`text-3xl font-bold ${kpi.accent}`}>{kpi.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{kpi.label}</p>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-3">{kpi.sub}</p>
              {isOpen && (
                <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 rotate-45 bg-white border-b-2 border-r-2 ${
                  kpi.ring.replace('ring-', 'border-').replace('/30', '')
                }`} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── CONTENU SECTION OUVERTE ── */}

      {/* ENFANTS */}
      {openSection === 'enfants' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Enfants inscrits — suivi éducatif
            <span className="text-xs font-normal text-gray-400">
              {role === 'educateur' ? 'Vos inscriptions uniquement' : `${inscriptions.length} inscription(s)`}
            </span>
          </h3>
          {inscriptions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
              Aucune inscription pour le moment.
            </div>
          ) : inscriptions.map(insc => {
            const st = EDU_STATUS[insc.status] || EDU_STATUS.en_attente;
            const incidents = incidentCounts[insc.id] ?? 0;
            return (
              <div key={insc.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-800">{insc.jeune_prenom} {insc.jeune_nom}</p>
                      <span
                        style={{ color: st.color, backgroundColor: st.bg }}
                        className="px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
                      >
                        {st.label}
                      </span>
                      {incidents > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">
                          {incidents} incident{incidents > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{insc.sejour_titre}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Référent : {insc.referent_nom}</p>
                    {insc.besoins_specifiques && (
                      <div className="mt-2 p-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800">
                        Besoins spécifiques : {insc.besoins_specifiques}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {insc.suivi_token && (
                      <Link
                        href={`/suivi/${insc.suivi_token}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition"
                      >
                        Dossier →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* INCIDENTS */}
      {openSection === 'incidents' && (
        <div className="animate-in fade-in duration-200">
          <IncidentsPanel code={code} role={role || ''} inscriptions={inscriptionsList} />
        </div>
      )}

      {/* MÉDICAL */}
      {openSection === 'medical' && (
        <div className="animate-in fade-in duration-200">
          <div className="flex items-center gap-2 mb-3 text-xs text-gray-400">
            <Shield className="w-3.5 h-3.5" />
            <span>Données Art. 9 RGPD — accès restreint et tracé</span>
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
            <Shield className="w-3.5 h-3.5" />
            <span>Notes non éditables — traçabilité RGPD</span>
          </div>
          <NotesPanel code={code} role={role || ''} inscriptions={inscriptionsList} />
        </div>
      )}

      {/* BILAN */}
      {openSection === 'bilan' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-in fade-in duration-200">
          <h3 className="font-semibold text-gray-800 mb-4">Bilan séjours</h3>
          <div className="space-y-2">
            {enfantsEnSejour.length > 0 ? (
              enfantsEnSejour.map(insc => {
                const incidents = incidentCounts[insc.id] ?? 0;
                return (
                  <div key={insc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{insc.jeune_prenom} {insc.jeune_nom}</p>
                      <p className="text-xs text-gray-500">{insc.sejour_titre}</p>
                    </div>
                    <span className={`text-xs font-medium ${incidents > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {incidents > 0 ? `${incidents} incident(s) non résolu(s)` : 'Aucun incident'}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-400">Aucun séjour validé pour le moment.</p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
