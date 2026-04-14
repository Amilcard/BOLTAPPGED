'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus, FileDown, Eye, CreditCard, Loader2, X, Check, Send,
  Clock, Ban, Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminUI } from '@/components/admin/admin-ui';

/* ───────────────────── Types ───────────────────── */

interface EnfantLine {
  enfant_prenom: string;
  enfant_nom: string;
  sejour_titre: string;
  session_start: string;
  session_end: string;
  ville_depart: string;
  prix_sejour: number;
  prix_transport: number;
  prix_encadrement: number;
}

interface Facture {
  id: string;
  numero: string;
  structure_nom: string;
  structure_adresse: string;
  structure_cp: string;
  structure_ville: string;
  lignes: EnfantLine[];
  montant_total: number;
  status: string;
  created_at: string;
}

interface Paiement {
  id: string;
  facture_id: string;
  date_paiement: string;
  montant: number;
  methode: string;
  reference: string;
  note: string;
  created_at: string;
}

/* ───────────────────── Constants ───────────────────── */

const EMPTY_LINE: EnfantLine = {
  enfant_prenom: '',
  enfant_nom: '',
  sejour_titre: '',
  session_start: '',
  session_end: '',
  ville_depart: '',
  prix_sejour: 0,
  prix_transport: 0,
  prix_encadrement: 0,
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  brouillon:      { label: 'Brouillon',        className: 'bg-muted text-muted-foreground',          icon: Clock },
  envoyee:        { label: 'Envoyée',          className: 'bg-accent/10 text-accent',                icon: Send },
  payee_partiel:  { label: 'Paiement partiel', className: 'bg-amber-100 text-amber-700',             icon: CreditCard },
  payee:          { label: 'Payée',            className: 'bg-primary-50 text-primary',               icon: Check },
  annulee:        { label: 'Annulée',          className: 'bg-muted text-muted-foreground line-through', icon: Ban },
};

/* ───────────────────── Helpers ───────────────────── */

const lineTotalOf = (l: EnfantLine) =>
  (Number(l.prix_sejour) || 0) + (Number(l.prix_transport) || 0) + (Number(l.prix_encadrement) || 0);

const formatPrice = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' \u20AC';
const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR');

const authHeaders = () => ({ 'Content-Type': 'application/json' });

/* ═══════════════════════════════════════════════════ */
/*                    PAGE COMPONENT                   */
/* ═══════════════════════════════════════════════════ */

export default function FacturesPage() {
  const { toast } = useAdminUI();

  /* ── List state ── */
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── Form state ── */
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [structureNom, setStructureNom] = useState('');
  const [structureAdresse, setStructureAdresse] = useState('');
  const [structureCp, setStructureCp] = useState('');
  const [structureVille, setStructureVille] = useState('');
  const [lignes, setLignes] = useState<EnfantLine[]>([{ ...EMPTY_LINE }]);

  /* ── Preview dialog (existing facture) ── */
  const [previewFacture, setPreviewFacture] = useState<Facture | null>(null);

  /* ── Payment panel ── */
  const [paymentFacture, setPaymentFacture] = useState<Facture | null>(null);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [paiementsLoading, setPaiementsLoading] = useState(false);
  const [payForm, setPayForm] = useState({
    date_paiement: new Date().toISOString().slice(0, 10),
    montant: 0,
    methode: 'Virement',
    reference: '',
    note: '',
  });
  const [paySubmitting, setPaySubmitting] = useState(false);

  /* ── Row-level loading ── */
  const [rowLoading, setRowLoading] = useState<string | null>(null);

  /* ───────── Computed ───────── */
  const montantTotal = lignes.reduce((sum, l) => sum + lineTotalOf(l), 0);

  /* ───────── Data fetching ───────── */

  const [loadError, setLoadError] = useState<string | null>(null);

  const loadFactures = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await fetch('/api/admin/factures', { headers: authHeaders() });
      if (!res.ok) {
        setLoadError('Erreur de chargement des factures. Rechargez la page.');
        return;
      }
      const data = await res.json();
      setFactures(data.factures || []);
    } catch {
      setLoadError('Erreur réseau. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadFactures(); }, [loadFactures]);

  const loadPaiements = useCallback(async (factureId: string) => {
    setPaiementsLoading(true);
    try {
      const res = await fetch(`/api/admin/factures/${factureId}/paiements`, { headers: authHeaders() });
      const data = await res.json();
      setPaiements(data.paiements || []);
    } catch {
      setPaiements([]);
    } finally {
      setPaiementsLoading(false);
    }
  }, []);

  /* ───────── Form actions ───────── */

  const updateLine = (idx: number, patch: Partial<EnfantLine>) => {
    setLignes(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLignes(prev => [...prev, { ...EMPTY_LINE }]);

  const removeLine = (idx: number) => {
    if (lignes.length <= 1) return;
    setLignes(prev => prev.filter((_, i) => i !== idx));
  };

  const resetForm = () => {
    setStructureNom('');
    setStructureAdresse('');
    setStructureCp('');
    setStructureVille('');
    setLignes([{ ...EMPTY_LINE }]);
    setError('');
    setShowPreview(false);
    setShowForm(false);
  };

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!structureNom.trim()) {
      setError('Le nom de la structure est requis.');
      return;
    }
    // Validation des lignes enfant
    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i];
      if (!l.enfant_nom?.trim() || !l.enfant_prenom?.trim()) {
        setError(`Ligne ${i + 1} : nom et prénom de l'enfant sont requis.`);
        return;
      }
      if (l.session_start && l.session_end && l.session_start > l.session_end) {
        setError(`Ligne ${i + 1} : la date de début doit être avant la date de fin.`);
        return;
      }
      if (l.prix_sejour < 0 || l.prix_transport < 0 || l.prix_encadrement < 0) {
        setError(`Ligne ${i + 1} : les prix ne peuvent pas être négatifs.`);
        return;
      }
    }
    setShowPreview(true);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/admin/factures', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          structure_nom: structureNom,
          structure_adresse: structureAdresse,
          structure_cp: structureCp,
          structure_ville: structureVille,
          lignes,
          montant_total: montantTotal,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur création facture');
      resetForm();
      void loadFactures();
      toast('Facture créée avec succès', 'success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  /* ───────── Status update ───────── */

  const updateStatus = async (id: string, status: string) => {
    if (rowLoading) return;
    setRowLoading(id);
    try {
      const res = await fetch('/api/admin/factures', {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ id, statut: status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(`Erreur : ${err?.error || res.status}`);
      }
      void loadFactures();
    } catch {
      toast('Erreur réseau');
    } finally {
      setRowLoading(null);
    }
  };

  /* ───────── PDF download ───────── */

  const downloadPdf = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/factures/pdf?id=${id}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      toast('Erreur lors de la génération du PDF');
    }
  };

  /* ───────── Payment actions ───────── */

  const openPaymentPanel = (f: Facture) => {
    setPaymentFacture(f);
    setPayForm({
      date_paiement: new Date().toISOString().slice(0, 10),
      montant: 0,
      methode: 'Virement',
      reference: '',
      note: '',
    });
    void loadPaiements(f.id);
  };

  const submitPaiement = async () => {
    if (!paymentFacture) return;
    setPaySubmitting(true);
    try {
      const res = await fetch(`/api/admin/factures/${paymentFacture.id}/paiements`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Erreur enregistrement paiement');
      }
      toast('Paiement enregistré', 'success');
      void loadPaiements(paymentFacture.id);
      void loadFactures();
      setPayForm(prev => ({ ...prev, montant: 0, reference: '', note: '' }));
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Erreur paiement');
    } finally {
      setPaySubmitting(false);
    }
  };

  const totalPaye = paiements.reduce((s, p) => s + (Number(p.montant) || 0), 0);
  const soldeRestant = paymentFacture ? paymentFacture.montant_total - totalPaye : 0;
  const progressPct = paymentFacture && paymentFacture.montant_total > 0
    ? Math.min(100, Math.round((totalPaye / paymentFacture.montant_total) * 100))
    : 0;

  /* ═══════════════════════════════════════════════════ */
  /*                       RENDER                        */
  /* ═══════════════════════════════════════════════════ */

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Factures</h1>
          <p className="text-muted-foreground mt-1">Créer, suivre et encaisser les factures structures</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="min-h-[44px]">
          <Plus size={20} aria-hidden="true" />
          Nouvelle facture
        </Button>
      </div>

      {/* ══════════ CREATION FORM ══════════ */}
      {showForm && !showPreview && (
        <form
          onSubmit={handlePreview}
          className="bg-white rounded-brand shadow-card p-6 space-y-6"
        >
          <h2 className="text-lg font-semibold border-b pb-3 text-primary">Nouvelle facture</h2>

          {error && (
            <div role="alert" className="bg-destructive/10 text-destructive p-3 rounded-brand text-sm">
              {error}
            </div>
          )}

          {/* Structure info */}
          <div>
            <h3 className="font-medium text-primary mb-3">Structure</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="structure_nom" className="text-primary font-medium">Nom de la structure *</Label>
                <Input
                  id="structure_nom"
                  required
                  value={structureNom}
                  onChange={e => setStructureNom(e.target.value)}
                  placeholder="Nom de la structure"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="structure_adresse" className="text-primary font-medium">Adresse</Label>
                <Input
                  id="structure_adresse"
                  value={structureAdresse}
                  onChange={e => setStructureAdresse(e.target.value)}
                  placeholder="Adresse"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="structure_cp" className="text-primary font-medium">Code postal</Label>
                <Input
                  id="structure_cp"
                  value={structureCp}
                  onChange={e => setStructureCp(e.target.value)}
                  placeholder="Code postal"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="structure_ville" className="text-primary font-medium">Ville</Label>
                <Input
                  id="structure_ville"
                  value={structureVille}
                  onChange={e => setStructureVille(e.target.value)}
                  placeholder="Ville"
                />
              </div>
            </div>
          </div>

          {/* Enfant lines */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-primary">Lignes enfants</h3>
              <Button type="button" variant="secondary" size="sm" onClick={addLine} className="min-h-[44px]">
                <Plus size={16} aria-hidden="true" />
                Ajouter un enfant
              </Button>
            </div>

            <div className="space-y-4">
              {lignes.map((line, idx) => (
                <div key={idx} className="bg-muted rounded-brand p-4 space-y-3 relative">
                  {lignes.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 min-h-[44px]"
                      onClick={() => removeLine(idx)}
                      aria-label={`Supprimer la ligne ${idx + 1}`}
                    >
                      <X size={16} aria-hidden="true" />
                    </Button>
                  )}

                  <p className="text-sm font-semibold text-primary">Enfant {idx + 1}</p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor={`prenom_${idx}`} className="text-primary font-medium">Prénom</Label>
                      <Input
                        id={`prenom_${idx}`}
                        value={line.enfant_prenom}
                        onChange={e => updateLine(idx, { enfant_prenom: e.target.value })}
                        placeholder="Prénom"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`nom_${idx}`} className="text-primary font-medium">Nom</Label>
                      <Input
                        id={`nom_${idx}`}
                        value={line.enfant_nom}
                        onChange={e => updateLine(idx, { enfant_nom: e.target.value })}
                        placeholder="Nom"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`sejour_${idx}`} className="text-primary font-medium">Séjour</Label>
                      <Input
                        id={`sejour_${idx}`}
                        value={line.sejour_titre}
                        onChange={e => updateLine(idx, { sejour_titre: e.target.value })}
                        placeholder="Titre du séjour"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor={`start_${idx}`} className="text-primary font-medium">Début session</Label>
                      <Input
                        id={`start_${idx}`}
                        type="date"
                        value={line.session_start}
                        onChange={e => updateLine(idx, { session_start: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`end_${idx}`} className="text-primary font-medium">Fin session</Label>
                      <Input
                        id={`end_${idx}`}
                        type="date"
                        value={line.session_end}
                        onChange={e => updateLine(idx, { session_end: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`ville_${idx}`} className="text-primary font-medium">Ville de départ</Label>
                      <Input
                        id={`ville_${idx}`}
                        value={line.ville_depart}
                        onChange={e => updateLine(idx, { ville_depart: e.target.value })}
                        placeholder="Ville de départ"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor={`prix_sejour_${idx}`} className="text-primary font-medium">Prix séjour</Label>
                      <Input
                        id={`prix_sejour_${idx}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.prix_sejour || ''}
                        onChange={e => updateLine(idx, { prix_sejour: Number(e.target.value) || 0 })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`prix_transport_${idx}`} className="text-primary font-medium">Prix transport</Label>
                      <Input
                        id={`prix_transport_${idx}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.prix_transport || ''}
                        onChange={e => updateLine(idx, { prix_transport: Number(e.target.value) || 0 })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`prix_encadrement_${idx}`} className="text-primary font-medium">Prix encadrement</Label>
                      <Input
                        id={`prix_encadrement_${idx}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.prix_encadrement || ''}
                        onChange={e => updateLine(idx, { prix_encadrement: Number(e.target.value) || 0 })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-primary font-medium">Total ligne</Label>
                      <div className="h-12 flex items-center px-4 bg-white rounded-lg border text-sm font-semibold text-secondary">
                        {formatPrice(lineTotalOf(line))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Grand total */}
            <div className="flex justify-end mt-4 pt-4 border-t">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Montant total facture</p>
                <p className="text-xl font-bold text-secondary">{formatPrice(montantTotal)}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)} className="min-h-[44px]">
              Annuler
            </Button>
            <Button type="submit" disabled={submitting} className="min-h-[44px]">
              <Eye size={18} aria-hidden="true" />
              Aperçu de la facture
            </Button>
          </div>
        </form>
      )}

      {/* ══════════ PREVIEW STEP ══════════ */}
      <Dialog open={showForm && showPreview} onOpenChange={(open) => { if (!open) setShowPreview(false); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-brand">
          <DialogHeader className="sr-only">
            <DialogTitle>Aperçu facture</DialogTitle>
            <DialogDescription>Vérifiez les informations avant de confirmer.</DialogDescription>
          </DialogHeader>
        <div className="space-y-6">
          <div className="bg-secondary text-white px-6 py-4 rounded-lg -mx-6 -mt-6">
            <p className="text-sm opacity-80">Association Groupe et Découverte</p>
            <h2 className="text-xl font-bold mt-1">Facture — Aperçu</h2>
          </div>

          {/* Structure */}
          <div className="bg-muted rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Structure</p>
            <p className="font-semibold text-primary">{structureNom}</p>
            {structureAdresse && <p className="text-sm text-muted-foreground">{structureAdresse}</p>}
            <p className="text-sm text-muted-foreground">{structureCp} {structureVille}</p>
          </div>

          {/* Lines table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Enfant</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Séjour</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Dates</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground uppercase">Séjour</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground uppercase">Transport</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground uppercase">Encadrement</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lignes.map((l, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 text-primary font-medium">{l.enfant_prenom} {l.enfant_nom}</td>
                    <td className="px-3 py-2 text-primary">{l.sejour_titre}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {l.session_start && l.session_end
                        ? `${formatDate(l.session_start)} \u2192 ${formatDate(l.session_end)}`
                        : '\u2014'}
                    </td>
                    <td className="px-3 py-2 text-right">{formatPrice(l.prix_sejour)}</td>
                    <td className="px-3 py-2 text-right">{formatPrice(l.prix_transport)}</td>
                    <td className="px-3 py-2 text-right">{formatPrice(l.prix_encadrement)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-secondary">{formatPrice(lineTotalOf(l))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-secondary">
                  <td colSpan={6} className="px-3 py-3 text-right text-lg font-bold text-primary">Total</td>
                  <td className="px-3 py-3 text-right text-lg font-bold text-secondary">{formatPrice(montantTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {error && (
            <div role="alert" className="bg-destructive/10 text-destructive p-3 rounded-brand text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setShowPreview(false)} className="min-h-[44px]">
              Modifier
            </Button>
            <Button onClick={handleConfirm} disabled={submitting} className="min-h-[44px]">
              {submitting ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
              Confirmer et enregistrer
            </Button>
          </div>
        </div>
        </DialogContent>
      </Dialog>

      {/* ══════════ LIST ══════════ */}
      {loading ? (
        <div className="bg-white rounded-brand shadow-card p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : loadError ? (
        <div className="bg-destructive/10 text-destructive rounded-brand p-6 text-center" role="alert">
          {loadError}
        </div>
      ) : factures.length === 0 ? (
        <div className="bg-white rounded-brand shadow-card p-12 text-center text-muted-foreground">
          <Receipt size={48} className="mx-auto mb-4 opacity-30" aria-hidden="true" />
          <p>Aucune facture pour le moment.</p>
          <p className="text-sm mt-2">Cliquez sur &quot;Nouvelle facture&quot; pour en créer une.</p>
        </div>
      ) : (
        <div className="bg-white rounded-brand shadow-card overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-muted border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Numéro</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Structure</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Montant</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {factures.map(f => {
                const sc = STATUS_CONFIG[f.status] || STATUS_CONFIG.brouillon;
                const isLoading = rowLoading === f.id;
                return (
                  <tr key={f.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm font-medium text-primary">{f.numero}</td>
                    <td className="px-4 py-3 text-sm text-primary">{f.structure_nom}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-primary">{formatPrice(f.montant_total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${sc.className}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(f.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="min-h-[44px]" onClick={() => setPreviewFacture(f)} aria-label={`Aperçu facture ${f.numero}`} disabled={isLoading}>
                          <Eye size={18} className="text-secondary" aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="icon" className="min-h-[44px]" onClick={() => { void downloadPdf(f.id); }} aria-label={`Télécharger PDF ${f.numero}`} disabled={isLoading}>
                          <FileDown size={18} className="text-muted-foreground" aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="icon" className="min-h-[44px]" onClick={() => openPaymentPanel(f)} aria-label={`Paiements ${f.numero}`} disabled={isLoading}>
                          <CreditCard size={18} className="text-primary" aria-hidden="true" />
                        </Button>
                        {f.status === 'brouillon' && (
                          <Button variant="ghost" size="icon" className="min-h-[44px]" onClick={() => updateStatus(f.id, 'envoyee')} aria-label={`Marquer envoyée ${f.numero}`} disabled={isLoading}>
                            <Send size={18} className="text-accent" aria-hidden="true" />
                          </Button>
                        )}
                        {(f.status === 'brouillon' || f.status === 'envoyee') && (
                          <Button variant="ghost" size="icon" className="min-h-[44px]" onClick={() => updateStatus(f.id, 'annulee')} aria-label={`Annuler facture ${f.numero}`} disabled={isLoading}>
                            <Ban size={16} className="text-muted-foreground" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ══════════ PREVIEW DIALOG ══════════ */}
      <Dialog open={!!previewFacture} onOpenChange={open => { if (!open) setPreviewFacture(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Facture {previewFacture?.numero}</DialogTitle>
            <DialogDescription>Aperçu détaillé de la facture</DialogDescription>
          </DialogHeader>

          {previewFacture && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Structure</p>
                <p className="font-semibold text-primary">{previewFacture.structure_nom}</p>
                {previewFacture.structure_adresse && (
                  <p className="text-sm text-muted-foreground">{previewFacture.structure_adresse}</p>
                )}
                <p className="text-sm text-muted-foreground">{previewFacture.structure_cp} {previewFacture.structure_ville}</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Enfant</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Séjour</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(previewFacture.lignes || []).map((l: EnfantLine, idx: number) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 text-primary">{l.enfant_prenom} {l.enfant_nom}</td>
                        <td className="px-3 py-2 text-primary">{l.sejour_titre}</td>
                        <td className="px-3 py-2 text-right font-semibold text-secondary">{formatPrice(lineTotalOf(l))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-secondary">
                      <td colSpan={2} className="px-3 py-3 text-right font-bold text-primary">Total</td>
                      <td className="px-3 py-3 text-right font-bold text-secondary">{formatPrice(previewFacture.montant_total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${(STATUS_CONFIG[previewFacture.status] || STATUS_CONFIG.brouillon).className}`}>
                  {(STATUS_CONFIG[previewFacture.status] || STATUS_CONFIG.brouillon).label}
                </span>
                <Button onClick={() => { void downloadPdf(previewFacture.id); }} className="min-h-[44px]">
                  <FileDown size={18} aria-hidden="true" />
                  Télécharger le PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════ PAYMENT PANEL DIALOG ══════════ */}
      <Dialog open={!!paymentFacture} onOpenChange={open => { if (!open) setPaymentFacture(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Paiements — {paymentFacture?.numero}</DialogTitle>
            <DialogDescription>
              Total facture : {paymentFacture ? formatPrice(paymentFacture.montant_total) : ''}
            </DialogDescription>
          </DialogHeader>

          {paymentFacture && (
            <div className="space-y-5">
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payé : {formatPrice(totalPaye)}</span>
                  <span className="font-semibold text-primary">Solde : {formatPrice(soldeRestant)}</span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label="Progression paiement">
                  <div
                    className="h-full bg-secondary rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">{progressPct}%</p>
              </div>

              {/* Existing payments */}
              {paiementsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : paiements.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">Aucun paiement enregistré</p>
              ) : (
                <div className="divide-y max-h-40 overflow-auto">
                  {paiements.map(p => (
                    <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <span className="font-medium text-primary">{formatPrice(p.montant)}</span>
                        <span className="text-muted-foreground ml-2">{p.methode}</span>
                        {p.reference && (
                          <span className="text-muted-foreground ml-1">({p.reference})</span>
                        )}
                      </div>
                      <span className="text-muted-foreground text-xs">{formatDate(p.date_paiement)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Add payment form */}
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-semibold text-primary">Enregistrer un paiement</p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="pay_date" className="text-primary font-medium">Date</Label>
                    <Input
                      id="pay_date"
                      type="date"
                      value={payForm.date_paiement}
                      onChange={e => setPayForm(prev => ({ ...prev, date_paiement: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pay_montant" className="text-primary font-medium">Montant</Label>
                    <Input
                      id="pay_montant"
                      type="number"
                      min={0}
                      step="0.01"
                      value={payForm.montant || ''}
                      onChange={e => setPayForm(prev => ({ ...prev, montant: Number(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="pay_methode" className="text-primary font-medium">Méthode</Label>
                  <Select
                    value={payForm.methode}
                    onValueChange={val => setPayForm(prev => ({ ...prev, methode: val }))}
                  >
                    <SelectTrigger id="pay_methode" className="h-12">
                      <SelectValue placeholder="Méthode de paiement" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="virement">Virement</SelectItem>
                      <SelectItem value="cb_stripe">CB Stripe</SelectItem>
                      <SelectItem value="cheque">Chèque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="pay_ref" className="text-primary font-medium">Référence</Label>
                  <Input
                    id="pay_ref"
                    value={payForm.reference}
                    onChange={e => setPayForm(prev => ({ ...prev, reference: e.target.value }))}
                    placeholder="Référence du paiement"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="pay_note" className="text-primary font-medium">Note</Label>
                  <Input
                    id="pay_note"
                    value={payForm.note}
                    onChange={e => setPayForm(prev => ({ ...prev, note: e.target.value }))}
                    placeholder="Note optionnelle"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => setPaymentFacture(null)}
                  className="min-h-[44px]"
                >
                  Fermer
                </Button>
                <Button
                  onClick={submitPaiement}
                  disabled={paySubmitting || payForm.montant <= 0}
                  className="min-h-[44px]"
                >
                  {paySubmitting ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
                  Enregistrer
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
