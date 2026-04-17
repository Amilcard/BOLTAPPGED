'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Building2, Search, Link2, GitMerge, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useAdminUI } from '@/components/admin/admin-ui';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminPagination } from '@/components/ui/AdminPagination';

interface Structure {
  id: string;
  name: string;
  code: string;
  city: string;
  postalCode: string;
  type: string;
  email: string;
  status: string;
  address: string;
  createdAt: string;
  inscriptionCount: number;
}

interface Orphan {
  id: string;
  dossierRef: string;
  structurePendingName: string;
  postalCode: string;
  city: string;
  type: string;
  referentNom: string;
  referentEmail: string;
  jeunePrenom: string;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  association: 'Association',
  ccas: 'CCAS',
  foyer: 'Foyer',
  pjj: 'PJJ',
  ase: 'ASE',
  mecs: 'MECS',
  autre: 'Autre',
};

export default function AdminStructures() {
  const { confirm, toast } = useAdminUI();
  const [structures, setStructures] = useState<Structure[]>([]);
  const [orphans, setOrphans] = useState<Orphan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 50;
  const [total, setTotal] = useState(0);
  const totalPages = Math.ceil(total / LIMIT);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tab, setTab] = useState<'structures' | 'orphelines'>('structures');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedInscriptions, setExpandedInscriptions] = useState<Record<string, unknown>[]>([]);
  const [mergeSource, setMergeSource] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  // Picker dialog state (replaces native prompt)
  const [linkPicker, setLinkPicker] = useState<{
    orphanId: string;
    orphan: Orphan;
    matchingStructures: Structure[];
  } | null>(null);
  const [pickerSelectedId, setPickerSelectedId] = useState('');

  const headers = { 'Content-Type': 'application/json' };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('limit', String(LIMIT));
      const res = await fetch(`/api/admin/structures?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setStructures(data.structures || []);
        setOrphans(data.orphans || []);
        setTotal(data.total ?? (data.structures || []).length);
      }
    } catch (err) {
      console.error('Fetch structures error:', err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Charger les inscriptions d'une structure (détail)
  const toggleDetail = async (structureId: string) => {
    if (expandedId === structureId) {
      setExpandedId(null);
      setExpandedInscriptions([]);
      return;
    }
    setExpandedId(structureId);
    try {
      const res = await fetch(`/api/admin/inscriptions?structure_id=${structureId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.data ?? data.inscriptions ?? []);
        setExpandedInscriptions(list);
      }
    } catch {
      setExpandedInscriptions([]);
    }
  };

  // Fusion
  const handleMerge = (targetId: string) => {
    if (!mergeSource || mergeSource === targetId) return;
    const sourceName = structures.find(s => s.id === mergeSource)?.name || 'source';
    const targetName = structures.find(s => s.id === targetId)?.name || 'cible';
    confirm(
      `Fusionner "${sourceName}" dans "${targetName}" ? Toutes les inscriptions et souhaits seront transférés. Cette action est irréversible.`,
      async () => {
        const res = await fetch('/api/admin/structures/merge', {
          method: 'POST',
          headers,
          body: JSON.stringify({ sourceId: mergeSource, targetId }),
        });
        if (res.ok) {
          setMergeSource(null);
          setSuccessMsg(`Fusion réussie : "${sourceName}" → "${targetName}"`);
          setTimeout(() => setSuccessMsg(''), 4000);
          fetchData();
        }
      }
    );
  };

  // Rattachement orpheline
  const handleLink = (orphanId: string) => {
    const orphan = orphans.find(o => o.id === orphanId);
    if (!orphan) return;

    const matchingStructures = structures.filter(s => s.postalCode === orphan.postalCode);
    if (matchingStructures.length === 0) {
      toast('Aucune structure active trouvée sur ce code postal. Créez la structure d\'abord.');
      return;
    }

    if (matchingStructures.length === 1) {
      // Single match: go straight to confirm
      confirmAndLink(orphan, matchingStructures[0].id);
    } else {
      // Multiple matches: open picker dialog
      setPickerSelectedId('');
      setLinkPicker({ orphanId, orphan, matchingStructures });
    }
  };

  const confirmAndLink = (orphan: Orphan, selectedId: string) => {
    const selectedName = structures.find(s => s.id === selectedId)?.name || '';
    confirm(
      `Rattacher l'inscription ${orphan.dossierRef} (${orphan.jeunePrenom}) à "${selectedName}" ?`,
      async () => {
        const res = await fetch('/api/admin/structures/link', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ inscriptionId: orphan.id, structureId: selectedId }),
        });
        if (res.ok) {
          setSuccessMsg(`Inscription ${orphan.dossierRef} rattachée à "${selectedName}"`);
          setTimeout(() => setSuccessMsg(''), 4000);
          fetchData();
        }
      }
    );
  };

  const handlePickerConfirm = () => {
    if (!linkPicker || !pickerSelectedId) return;
    const { orphan } = linkPicker;
    setLinkPicker(null);
    confirmAndLink(orphan, pickerSelectedId);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
          <Building2 size={32} /> Structures
        </h1>
        <div className="flex items-center gap-4">
          {mergeSource && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
              <GitMerge size={16} />
              Mode fusion actif — cliquez sur la structure cible
              <button onClick={() => setMergeSource(null)} className="ml-2 underline">Annuler</button>
            </div>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="mb-4 bg-primary-50 border border-primary-100 rounded-lg px-4 py-3 text-primary text-sm">
          {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setTab('structures')}
          className={`px-4 py-2 rounded-lg font-medium transition ${tab === 'structures' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          Structures ({structures.length})
        </button>
        <button
          onClick={() => setTab('orphelines')}
          className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${tab === 'orphelines' ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          {orphans.length > 0 && <AlertTriangle size={16} />}
          Orphelines ({orphans.length})
        </button>
      </div>

      {/* Search */}
      {tab === 'structures' && (
        <div className="mb-6 relative">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, ville ou code..."
            value={searchInput}
            onChange={e => {
              setSearchInput(e.target.value);
              if (debounceRef.current) clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(() => { setPage(1); setSearch(e.target.value); }, 300);
            }}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      )}

      {loading && <p className="text-gray-500">Chargement...</p>}

      {/* Tab Structures */}
      {tab === 'structures' && !loading && (
        <div className="bg-white rounded-brand shadow-card overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nom</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ville</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">CP</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Inscr.</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {structures.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Aucune structure trouvée</td></tr>
              )}
              {structures.map(s => (
                <tr key={s.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.city}</td>
                  <td className="px-4 py-3 text-gray-600">{s.postalCode}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block bg-primary-50 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                      {TYPE_LABELS[s.type] || s.type || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">{s.code || '—'}</code>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${s.inscriptionCount > 0 ? 'bg-primary-50 text-primary' : 'bg-gray-100 text-gray-400'}`}>
                      {s.inscriptionCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <button
                      onClick={() => { void toggleDetail(s.id); }}
                      className="text-primary hover:text-primary/80 text-sm flex items-center gap-1"
                      title="Voir les inscriptions"
                    >
                      {expandedId === s.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      Détail
                    </button>
                    {mergeSource && mergeSource !== s.id ? (
                      <button
                        onClick={() => handleMerge(s.id)}
                        className="text-amber-600 hover:text-amber-800 text-sm flex items-center gap-1"
                        title="Fusionner vers cette structure"
                      >
                        <GitMerge size={14} /> Fusionner ici
                      </button>
                    ) : (
                      <button
                        onClick={() => setMergeSource(mergeSource === s.id ? null : s.id)}
                        className={`text-sm flex items-center gap-1 ${mergeSource === s.id ? 'text-red-600' : 'text-gray-400 hover:text-gray-600'}`}
                        title={mergeSource === s.id ? 'Annuler' : 'Sélectionner comme source de fusion'}
                      >
                        <GitMerge size={14} /> {mergeSource === s.id ? 'Annuler' : 'Fusionner'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Détail inscriptions */}
          {expandedId && expandedInscriptions.length > 0 && (
            <div className="bg-muted border-t border-primary-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-primary mb-3">
                Inscriptions rattachées ({expandedInscriptions.length})
              </h3>
              <div className="space-y-2">
                {expandedInscriptions.map((insc: Record<string, unknown>) => (
                  <div key={insc.id as string} className="bg-white rounded-lg px-4 py-2 text-sm flex justify-between items-center">
                    <span>
                      <strong>{(insc.jeune_prenom || insc.jeunePrenom) as string}</strong>
                      {' — '}
                      {(insc.referent_nom || insc.referentNom) as string}
                      {' ('}
                      {(insc.referent_email || insc.referentEmail) as string}
                      {')'}
                    </span>
                    <span className="text-gray-400">
                      {(insc.dossier_ref || insc.dossierRef) as string}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {expandedId && expandedInscriptions.length === 0 && (
            <div className="bg-muted border-t border-primary-100 px-6 py-4 text-sm text-gray-500">
              Aucune inscription rattachée à cette structure.
            </div>
          )}
          <AdminPagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPage={(p) => setPage(p)} />
        </div>
      )}

      {/* Tab Orphelines */}
      {tab === 'orphelines' && !loading && (
        <div className="bg-white rounded-brand shadow-card overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-amber-50 border-b">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-amber-700 uppercase">Dossier</th>
                <th className="px-4 py-3 text-xs font-semibold text-amber-700 uppercase">Structure déclarée</th>
                <th className="px-4 py-3 text-xs font-semibold text-amber-700 uppercase">CP / Ville</th>
                <th className="px-4 py-3 text-xs font-semibold text-amber-700 uppercase">Référent</th>
                <th className="px-4 py-3 text-xs font-semibold text-amber-700 uppercase">Jeune</th>
                <th className="px-4 py-3 text-xs font-semibold text-amber-700 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {orphans.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Aucune inscription orpheline</td></tr>
              )}
              {orphans.map(o => (
                <tr key={o.id} className="border-b hover:bg-amber-50/30 transition">
                  <td className="px-4 py-3 font-mono text-sm">{o.dossierRef}</td>
                  <td className="px-4 py-3 font-medium">{o.structurePendingName}</td>
                  <td className="px-4 py-3 text-gray-600">{o.postalCode} {o.city}</td>
                  <td className="px-4 py-3 text-sm">{o.referentNom}<br /><span className="text-gray-400">{o.referentEmail}</span></td>
                  <td className="px-4 py-3">{o.jeunePrenom}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleLink(o.id)}
                      className="text-primary hover:text-primary/80 text-sm flex items-center gap-1"
                    >
                      <Link2 size={14} /> Rattacher
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Picker dialog — replaces native prompt() for multi-structure selection */}
      <Dialog open={!!linkPicker} onOpenChange={(open) => { if (!open) setLinkPicker(null); }}>
        <DialogContent className="rounded-brand">
          <DialogHeader>
            <DialogTitle>Choisir la structure</DialogTitle>
            <DialogDescription>
              Plusieurs structures trouvées sur le code postal {linkPicker?.orphan.postalCode}.
              Sélectionnez celle à rattacher.
            </DialogDescription>
          </DialogHeader>
          <Select value={pickerSelectedId} onValueChange={setPickerSelectedId}>
            <SelectTrigger aria-label="Structure">
              <SelectValue placeholder="Sélectionner une structure" />
            </SelectTrigger>
            <SelectContent>
              {linkPicker?.matchingStructures.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLinkPicker(null)}>Annuler</Button>
            <Button onClick={handlePickerConfirm} disabled={!pickerSelectedId}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
