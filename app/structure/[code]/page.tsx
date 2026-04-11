'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Building2, Users, FileCheck, Clock, AlertTriangle, Phone } from 'lucide-react';
import { DossierBadge } from '@/components/admin/DossierBadge';
import IncidentsPanel from '@/components/structure/IncidentsPanel';
import MedicalSummary from '@/components/structure/MedicalSummary';
import CallsPanel from '@/components/structure/CallsPanel';
import NotesPanel from '@/components/structure/NotesPanel';

// ── Types ──────────────────────────────────────────────────────────────────

interface StructureInfo {
  id: string;
  name: string;
  city: string;
  postalCode: string;
  type: string;
  email: string;
  code?: string;
  rgpdAcceptedAt: string | null;
  delegationFrom:  string | null;
  delegationUntil: string | null;
}

interface DossierCompletude {
  bulletin: boolean;
  sanitaire: boolean;
  liaison: boolean;
  renseignements: boolean;
  renseignements_required: boolean;
  pj_count: number;
}

interface Inscription {
  id: string;
  dossier_ref?: string;
  suivi_token?: string;
  jeune_prenom: string;
  jeune_nom: string;
  referent_nom: string;
  referent_email: string;
  sejour_titre: string;
  sejour_slug: string;
  status: string;
  payment_status?: string;
  price_total: number;
  created_at: string;
  dossier_completude: DossierCompletude | null;
  ged_sent_at?: string | null;
  besoins_specifiques?: string | null;
}

interface StructureData {
  structure: StructureInfo;
  role: 'direction' | 'cds' | 'cds_delegated' | 'secretariat' | 'educateur';
  roles: string[];
  accessEmail: string | null;
  inscriptions: Inscription[];
}

// ── Constantes ─────────────────────────────────────────────────────────────

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente', color: '#1d4ed8', bg: '#dbeafe' },
  validee:    { label: 'Validée',    color: '#166534', bg: '#dcfce7' },
  refusee:    { label: 'Refusée',    color: '#dc2626', bg: '#fee2e2' },
  annulee:    { label: 'Annulée',    color: '#6b7280', bg: '#f3f4f6' },
};

const PAYMENT: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment: { label: 'En attente', color: '#c2410c', bg: '#fff7ed' },
  paid:            { label: 'Réglé',      color: '#166534', bg: '#dcfce7' },
  failed:          { label: 'Échoué',     color: '#dc2626', bg: '#fee2e2' },
};

const TYPE_LABELS: Record<string, string> = {
  association: 'Association', ccas: 'CCAS', foyer: 'Foyer',
  pjj: 'PJJ', ase: 'ASE', mecs: 'MECS', autre: 'Autre',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      style={{ color, backgroundColor: bg }}
      className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
    >
      {label}
    </span>
  );
}

// DossierBadge importé depuis @/components/admin/DossierBadge (plus de doublon local)

function fmt(d: string) {
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return d; }
}

// ── Page principale ────────────────────────────────────────────────────────

export default function StructureDashboard() {
  const params = useParams();
  const code = (params?.code as string)?.toUpperCase();
  const [data, setData] = useState<StructureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<'direction' | 'cds' | 'cds_delegated' | 'secretariat' | 'educateur' | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'admin' | 'educatif'>('admin');
  const [eduSubTab, setEduSubTab] = useState('deroulement');
  const [delegFrom,  setDelegFrom]  = useState('');
  const [delegUntil, setDelegUntil] = useState('');
  const [delegSaving, setDelegSaving] = useState(false);
  const [delegMsg,    setDelegMsg]    = useState<string | null>(null);
  const [emailEdit,   setEmailEdit]   = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg,    setEmailMsg]    = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterSejour, setFilterSejour] = useState('');
  const [filterDossier, setFilterDossier] = useState<'all' | 'complet' | 'en_attente' | 'ged_sent'>('all');
  const [rgpdAccepted, setRgpdAccepted] = useState(false);
  const [incidentCounts, setIncidentCounts] = useState<Record<string, number>>({});
  const [callsCount, setCallsCount] = useState(0);
  const [notesCount, setNotesCount] = useState(0);
  const [medicalCount, setMedicalCount] = useState(0);
  const [rgpdLoading, setRgpdLoading] = useState(false);

  useEffect(() => {
    if (!code) return;
    void fetch(`/api/structure/${code}`)
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error?.message || 'Code invalide ou structure inactive.');
        }
        return res.json() as Promise<StructureData>;
      })
      .then((d) => {
        setData(d);
        setRole(d.role);
        setRoles(d.roles || [d.role]);
        // Onglet par défaut : éducatif pour éducateur, admin pour les autres
        if (d.role === 'educateur') setActiveTab('educatif');
        if (d.structure.rgpdAcceptedAt) setRgpdAccepted(true);
        if (d.structure.delegationFrom)  setDelegFrom(d.structure.delegationFrom.slice(0, 10));
        if (d.structure.delegationUntil) setDelegUntil(d.structure.delegationUntil.slice(0, 10));
        if (d.structure.email) setEmailEdit(d.structure.email);
      })
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [code]);

  // Fetch incidents pour KPI + bilan
  useEffect(() => {
    if (!code || !data) return;
    void fetch(`/api/structure/${code}/incidents`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(d => {
        if (!d?.incidents) return;
        const counts: Record<string, number> = {};
        for (const inc of d.incidents as Array<{ inscription_id: string; status: string }>) {
          if (inc.status !== 'resolu') {
            counts[inc.inscription_id] = (counts[inc.inscription_id] || 0) + 1;
          }
        }
        setIncidentCounts(counts);
      })
      .catch(() => {});

    // Fetch calls, notes, medical en parallèle
    void Promise.all([
      fetch(`/api/structure/${code}/calls`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch(`/api/structure/${code}/notes`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch(`/api/structure/${code}/medical`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
    ]).then(([callsData, notesData, medData]) => {
      setCallsCount(callsData?.calls?.length ?? 0);
      setNotesCount(notesData?.notes?.length ?? 0);
      setMedicalCount(medData?.count ?? 0);
    }).catch(() => {});
  }, [code, data]);

  // ── États de chargement / erreur ──

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4"><Building2 className="w-7 h-7 text-primary" /></div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Code structure invalide</h1>
          <p className="text-gray-500 text-sm mb-6">
            {error || 'Ce code ne correspond à aucune structure active.'}
          </p>
          <Link
            href="/structure/login"
            className="inline-block px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition text-sm"
          >
            Réessayer
          </Link>
          <div className="mt-6 text-xs text-gray-400 space-y-1">
            <p>
              <a href="tel:0423161671" className="hover:text-primary">04 23 16 16 71</a>
              {' · '}
              <a href="mailto:contact@groupeetdecouverte.fr" className="hover:text-primary">
                contact@groupeetdecouverte.fr
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { structure, inscriptions } = data;

  // ── Gate consentement RGPD ──
  if (!rgpdAccepted) {
    const handleAcceptRgpd = async () => {
      setRgpdLoading(true);
      try {
        const res = await fetch(`/api/structure/${code}`, { method: 'POST' });
        if (res.ok) setRgpdAccepted(true);
      } catch { /* silencieux */ }
      setRgpdLoading(false);
    };

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-8">
          <div className="flex items-center gap-2 text-primary mb-4">
            <Building2 size={24} />
            <h2 className="text-xl font-bold">Engagement confidentialité</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Avant d&apos;accéder aux données des inscriptions de <strong>{structure.name}</strong>, vous vous engagez à :
          </p>
          <ul className="text-sm text-gray-700 space-y-2 mb-6">
            <li className="flex gap-2"><span className="text-primary font-bold">1.</span> Utiliser ces données uniquement dans le cadre de vos fonctions professionnelles.</li>
            <li className="flex gap-2"><span className="text-primary font-bold">2.</span> Ne pas partager les informations des enfants en dehors de votre structure.</li>
            <li className="flex gap-2"><span className="text-primary font-bold">3.</span> Signaler immédiatement tout accès non autorisé à votre référent GED.</li>
            <li className="flex gap-2"><span className="text-primary font-bold">4.</span> Respecter la confidentialité des données médicales et personnelles des enfants confiés.</li>
          </ul>
          <p className="text-xs text-gray-400 mb-6">
            Conformément au RGPD et à la loi Informatique et Libertés, les données sont hébergées en France et supprimées selon la politique de conservation de GED.{' '}
            <Link href="/confidentialite" target="_blank" className="underline">Politique de confidentialité</Link> — DPO : dpo@groupeetdecouverte.fr
          </p>
          <button
            onClick={handleAcceptRgpd}
            disabled={rgpdLoading}
            className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50"
          >
            {rgpdLoading ? 'Enregistrement…' : 'J\'accepte et j\'accède aux données'}
          </button>
        </div>
      </div>
    );
  }

  // ── Stats ──

  const total     = inscriptions.length;
  const validees  = inscriptions.filter(i => i.status === 'validee').length;
  const reglees   = inscriptions.filter(i => i.payment_status === 'paid').length;
  const completes = inscriptions.filter(i => {
    if (i.ged_sent_at) return true;
    const c = i.dossier_completude;
    return c && c.bulletin && c.sanitaire && c.liaison && c.renseignements;
  }).length;

  const montantTotal = inscriptions.reduce((s, i) => s + (i.price_total || 0), 0);
  const sejoursUniques = [...new Set(inscriptions.map(i => i.sejour_titre).filter(Boolean))].sort();

  // ── Filtres ──

  const filtered = inscriptions.filter(i => {
    if (search.trim() && !`${i.jeune_prenom} ${i.jeune_nom} ${i.referent_nom} ${i.referent_email} ${i.sejour_titre} ${i.dossier_ref || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSejour && i.sejour_titre !== filterSejour) return false;
    if (filterDossier === 'ged_sent' && !i.ged_sent_at) return false;
    if (filterDossier === 'complet' && !i.ged_sent_at) {
      const c = i.dossier_completude;
      if (!c || !c.bulletin || !c.sanitaire || !c.liaison || !c.renseignements) return false;
    }
    if (filterDossier === 'en_attente') {
      if (i.ged_sent_at) return false;
      const c = i.dossier_completude;
      const isComplete = c && c.bulletin && c.sanitaire && c.liaison && c.renseignements;
      if (isComplete) return false;
    }
    return true;
  });

  // ── Rendu ──

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Bandeau réassurance périmètre ── */}
      <div className="bg-muted border-b border-primary-100 px-4 py-2.5 text-xs text-primary text-center">
        Vous voyez uniquement les inscriptions de votre structure. Les fiches sanitaires et documents médicaux sont accessibles uniquement par l&apos;équipe d&apos;encadrement du séjour.
      </div>

      {/* ── Header ── */}
      <header className="bg-primary text-white print:bg-white print:text-black">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={18} className="opacity-60" />
              <span className="text-xs text-white/60 font-semibold uppercase tracking-wider print:text-gray-400">
                Espace Structure
              </span>
              {role === 'direction' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-amber-900 uppercase tracking-wide">Direction</span>
              )}
              {role === 'cds' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white uppercase tracking-wide">Chef de service</span>
              )}
              {role === 'cds_delegated' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-amber-900 uppercase tracking-wide">CDS · Délégation</span>
              )}
              {role === 'secretariat' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-700 uppercase tracking-wide">Secrétariat</span>
              )}
              {role === 'educateur' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-200 text-blue-800 uppercase tracking-wide">Éducateur</span>
              )}
            </div>
            <h1 className="text-xl font-bold leading-tight">{structure.name}</h1>
            <p className="text-sm text-white/60 mt-0.5 print:text-gray-500">
              {structure.city}
              {structure.postalCode ? ` — ${structure.postalCode}` : ''}
              {structure.type ? ` · ${TYPE_LABELS[structure.type] || structure.type}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-white/50 mb-1 print:text-gray-400">Code structure</p>
              <code className="text-base font-mono font-bold tracking-widest bg-white/10 px-3 py-1.5 rounded-lg print:bg-gray-100 print:text-gray-800">
                {structure.code}
              </code>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {[
            { label: 'Inscriptions',      value: total,                color: 'text-primary' },
            { label: 'Validées',          value: validees,             color: 'text-green-700' },
            { label: 'Réglées',           value: reglees,              color: 'text-green-700' },
            { label: 'Dossiers complets', value: completes,            color: 'text-blue-700' },
            { label: 'En attente',        value: total - completes,    color: 'text-orange-600' },
            { label: 'Séjours',           value: sejoursUniques.length, color: 'text-purple-700' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Montant total — masqué pour les éducateurs (hors périmètre rôle) */}
        {role !== 'educateur' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Montant total engagé</p>
            <p className="text-2xl font-bold text-primary">{montantTotal.toLocaleString('fr-FR')} €</p>
          </div>
          <button
            onClick={() => window.print()}
            className="print:hidden text-sm px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-medium"
          >
            Imprimer le récapitulatif
          </button>
        </div>
        )}

        {/* ── Onglets Admin / Éducatif ── */}
        {(roles.includes('direction') || roles.includes('cds') || roles.includes('educateur') || roles.includes('secretariat')) && (
          <div className="flex border-b border-gray-200 mb-6 print:hidden">
            {(roles.includes('admin') || roles.includes('direction') || roles.includes('cds') || roles.includes('secretariat')) && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'admin' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Administratif
              </button>
            )}
            {(roles.includes('educatif') || roles.includes('direction') || roles.includes('cds') || roles.includes('educateur')) && role !== 'secretariat' && (
              <button
                onClick={() => setActiveTab('educatif')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'educatif' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Suivi éducatif
              </button>
            )}
          </div>
        )}

        {/* ── Contenu onglet Éducatif ── */}
        {activeTab === 'educatif' && (
          <div className="space-y-6">

            {/* 1. BANDEAU URGENCE FIXE */}
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

            {/* 2. KPIs TERRAIN — style admin dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Enfants en séjour', value: filtered.filter(i => i.status === 'validee').length, color: 'bg-primary', icon: Users, sub: 'Inscriptions validées' },
                { label: 'Dossiers complets', value: filtered.filter(i => i.ged_sent_at).length, color: 'bg-accent', icon: FileCheck, sub: 'Envoyés à GED' },
                { label: 'En attente', value: filtered.filter(i => i.status === 'en_attente').length, color: 'bg-secondary', icon: Clock, sub: 'À valider' },
                { label: 'Incidents ouverts', value: filtered.reduce((sum, i) => sum + (incidentCounts[i.id] ?? 0), 0), color: 'bg-primary-700', icon: AlertTriangle, sub: filtered.reduce((sum, i) => sum + (incidentCounts[i.id] ?? 0), 0) === 0 ? 'Aucun incident' : 'Non résolus' },
              ].map(kpi => (
                <div key={kpi.label} className="bg-white rounded-xl shadow p-6">
                  <div className={`w-12 h-12 ${kpi.color} rounded-lg flex items-center justify-center mb-4`}>
                    <kpi.icon className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-gray-500 text-sm">{kpi.label}</p>
                  <p className="text-3xl font-bold text-primary">{kpi.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* KPIs secondaires — ligne compacte */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Appels tracés', value: callsCount, ok: 'Aucun' },
                { label: 'Notes', value: notesCount, ok: 'Aucune' },
                { label: 'Médical', value: medicalCount, ok: 'RAS' },
                { label: 'Incidents', value: filtered.reduce((sum, i) => sum + (incidentCounts[i.id] ?? 0), 0), ok: 'RAS' },
              ].map(kpi => (
                <div key={kpi.label} className={`rounded-xl border p-4 ${kpi.value === 0 ? 'bg-muted border-primary-100' : 'bg-secondary-50 border-secondary-200'}`}>
                  <p className="text-sm font-medium text-gray-700">{kpi.label}</p>
                  <p className={`text-lg font-bold ${kpi.value === 0 ? 'text-accent' : 'text-secondary'}`}>
                    {kpi.value === 0 ? kpi.ok : kpi.value}
                  </p>
                </div>
              ))}
            </div>

            {/* 3. SOUS-ONGLETS SUIVI */}
            {(() => {
              const [subTab, setSubTab] = [eduSubTab, setEduSubTab];
              return (<>
              <div className="flex border-b border-gray-200 overflow-x-auto" role="tablist" aria-label="Sous-onglets suivi éducatif">
                {[
                  { key: 'deroulement', label: 'Déroulement' },
                  { key: 'medical', label: 'Médical' },
                  { key: 'appels', label: 'Appels & Rappels' },
                  { key: 'notes', label: 'Notes' },
                  { key: 'bilan', label: 'Bilan' },
                ].map(t => (
                  <button key={t.key} onClick={() => setSubTab(t.key)}
                    role="tab"
                    aria-selected={subTab === t.key}
                    className={`px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                      subTab === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-600'
                    }`}
                  >{t.label}</button>
                ))}
              </div>

              {/* Sous-onglet DÉROULEMENT */}
              {subTab === 'deroulement' && (<>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-800">Enfants inscrits — suivi éducatif</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {role === 'educateur' ? 'Vos inscriptions uniquement' : `${filtered.length} inscription(s)`}
                    </p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {filtered.length === 0 ? (
                      <div className="p-8 text-center text-gray-400">Aucune inscription pour le moment.</div>
                    ) : filtered.map(insc => {
                      const st = STATUS[insc.status] || STATUS.en_attente;
                      return (
                        <div key={insc.id} className="px-6 py-4 hover:bg-gray-50 transition">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-medium text-gray-800">{insc.jeune_prenom} {insc.jeune_nom}</p>
                              <p className="text-sm text-gray-500">{insc.sejour_titre}</p>
                              <p className="text-xs text-gray-400 mt-0.5">Référent : {insc.referent_nom}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <DossierBadge completude={insc.dossier_completude ? { bulletin: insc.dossier_completude.bulletin, sanitaire: insc.dossier_completude.sanitaire, liaison: insc.dossier_completude.liaison, renseignements: insc.dossier_completude.renseignements, pj_count: insc.dossier_completude.pj_count } : null} gedSentAt={insc.ged_sent_at} />
                              <Badge {...st} />
                              {insc.suivi_token && (
                                <Link href={`/suivi/${insc.suivi_token}`} className="text-xs text-primary hover:underline whitespace-nowrap">
                                  Dossier →
                                </Link>
                              )}
                            </div>
                          </div>
                          {insc.besoins_specifiques && (
                            <div className="mt-2 p-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800">
                              Besoins spécifiques : {insc.besoins_specifiques}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <IncidentsPanel code={code} role={role || ''} inscriptions={filtered.map(i => ({ id: i.id, jeune_prenom: i.jeune_prenom, jeune_nom: i.jeune_nom }))} />
              </>)}

              {/* Sous-onglet MÉDICAL */}
              {subTab === 'medical' && (
                <MedicalSummary code={code} role={role || ''} inscriptions={filtered.map(i => ({ id: i.id, jeune_prenom: i.jeune_prenom, jeune_nom: i.jeune_nom }))} />
              )}

              {/* Sous-onglet APPELS */}
              {subTab === 'appels' && (
                <CallsPanel code={code} role={role || ''} inscriptions={filtered.map(i => ({ id: i.id, jeune_prenom: i.jeune_prenom, jeune_nom: i.jeune_nom }))} />
              )}

              {/* Sous-onglet NOTES */}
              {subTab === 'notes' && (
                <NotesPanel code={code} role={role || ''} inscriptions={filtered.map(i => ({ id: i.id, jeune_prenom: i.jeune_prenom, jeune_nom: i.jeune_nom }))} />
              )}

              {/* Sous-onglet BILAN */}
              {subTab === 'bilan' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="font-semibold text-gray-800 mb-3">Bilan séjours</h3>
                  <div className="space-y-2">
                    {filtered.filter(i => i.status === 'validee').length > 0 ? (
                      filtered.filter(i => i.status === 'validee').map(insc => (
                        <div key={insc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{insc.jeune_prenom} {insc.jeune_nom}</p>
                            <p className="text-xs text-gray-500">{insc.sejour_titre}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs ${(incidentCounts[insc.id] ?? 0) > 0 ? 'text-red-600 font-medium' : 'text-primary'}`}>
                              {(incidentCounts[insc.id] ?? 0) > 0 ? `${incidentCounts[insc.id]} incident(s) non résolu(s)` : 'Aucun incident'}
                            </span>
                            <DossierBadge completude={insc.dossier_completude ? { bulletin: insc.dossier_completude.bulletin, sanitaire: insc.dossier_completude.sanitaire, liaison: insc.dossier_completude.liaison, renseignements: insc.dossier_completude.renseignements, pj_count: insc.dossier_completude.pj_count } : null} gedSentAt={insc.ged_sent_at} />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">Aucun séjour validé pour le moment.</p>
                    )}
                  </div>
                </div>
              )}
              </>);
            })()}

          </div>
        )}

        {/* ── Contenu onglet Administratif ── */}
        {activeTab === 'admin' && (<>

        {/* ── Filtres ── */}
        <div className="mb-4 print:hidden flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Rechercher un enfant, référent, séjour…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] sm:max-w-xs px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <select
            value={filterSejour}
            onChange={e => setFilterSejour(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
          >
            <option value="">Tous les séjours</option>
            {sejoursUniques.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filterDossier}
            onChange={e => setFilterDossier(e.target.value as typeof filterDossier)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
          >
            <option value="all">Tous les dossiers</option>
            <option value="ged_sent">Envoyés GED</option>
            <option value="complet">Dossiers complets</option>
            <option value="en_attente">En attente</option>
          </select>
        </div>

        {/* ── Tableau ── */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">
            {total === 0
              ? 'Aucune inscription enregistrée pour cette structure.'
              : 'Aucun résultat pour cette recherche.'}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Date</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Réf.</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Jeune</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Séjour</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Référent</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Documents</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Prix</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Paiement</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Suivi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(insc => {
                    const st = STATUS[insc.status] || STATUS.en_attente;
                    const ps = PAYMENT[insc.payment_status || 'pending_payment'] || PAYMENT.pending_payment;
                    return (
                      <tr key={insc.id} className="hover:bg-gray-50 transition">
                        <td className="hidden sm:table-cell px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(insc.created_at)}</td>
                        <td className="hidden sm:table-cell px-4 py-3 font-mono text-xs text-gray-400">{insc.dossier_ref || '—'}</td>
                        <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                          {insc.jeune_prenom} {insc.jeune_nom}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate" title={insc.sejour_titre}>
                          {insc.sejour_titre}
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3">
                          <p className="font-medium text-gray-700 whitespace-nowrap">{insc.referent_nom}</p>
                          <p className="text-xs text-gray-400">{insc.referent_email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <DossierBadge completude={insc.dossier_completude ? { bulletin: insc.dossier_completude.bulletin, sanitaire: insc.dossier_completude.sanitaire, liaison: insc.dossier_completude.liaison, renseignements: insc.dossier_completude.renseignements, pj_count: insc.dossier_completude.pj_count } : null} gedSentAt={insc.ged_sent_at} />
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                          {(insc.price_total || 0).toLocaleString('fr-FR')} €
                        </td>
                        <td className="px-4 py-3"><Badge {...ps} /></td>
                        <td className="px-4 py-3"><Badge {...st} /></td>
                        <td className="px-4 py-3">
                          {insc.suivi_token ? (
                            <Link href={`/suivi/${insc.suivi_token}`} className="text-xs text-primary hover:underline whitespace-nowrap">
                              Voir le dossier →
                            </Link>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {search && filtered.length < inscriptions.length && (
              <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-50">
                {filtered.length} résultat{filtered.length > 1 ? 's' : ''} sur {total}
              </div>
            )}
          </div>
        )}

        {/* ── Bandeau délégation active (CDS délégué) ── */}
        {role === 'cds_delegated' && structure.delegationUntil && (
          <div className="mt-8 border-l-4 border-amber-400 bg-amber-50 rounded-xl p-5 flex items-start gap-3">
            <span className="text-amber-500 text-xl">⏳</span>
            <div>
              <p className="font-semibold text-amber-900 text-sm">Accès délégué par votre directeur</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Votre directeur vous a accordé un accès temporaire à la gestion des codes jusqu'au{' '}
                <strong>{new Date(structure.delegationUntil).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>.
                Après cette date, seul le directeur pourra gérer les codes.
              </p>
            </div>
          </div>
        )}

        {/* ── Section Directeur / CDS délégué : Codes d'accès ── */}
        {(role === 'direction' || role === 'cds_delegated') && (
          <div className="mt-8 border-l-4 border-amber-400 bg-amber-50 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-amber-900 uppercase tracking-wide">
                {role === 'direction' ? 'Directeur' : 'CDS · Délégué'}
              </span>
              <h3 className="font-semibold text-amber-900">Codes d'accès de la structure</h3>
            </div>
            <p className="text-xs text-amber-700 mb-4">
              Ces codes permettent à votre équipe d'accéder aux inscriptions. Ne les partagez qu'avec les personnes autorisées.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 border border-amber-200">
                <p className="text-xs font-semibold text-gray-700 mb-1">Code CDS — 6 caractères</p>
                <p className="text-xs text-gray-400 mb-3">
                  À donner à votre chef de service. Permet de voir la liste des inscriptions de la structure.
                </p>
                <code className="font-mono font-bold text-lg tracking-widest text-primary bg-gray-50 px-3 py-1.5 rounded-lg block text-center">
                  {structure.code || '——'}
                </code>
              </div>
              <div className="bg-white rounded-lg p-4 border border-amber-200">
                <p className="text-xs font-semibold text-gray-700 mb-1">Code Directeur — 10 caractères</p>
                <p className="text-xs text-gray-400 mb-3">
                  Code personnel du directeur. Donne accès à la gestion des délégations. Ne pas diffuser.
                </p>
                <code className="font-mono font-bold text-lg tracking-widest text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg block text-center">
                  {code}
                </code>
              </div>
            </div>

            {/* Délégation et paramètres — visible uniquement pour le directeur */}
            {role === 'direction' && (
              <>
              <div className="border-t border-amber-200 pt-5">
                <p className="text-sm font-semibold text-amber-900 mb-1">Déléguer la gestion des codes à votre CDS</p>
                <p className="text-xs text-amber-700 mb-4">
                  En cas d'absence, vous pouvez autoriser votre chef de service à accéder aux codes pendant une période limitée (90 jours maximum).
                  Le CDS verra un bandeau indiquant qu'il bénéficie d'un accès temporaire.
                </p>
                <div className="flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date de début</label>
                    <input
                      type="date"
                      value={delegFrom}
                      onChange={e => setDelegFrom(e.target.value)}
                      min={new Date().toISOString().slice(0, 10)}
                      className="px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date de fin</label>
                    <input
                      type="date"
                      value={delegUntil}
                      onChange={e => setDelegUntil(e.target.value)}
                      min={delegFrom || new Date().toISOString().slice(0, 10)}
                      className="px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                    />
                  </div>
                  <button
                    disabled={delegSaving || !delegFrom || !delegUntil}
                    onClick={async () => {
                      setDelegSaving(true);
                      setDelegMsg(null);
                      try {
                        const res = await fetch(`/api/structure/${code}/delegation`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ from: delegFrom, until: delegUntil }),
                        });
                        if (res.ok) {
                          setDelegMsg('✓ Délégation enregistrée.');
                        } else {
                          const err = await res.json().catch(() => ({}));
                          setDelegMsg(`Erreur : ${err?.error?.message || 'Veuillez réessayer.'}`);
                        }
                      } catch {
                        setDelegMsg('Erreur réseau. Veuillez réessayer.');
                      }
                      setDelegSaving(false);
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                  >
                    {delegSaving ? 'Enregistrement…' : 'Enregistrer la délégation'}
                  </button>
                  {(structure.delegationFrom || structure.delegationUntil) && (
                    <button
                      disabled={delegSaving}
                      onClick={async () => {
                        if (!confirm('Supprimer la délégation en cours ?')) return;
                        setDelegSaving(true);
                        setDelegMsg(null);
                        try {
                          const res = await fetch(`/api/structure/${code}/delegation`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ from: null, until: null }),
                          });
                          if (res.ok) {
                            setDelegFrom('');
                            setDelegUntil('');
                            setDelegMsg('✓ Délégation supprimée.');
                          }
                        } catch {
                          setDelegMsg('Erreur réseau.');
                        }
                        setDelegSaving(false);
                      }}
                      className="px-4 py-2 bg-white border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition disabled:opacity-50"
                    >
                      Supprimer la délégation
                    </button>
                  )}
                </div>
                {delegMsg && (
                  <p className={`text-xs mt-3 font-medium ${delegMsg.startsWith('✓') ? 'text-green-700' : 'text-red-600'}`}>
                    {delegMsg}
                  </p>
                )}
              </div>

              {/* Modifier l'email de contact */}
              <div className="border-t border-amber-200 pt-5 mt-5">
                <p className="text-sm font-semibold text-amber-900 mb-1">Email de contact de la structure</p>
                <p className="text-xs text-amber-700 mb-3">
                  Cet email est utilisé par GED pour vous contacter. Vérifiez qu&apos;il est à jour.
                </p>
                <div className="flex gap-3 items-end flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Adresse email</label>
                    <input
                      type="email"
                      value={emailEdit}
                      onChange={e => setEmailEdit(e.target.value)}
                      placeholder={structure.email || 'email@votrestructure.fr'}
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                    />
                  </div>
                  <button
                    disabled={emailSaving || !emailEdit || emailEdit === structure.email}
                    onClick={async () => {
                      setEmailSaving(true);
                      setEmailMsg(null);
                      try {
                        const res = await fetch(`/api/structure/${code}/settings`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: emailEdit }),
                        });
                        if (res.ok) {
                          setEmailMsg('✓ Email mis à jour.');
                        } else {
                          const err = await res.json().catch(() => ({}));
                          setEmailMsg(`Erreur : ${err?.error?.message || 'Veuillez réessayer.'}`);
                        }
                      } catch {
                        setEmailMsg('Erreur réseau. Veuillez réessayer.');
                      }
                      setEmailSaving(false);
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                  >
                    {emailSaving ? 'Enregistrement…' : 'Mettre à jour'}
                  </button>
                </div>
                {emailMsg && (
                  <p className={`text-xs mt-2 font-medium ${emailMsg.startsWith('✓') ? 'text-green-700' : 'text-red-600'}`}>
                    {emailMsg}
                  </p>
                )}
              </div>
              </>
            )}
            <p className="text-xs text-amber-600 mt-5">
              Pour régénérer un code : <a href="mailto:contact@groupeetdecouverte.fr" className="underline font-medium">contact@groupeetdecouverte.fr</a>
            </p>
          </div>
        )}

        </>)}

        {/* ── Contact (commun aux deux onglets) ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-8">
          <h3 className="font-semibold text-gray-800 mb-3">Contact Groupe &amp; Découverte</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Email</p>
              <p className="font-medium">contact@groupeetdecouverte.fr</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Téléphone</p>
              <p className="font-medium">04 23 16 16 71</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Horaires</p>
              <p className="font-medium">lun.–ven. 9h–17h</p>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-gray-400">
          Groupe &amp; Découverte — Séjours de vacances pour enfants et adolescents
        </div>
      </main>

      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          header { background: white !important; color: black !important; border-bottom: 1px solid #e5e7eb; }
          .shadow-sm { box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
