'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// ── Types ──────────────────────────────────────────────────────────────────

interface Proposition {
  id: string;
  sejour_slug: string;
  sejour_titre: string;
  enfant_prenom: string;
  enfant_nom_initiale: string;
  session_start: string;
  session_end: string;
  ville_depart: string;
  prix_total: number;
  prix_sejour: number;
  prix_transport: number;
  prix_encadrement: number;
  encadrement: boolean;
  status: 'brouillon' | 'demandee' | 'envoyee' | 'validee' | 'refusee';
  has_pdf: boolean;
  inscription_id: string | null;
  created_at: string;
  validated_at: string | null;
  sent_at: string | null;
}

interface Props {
  code: string;
}

type StatusFilter = 'all' | 'demandee' | 'envoyee' | 'validee' | 'refusee';
type PeriodFilter = 'all' | 'last30';

// ── Constantes ─────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<Proposition['status'], { label: string; className: string }> = {
  brouillon: { label: 'Brouillon', className: 'bg-muted text-muted-foreground border-transparent' },
  demandee: { label: 'Demandée', className: 'bg-amber-100 text-amber-800 border-transparent' },
  envoyee: { label: 'Envoyée', className: 'bg-accent/10 text-accent border-transparent' },
  validee: { label: 'Acceptée', className: 'bg-primary-50 text-primary border-transparent' },
  refusee: { label: 'Refusée', className: 'bg-destructive/10 text-destructive border-transparent' },
};

const PAGE_SIZE = 20;

function fmt(d: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return d;
  }
}

function fmtEur(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Composant ──────────────────────────────────────────────────────────────

export default function StructurePropositionsTab({ code }: Props) {
  const [propositions, setPropositions] = useState<Proposition[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');

  const fetchPropositions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (periodFilter === 'last30') params.set('since', '30');

      const res = await fetch(`/api/structure/${code}/propositions?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || body?.error || 'Impossible de charger les propositions.');
      }
      const data = await res.json();
      setPropositions(data.propositions ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [code, page, statusFilter, periodFilter]);

  useEffect(() => {
    void fetchPropositions();
  }, [fetchPropositions]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  function handleStatusChange(next: StatusFilter) {
    setStatusFilter(next);
    setPage(1);
  }

  function handlePeriodChange(next: PeriodFilter) {
    setPeriodFilter(next);
    setPage(1);
  }

  // ── Loading ──
  if (loading && propositions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-brand shadow-card border border-brand-border p-6">
          <Skeleton className="h-5 w-64 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* En-tête + filtres */}
      <div className="bg-white rounded-brand shadow-card border border-brand-border p-4 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h2 className="text-base font-semibold text-primary">Propositions tarifaires reçues</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Historique des propositions envoyées par Groupe &amp; Découverte pour votre structure.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground" htmlFor="prop-status">
            Statut
          </label>
          <select
            id="prop-status"
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value as StatusFilter)}
            className="text-sm border border-brand-border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            <option value="all">Tous</option>
            <option value="demandee">Demandées</option>
            <option value="envoyee">Envoyées</option>
            <option value="validee">Acceptées</option>
            <option value="refusee">Refusées</option>
          </select>

          <label className="text-xs text-muted-foreground ml-2" htmlFor="prop-period">
            Période
          </label>
          <select
            id="prop-period"
            value={periodFilter}
            onChange={(e) => handlePeriodChange(e.target.value as PeriodFilter)}
            className="text-sm border border-brand-border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            <option value="all">Toutes</option>
            <option value="last30">30 derniers jours</option>
          </select>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchPropositions()}
            aria-label="Rafraîchir"
            className="min-h-[40px]"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div role="alert" className="bg-white rounded-brand shadow-card border border-brand-border p-6 text-center">
          <p className="text-destructive text-sm font-medium mb-3">{error}</p>
          <Button variant="secondary" size="sm" onClick={fetchPropositions}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Réessayer
          </Button>
        </div>
      )}

      {/* Vide */}
      {!error && !loading && propositions.length === 0 && (
        <div className="bg-white rounded-brand shadow-card border border-brand-border p-10 text-center">
          <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Aucune proposition reçue pour l&apos;instant.</p>
        </div>
      )}

      {/* Liste */}
      {!error && propositions.length > 0 && (
        <div className="bg-white rounded-brand shadow-card border border-brand-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-brand-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reçue le</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Séjour</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Enfant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Session</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prix total</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {propositions.map((p) => {
                  const cfg = STATUT_CONFIG[p.status] ?? STATUT_CONFIG.brouillon;
                  const enfantLabel = `${p.enfant_prenom ?? ''} ${p.enfant_nom_initiale ?? ''}`.trim() || '—';
                  return (
                    <tr key={p.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 text-primary whitespace-nowrap">{fmt(p.created_at)}</td>
                      <td className="px-4 py-3 text-primary">
                        <div className="font-medium">{p.sejour_titre || p.sejour_slug}</div>
                        <div className="text-xs text-muted-foreground">Départ : {p.ville_depart || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-primary whitespace-nowrap">{enfantLabel}</td>
                      <td className="px-4 py-3 text-primary whitespace-nowrap text-xs">
                        {fmt(p.session_start)} &rarr; {fmt(p.session_end)}
                      </td>
                      <td className="px-4 py-3 text-primary text-right font-medium whitespace-nowrap">
                        {fmtEur(Number(p.prix_total || 0))} &euro;
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={cfg.className}>{cfg.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.has_pdf ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="min-h-[44px] min-w-[44px]"
                            onClick={() =>
                              window.open(`/api/structure/${code}/propositions/pdf?id=${p.id}`, '_blank', 'noopener,noreferrer')
                            }
                            aria-label={`Télécharger PDF proposition ${p.sejour_titre || p.sejour_slug}`}
                          >
                            <Download className="w-4 h-4 text-primary" aria-hidden="true" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-brand-border bg-muted/30">
              <p className="text-xs text-muted-foreground">
                Page {page} / {totalPages} · {total} proposition{total > 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Page précédente"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  Précédent
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Page suivante"
                >
                  Suivant
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
