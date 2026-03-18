'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { STORAGE_KEYS, formatDate } from '@/lib/utils';
import { Eye, FileCheck, FileClock, Trash2 } from 'lucide-react';
import { InscriptionSupabase } from '@/lib/types';

const STATUS_OPTIONS = [
  { value: 'en_attente', label: 'En attente', color: 'bg-blue-100 text-blue-700' },
  { value: 'validee', label: 'Validée', color: 'bg-green-100 text-green-700' },
  { value: 'refusee', label: 'Refusée', color: 'bg-red-100 text-red-700' },
  { value: 'annulee', label: 'Annulée', color: 'bg-gray-100 text-gray-500' },
];

const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_payment: { label: 'En attente', color: 'bg-orange-100 text-orange-700' },
  paid: { label: 'Payé', color: 'bg-green-100 text-green-700' },
  failed: { label: 'Échoué', color: 'bg-red-100 text-red-700' },
};

function DossierBadge({ completude }: { completude: any }) {
  if (!completude) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        <FileClock size={12} /> Non commence
      </span>
    );
  }

  const fiches = [completude.bulletin, completude.sanitaire, completude.liaison].filter(Boolean).length;
  const total = 3;
  const hasPJ = completude.pj_count > 0;
  const hasVaccins = completude.pj_vaccins;

  if (fiches === total && hasPJ && hasVaccins) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <FileCheck size={12} /> Complet
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
        {fiches}/{total} fiches
      </span>
      <div className="flex gap-0.5">
        <span className={`w-2 h-2 rounded-full ${completude.bulletin ? 'bg-green-500' : 'bg-gray-300'}`} title="Bulletin" />
        <span className={`w-2 h-2 rounded-full ${completude.sanitaire ? 'bg-green-500' : 'bg-gray-300'}`} title="Sanitaire" />
        <span className={`w-2 h-2 rounded-full ${completude.liaison ? 'bg-green-500' : 'bg-gray-300'}`} title="Liaison" />
        <span className={`w-2 h-2 rounded-full ${hasVaccins ? 'bg-green-500' : 'bg-gray-300'}`} title="Vaccins" />
        <span className={`w-2 h-2 rounded-full ${hasPJ ? 'bg-blue-500' : 'bg-gray-300'}`} title="PJ" />
      </div>
    </div>
  );
}

export default function AdminDemandes() {
  const router = useRouter();
  const [inscriptions, setInscriptions] = useState<InscriptionSupabase[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInscriptions = async () => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.AUTH);
      const res = await fetch('/api/admin/inscriptions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setInscriptions(await res.json());
      }
    } catch (err) {
      console.error('Erreur chargement inscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInscriptions(); }, []);

  const handleStatusChange = async (id: string, status: string) => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH);
    await fetch(`/api/admin/inscriptions/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchInscriptions();
  };

  const handleDelete = async (id: string, jeune: string) => {
    if (!confirm(`Supprimer definitivement l'inscription de ${jeune} ? Cette action est irreversible.`)) return;
    const token = localStorage.getItem(STORAGE_KEYS.AUTH);
    await fetch(`/api/admin/inscriptions/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchInscriptions();
  };

  const getStatusStyle = (status: string) =>
    STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];

  const getPaymentStyle = (paymentStatus?: string) =>
    PAYMENT_STATUS_LABELS[paymentStatus || 'pending_payment'] || PAYMENT_STATUS_LABELS.pending_payment;

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-primary mb-8">Inscriptions</h1>
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-primary mb-8">
        Inscriptions ({inscriptions.length})
      </h1>

      {inscriptions.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          Aucune inscription pour le moment.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Ref.</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Jeune</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Séjour</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Référent</th>
                  <th className="px-4 py-4 text-center text-sm font-semibold text-gray-600">Dossier</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Prix</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Paiement</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Statut</th>
                  <th className="px-4 py-4 text-right text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inscriptions.map((insc) => {
                  const statusStyle = getStatusStyle(insc.status);
                  const paymentStyle = getPaymentStyle(insc.payment_status);
                  return (
                    <tr key={insc.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/admin/demandes/${insc.id}`)}>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {formatDate(insc.created_at)}
                      </td>
                      <td className="px-4 py-4 text-xs font-mono text-gray-500">
                        {insc.dossier_ref || '—'}
                      </td>
                      <td className="px-4 py-4 font-medium">
                        {insc.jeune_prenom} {insc.jeune_nom}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {(insc as any).sejour_titre || insc.sejour_slug}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {insc.organisation ? `${insc.referent_nom} (${insc.organisation})` : insc.referent_nom}
                      </td>
                      <td className="px-4 py-4">
                        <DossierBadge completude={(insc as any).dossier_completude} />
                      </td>
                      <td className="px-4 py-4 text-sm font-medium">
                        {insc.price_total} €
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${paymentStyle.color}`}>
                          {paymentStyle.label}
                        </span>
                      </td>
                      <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                        <select
                          className={`px-3 py-1 rounded-full text-xs font-medium ${statusStyle.color} cursor-pointer`}
                          value={insc.status}
                          onChange={(e) => handleStatusChange(insc.id, e.target.value)}
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => router.push(`/admin/demandes/${insc.id}`)}
                            className="p-2 hover:bg-gray-100 rounded"
                            title="Détails"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(insc.id, `${insc.jeune_prenom} ${insc.jeune_nom}`)}
                            className="p-2 hover:bg-red-50 rounded text-gray-400 hover:text-red-600 transition"
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
