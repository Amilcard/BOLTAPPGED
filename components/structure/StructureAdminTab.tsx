'use client';

import Link from 'next/link';
import { DossierBadge } from '@/components/admin/DossierBadge';

// ── Types ──────────────────────────────────────────────────────────────────

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

interface StructureInfo {
  id: string;
  name: string;
  city: string;
  postalCode: string;
  type: string;
  email: string;
  code?: string;
  rgpdAcceptedAt: string | null;
  delegationFrom: string | null;
  delegationUntil: string | null;
}

interface Props {
  inscriptions: Inscription[];
  filtered: Inscription[];
  structure: StructureInfo;
  code: string;
  role: string | null;
  search: string;
  setSearch: (v: string) => void;
  filterSejour: string;
  setFilterSejour: (v: string) => void;
  filterDossier: 'all' | 'complet' | 'en_attente' | 'ged_sent';
  setFilterDossier: (v: 'all' | 'complet' | 'en_attente' | 'ged_sent') => void;
  sejoursUniques: string[];
  delegFrom: string;
  setDelegFrom: (v: string) => void;
  delegUntil: string;
  setDelegUntil: (v: string) => void;
  delegSaving: boolean;
  setDelegSaving: (v: boolean) => void;
  delegMsg: string | null;
  setDelegMsg: (v: string | null) => void;
  emailEdit: string;
  setEmailEdit: (v: string) => void;
  emailSaving: boolean;
  setEmailSaving: (v: boolean) => void;
  emailMsg: string | null;
  setEmailMsg: (v: string | null) => void;
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

function fmt(d: string) {
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return d; }
}

// ── Composant ──────────────────────────────────────────────────────────────

export default function StructureAdminTab({
  inscriptions, filtered, structure, code, role,
  search, setSearch, filterSejour, setFilterSejour,
  filterDossier, setFilterDossier, sejoursUniques,
  delegFrom, setDelegFrom, delegUntil, setDelegUntil,
  delegSaving, setDelegSaving, delegMsg, setDelegMsg,
  emailEdit, setEmailEdit, emailSaving, setEmailSaving,
  emailMsg, setEmailMsg,
}: Props) {
  const total = inscriptions.length;
  const validees = inscriptions.filter(i => i.status === 'validee').length;
  const reglees = inscriptions.filter(i => i.payment_status === 'paid').length;
  const completes = inscriptions.filter(i => {
    if (i.ged_sent_at) return true;
    const c = i.dossier_completude;
    return c && c.bulletin && c.sanitaire && c.liaison && c.renseignements;
  }).length;
  const montantTotal = inscriptions.reduce((s, i) => s + (i.price_total || 0), 0);

  return (
    <>
      {/* ── Stats admin ── */}
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

      {/* Montant total — masqué pour les éducateurs */}
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
          <span className="text-amber-500 text-xl" aria-hidden="true">&#9203;</span>
          <div>
            <p className="font-semibold text-amber-900 text-sm">Accès délégué par votre directeur</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Votre directeur vous a accordé un accès temporaire à la gestion des codes jusqu&apos;au{' '}
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
            <h3 className="font-semibold text-amber-900">Codes d&apos;accès de la structure</h3>
          </div>
          <p className="text-xs text-amber-700 mb-4">
            Ces codes permettent à votre équipe d&apos;accéder aux inscriptions. Ne les partagez qu&apos;avec les personnes autorisées.
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
                En cas d&apos;absence, vous pouvez autoriser votre chef de service à accéder aux codes pendant une période limitée (90 jours maximum).
                Le CDS verra un bandeau indiquant qu&apos;il bénéficie d&apos;un accès temporaire.
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
                        setDelegMsg('Délégation enregistrée.');
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
                {(structure.delegationFrom || structure.delegationUntil || delegFrom || delegUntil) && (
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
                          // Forcer la disparition du bouton en vidant aussi les props via state parent
                          structure.delegationFrom = null;
                          structure.delegationUntil = null;
                          setDelegMsg('Délégation supprimée.');
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
                <p className={`text-xs mt-3 font-medium ${delegMsg.includes('enregistrée') || delegMsg.includes('supprimée') ? 'text-green-700' : 'text-red-600'}`}>
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
                        setEmailMsg('Email mis à jour.');
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
                <p className={`text-xs mt-2 font-medium ${emailMsg.includes('mis à jour') ? 'text-green-700' : 'text-red-600'}`}>
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
    </>
  );
}
