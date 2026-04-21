'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { formatDate } from '@/lib/utils';
import { UUID_RE } from '@/lib/validators';
import { Eye, X, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { useAdminUI } from '@/components/admin/admin-ui';
import { AdminPagination } from '@/components/ui/AdminPagination';

type WindowFilter = '30d' | '90d' | 'all';
type TreatedFilter = 'all' | 'pending' | 'done';

interface SuggestedStay {
  slug: string;
  title: string;
}

interface DemandeTarifRow {
  id: string;
  contact_email: string;
  referent_organization: string | null;
  child_age: number | null;
  urgence_48h: boolean | null;
  handicap: boolean | null;
  qf: number | null;
  qpv: boolean | null;
  suggested_stays: SuggestedStay[] | null;
  alert_priority: string | null;
  submitted_at: string;
  crm_synced_at: string | null;
  crm_lead_id: string | null;
  consent_at: string | null;
}

interface DemandeTarifDetail extends DemandeTarifRow {
  contact_phone: string | null;
  inclusion_level: string | null;
  interests: string[] | null;
  user_agent: string | null;
}

const PRIORITY_STYLES: Record<string, string> = {
  HIGH_PRIORITY_CALL_NOW: 'bg-red-100 text-red-700',
  HOT_LEAD: 'bg-orange-100 text-orange-700',
  WARM_LEAD: 'bg-amber-100 text-amber-700',
  COLD_LEAD: 'bg-gray-100 text-gray-600',
};

function priorityBadge(priority: string | null) {
  if (!priority) return { label: '—', color: 'bg-gray-50 text-gray-400' };
  const color = PRIORITY_STYLES[priority] ?? 'bg-gray-100 text-gray-600';
  return { label: priority.replace(/_/g, ' '), color };
}

function staysLabel(stays: SuggestedStay[] | null): string {
  if (!Array.isArray(stays) || stays.length === 0) return '—';
  return stays.map((s) => s.title ?? s.slug).join(', ');
}

const LIMIT = 20;

export default function AdminDemandesTarifs() {
  const { toast } = useAdminUI();
  const [rows, setRows] = useState<DemandeTarifRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [windowFilter, setWindowFilter] = useState<WindowFilter>('30d');
  const [treatedFilter, setTreatedFilter] = useState<TreatedFilter>('all');

  const [detail, setDetail] = useState<DemandeTarifDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [patching, setPatching] = useState(false);

  const totalPages = Math.ceil(total / LIMIT);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (email.trim()) p.set('email', email.trim());
    if (organization.trim()) p.set('organization', organization.trim());
    if (windowFilter) p.set('window', windowFilter);
    if (treatedFilter) p.set('treated', treatedFilter);
    p.set('page', String(page));
    p.set('limit', String(LIMIT));
    return p.toString();
  }, [email, organization, windowFilter, treatedFilter, page]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/demandes-tarifs?${queryString}`);
      if (!res.ok) {
        toast('Erreur de chargement des demandes. Rechargez la page.');
        return;
      }
      const json = await res.json();
      setRows(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch (err) {
      console.error('fetch demandes-tarifs:', err);
      toast('Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }, [queryString, toast]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const openDetail = async (id: string) => {
    if (!UUID_RE.test(id)) return;
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/demandes-tarifs/${id}`);
      if (!res.ok) {
        toast('Impossible de charger le détail.');
        return;
      }
      const data = await res.json();
      setDetail(data);
    } catch {
      toast('Erreur réseau.');
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleTreated = async (id: string, treated: boolean) => {
    if (!UUID_RE.test(id)) return;
    setPatching(true);
    try {
      const res = await fetch(`/api/admin/demandes-tarifs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ treated }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(`Erreur : ${err?.error?.message ?? 'mise à jour échouée'}`);
        return;
      }
      toast(treated ? 'Marqué comme traité.' : 'Remis en attente.', 'success');
      setDetail(null);
      void fetchRows();
    } finally {
      setPatching(false);
    }
  };

  const resetFilters = () => {
    setEmail('');
    setOrganization('');
    setWindowFilter('30d');
    setTreatedFilter('all');
    setPage(1);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <h1 className="text-3xl font-bold text-primary">
          Demandes de propositions tarifaires ({total})
        </h1>
      </div>

      <div className="bg-white rounded-brand shadow-card p-4 mb-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label htmlFor="filter-email" className="text-xs font-medium text-gray-600 mb-1">
            Email
          </label>
          <input
            id="filter-email"
            type="text"
            value={email}
            onChange={(e) => {
              setPage(1);
              setEmail(e.target.value);
            }}
            placeholder="contact@…"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="filter-org" className="text-xs font-medium text-gray-600 mb-1">
            Organisation
          </label>
          <input
            id="filter-org"
            type="text"
            value={organization}
            onChange={(e) => {
              setPage(1);
              setOrganization(e.target.value);
            }}
            placeholder="Structure, MECS, ASE…"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="filter-window" className="text-xs font-medium text-gray-600 mb-1">
            Période
          </label>
          <select
            id="filter-window"
            value={windowFilter}
            onChange={(e) => {
              setPage(1);
              setWindowFilter(e.target.value as WindowFilter);
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="30d">30 derniers jours</option>
            <option value="90d">90 derniers jours</option>
            <option value="all">Tout</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label htmlFor="filter-treated" className="text-xs font-medium text-gray-600 mb-1">
            Statut
          </label>
          <select
            id="filter-treated"
            value={treatedFilter}
            onChange={(e) => {
              setPage(1);
              setTreatedFilter(e.target.value as TreatedFilter);
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">Tous</option>
            <option value="pending">À traiter</option>
            <option value="done">Traités</option>
          </select>
        </div>
        <button
          onClick={resetFilters}
          className="ml-auto text-sm text-gray-500 underline hover:text-gray-700"
        >
          Réinitialiser
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-brand shadow-card-sm overflow-hidden">
          {[...Array(5)].map((_, i) => (
            // deepsource-ignore JS-0437 -- static array skeleton, i is the stable key
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-4 bg-gray-200 rounded w-48 flex-1" />
              <div className="h-4 bg-gray-200 rounded w-32" />
              <div className="h-6 bg-gray-200 rounded-full w-20" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-brand shadow-card p-8 text-center text-gray-500">
          Aucune demande pour les filtres sélectionnés.
        </div>
      ) : (
        <div className="bg-white rounded-brand shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Liste des demandes de propositions tarifaires">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Email</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Organisation</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Séjours suggérés</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Priorité</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Consent.</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Statut</th>
                  <th className="px-4 py-4 text-right text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const prio = priorityBadge(row.alert_priority);
                  const treated = Boolean(row.crm_synced_at);
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      tabIndex={0}
                      onClick={() => void openDetail(row.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void openDetail(row.id);
                      }}
                    >
                      <td className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {formatDate(row.submitted_at)}
                      </td>
                      <td className="px-4 py-4 font-medium text-sm break-all">
                        {row.contact_email}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 max-w-[220px] truncate" title={row.referent_organization ?? ''}>
                        {row.referent_organization || '—'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 max-w-[260px] truncate" title={staysLabel(row.suggested_stays)}>
                        {staysLabel(row.suggested_stays)}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${prio.color}`}>
                          {prio.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs">
                        {row.consent_at ? (
                          <span className="inline-flex items-center gap-1 text-green-700">
                            <CheckCircle2 size={14} aria-hidden="true" /> OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            <AlertTriangle size={14} aria-hidden="true" /> N/A
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs">
                        {treated ? (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <CheckCircle2 size={14} aria-hidden="true" /> Traité
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-500">
                            <Clock size={14} aria-hidden="true" /> À traiter
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => void openDetail(row.id)}
                          className="p-2 hover:bg-gray-100 rounded"
                          title="Voir le détail"
                          aria-label={`Voir le détail de la demande de ${row.contact_email}`}
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <AdminPagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPage={(p) => setPage(p)} />
        </div>
      )}

      {(detail || detailLoading) && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-title"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-white rounded-brand shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 id="detail-title" className="text-xl font-bold text-primary">
                Détail de la demande
              </h2>
              <button
                onClick={() => setDetail(null)}
                className="p-2 hover:bg-gray-100 rounded"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            {detailLoading ? (
              <div className="p-8 text-center text-gray-500">Chargement…</div>
            ) : detail ? (
              <div className="p-6 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Date de soumission" value={formatDate(detail.submitted_at)} />
                  <Field label="Consentement" value={detail.consent_at ? formatDate(detail.consent_at) : '—'} />
                  <Field label="Email" value={detail.contact_email} mono />
                  <Field label="Téléphone" value={detail.contact_phone || '—'} />
                  <Field label="Organisation" value={detail.referent_organization || '—'} />
                  <Field label="Niveau inclusion" value={detail.inclusion_level || '—'} />
                  <Field label="Âge enfant" value={detail.child_age?.toString() || '—'} />
                  <Field label="QF" value={detail.qf?.toString() || '—'} />
                  <Field label="QPV" value={detail.qpv ? 'Oui' : 'Non'} />
                  <Field label="Handicap" value={detail.handicap ? 'Oui' : 'Non'} />
                  <Field label="Urgence 48h" value={detail.urgence_48h ? 'Oui' : 'Non'} />
                  <Field label="Priorité alerte" value={detail.alert_priority || '—'} />
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Séjours suggérés
                  </div>
                  <div className="text-gray-800">{staysLabel(detail.suggested_stays)}</div>
                </div>

                {detail.interests && detail.interests.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Intérêts
                    </div>
                    <div className="text-gray-800">{detail.interests.join(', ')}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                  <Field
                    label="Statut traitement"
                    value={detail.crm_synced_at ? `Traité le ${formatDate(detail.crm_synced_at)}` : 'À traiter'}
                  />
                  <Field label="CRM lead id" value={detail.crm_lead_id || '—'} mono />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                  {detail.crm_synced_at ? (
                    <button
                      onClick={() => void toggleTreated(detail.id, false)}
                      disabled={patching}
                      className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      Remettre en attente
                    </button>
                  ) : (
                    <button
                      onClick={() => void toggleTreated(detail.id, true)}
                      disabled={patching}
                      className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                    >
                      {patching ? 'Enregistrement…' : 'Marquer comme traité'}
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-gray-800 ${mono ? 'font-mono text-xs break-all' : ''}`}>{value}</div>
    </div>
  );
}
