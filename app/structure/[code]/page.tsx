'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Building2, FileCheck, FileClock } from 'lucide-react';

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
}

interface StructureData {
  structure: StructureInfo;
  role: 'cds' | 'cds_delegated' | 'directeur';
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

function DossierBadge({ c, gedSentAt }: { c: DossierCompletude | null; gedSentAt?: string | null }) {
  if (!c) return <span className="inline-flex items-center gap-1 text-xs text-gray-400"><FileClock size={12} /> Non commencé</span>;
  if (gedSentAt) return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700"><FileCheck size={12} /> Envoyé GED</span>;
  const required = [c.bulletin, c.sanitaire, c.liaison, ...(c.renseignements_required ? [c.renseignements] : [])];
  const done = required.filter(Boolean).length;
  const total = required.length;
  if (done === total) return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700"><FileCheck size={12} /> Complet</span>;
  return (
    <span className="text-xs font-medium text-orange-600">{done}/{total} fiches</span>
  );
}

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
  const [role, setRole] = useState<'cds' | 'cds_delegated' | 'directeur' | null>(null);
  const [delegFrom,  setDelegFrom]  = useState('');
  const [delegUntil, setDelegUntil] = useState('');
  const [delegSaving, setDelegSaving] = useState(false);
  const [delegMsg,    setDelegMsg]    = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterSejour, setFilterSejour] = useState('');
  const [filterDossier, setFilterDossier] = useState<'all' | 'complet' | 'en_attente' | 'ged_sent'>('all');
  const [rgpdAccepted, setRgpdAccepted] = useState(false);
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
        if (d.structure.rgpdAcceptedAt) setRgpdAccepted(true);
        if (d.structure.delegationFrom)  setDelegFrom(d.structure.delegationFrom.slice(0, 10));
        if (d.structure.delegationUntil) setDelegUntil(d.structure.delegationUntil.slice(0, 10));
      })
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [code]);

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
          <div className="text-4xl mb-4">🏢</div>
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
            <h1 className="text-xl font-bold">Engagement confidentialité</h1>
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
      <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5 text-xs text-blue-800 text-center">
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
              {role === 'directeur' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-amber-900 uppercase tracking-wide">Directeur</span>
              )}
              {role === 'cds' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white uppercase tracking-wide">CDS</span>
              )}
              {role === 'cds_delegated' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-amber-900 uppercase tracking-wide">CDS · Délégation active</span>
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

        {/* Montant total */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Montant total engagé</p>
            <p className="text-2xl font-bold text-primary">{montantTotal.toLocaleString('fr-FR')} €</p>
          </div>
          <button
            onClick={() => window.print()}
            className="print:hidden text-sm px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-medium"
          >
            Télécharger récap PDF
          </button>
        </div>

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
                    {['Date', 'Réf.', 'Jeune', 'Séjour', 'Référent', 'Documents', 'Prix', 'Paiement', 'Statut', 'Suivi'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(insc => {
                    const st = STATUS[insc.status] || STATUS.en_attente;
                    const ps = PAYMENT[insc.payment_status || 'pending_payment'] || PAYMENT.pending_payment;
                    return (
                      <tr key={insc.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(insc.created_at)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{insc.dossier_ref || '—'}</td>
                        <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                          {insc.jeune_prenom} {insc.jeune_nom}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate" title={insc.sejour_titre}>
                          {insc.sejour_titre}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-700 whitespace-nowrap">{insc.referent_nom}</p>
                          <p className="text-xs text-gray-400">{insc.referent_email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <DossierBadge c={insc.dossier_completude} gedSentAt={insc.ged_sent_at} />
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
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
        {(role === 'directeur' || role === 'cds_delegated') && (
          <div className="mt-8 border-l-4 border-amber-400 bg-amber-50 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-amber-900 uppercase tracking-wide">
                {role === 'directeur' ? 'Directeur' : 'CDS · Délégué'}
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

            {/* Délégation — visible uniquement pour le directeur */}
            {role === 'directeur' && (
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
            )}
            <p className="text-xs text-amber-600 mt-5">
              Pour régénérer un code : <a href="mailto:contact@groupeetdecouverte.fr" className="underline font-medium">contact@groupeetdecouverte.fr</a>
            </p>
          </div>
        )}

        {/* ── Contact ── */}
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
