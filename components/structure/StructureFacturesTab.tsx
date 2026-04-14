'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// ── Types ──────────────────────────────────────────────────────────────────

interface Facture {
  id: string;
  numero: string;
  date: string;
  montant_total: number;
  montant_paye: number;
  solde: number;
  statut: 'brouillon' | 'envoyee' | 'payee_partiel' | 'payee' | 'annulee';
}

interface Props {
  code: string;
}

// ── Constantes ─────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<Facture['statut'], { label: string; className: string }> = {
  brouillon:      { label: 'Brouillon',        className: 'bg-muted text-muted-foreground border-transparent' },
  envoyee:        { label: 'Envoyée',          className: 'bg-accent/10 text-accent border-transparent' },
  payee_partiel:  { label: 'Paiement partiel', className: 'bg-amber-100 text-amber-800 border-transparent' },
  payee:          { label: 'Payée',            className: 'bg-primary-50 text-primary border-transparent' },
  annulee:        { label: 'Annulée',          className: 'bg-muted text-muted-foreground border-transparent' },
};

function fmt(d: string) {
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

export default function StructureFacturesTab({ code }: Props) {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFactures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/structure/${code}/factures`, { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || 'Impossible de charger les factures.');
      }
      const data = await res.json();
      setFactures(data.factures ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    fetchFactures();
  }, [fetchFactures]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-brand shadow-card border border-brand-border p-6">
          <Skeleton className="h-5 w-48 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Erreur ──
  if (error) {
    return (
      <div role="alert" className="bg-white rounded-brand shadow-card border border-brand-border p-8 text-center">
        <p className="text-destructive text-sm font-medium mb-4">{error}</p>
        <Button variant="secondary" size="sm" onClick={fetchFactures}>
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Réessayer
        </Button>
      </div>
    );
  }

  // ── Vide ──
  if (factures.length === 0) {
    return (
      <div className="bg-white rounded-brand shadow-card border border-brand-border p-10 text-center">
        <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Aucune facture pour le moment.</p>
      </div>
    );
  }

  // ── Liste ──
  return (
    <div className="bg-white rounded-brand shadow-card border border-brand-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b border-brand-border">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Numéro</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Montant total</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payé</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Solde</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Statut</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {factures.map(f => {
              const cfg = STATUT_CONFIG[f.statut] ?? STATUT_CONFIG.brouillon;
              const pct = f.montant_total > 0 ? Math.min(100, Math.round((f.montant_paye / f.montant_total) * 100)) : 0;

              return (
                <tr key={f.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-primary font-medium whitespace-nowrap">{f.numero}</td>
                  <td className="px-4 py-3 text-primary whitespace-nowrap">{fmt(f.date)}</td>
                  <td className="px-4 py-3 text-primary text-right font-medium whitespace-nowrap">{fmtEur(f.montant_total)} &euro;</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-primary">{fmtEur(f.montant_paye)} &euro;</span>
                      {f.montant_total > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progression paiement">
                            <div
                              className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-amber-500' : 'bg-muted'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-muted-foreground">{pct}%</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-primary text-right font-medium whitespace-nowrap">{fmtEur(f.solde)} &euro;</td>
                  <td className="px-4 py-3">
                    <Badge className={cfg.className}>{cfg.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="min-h-[44px] min-w-[44px]"
                      onClick={() => window.open(`/api/structure/${code}/factures/pdf?id=${f.id}`, '_blank')}
                      aria-label={`Télécharger PDF facture ${f.numero}`}
                    >
                      <Download className="w-4 h-4 text-primary" aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
