'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { STORAGE_KEYS, formatDate } from '@/lib/utils';
import { Eye, ClipboardCopy } from 'lucide-react';
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

export default function AdminDemandes() {
  const [inscriptions, setInscriptions] = useState<InscriptionSupabase[]>([]);
  const [selectedInscription, setSelectedInscription] = useState<InscriptionSupabase | null>(null);
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

      {selectedInscription && (
        <InscriptionDetail
          inscription={selectedInscription}
          onClose={() => setSelectedInscription(null)}
          onUpdate={() => {
            fetchInscriptions();
            // Rafraîchir aussi l'inscription sélectionnée
            fetch(`/api/admin/inscriptions/${selectedInscription.id}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.AUTH)}` },
            })
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (d) setSelectedInscription(d); });
          }}
        />
      )}

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
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Dossier</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Jeune</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Séjour</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-600">Référent</th>
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
                    <tr key={insc.id} className="hover:bg-gray-50">
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
                        {insc.sejour_slug}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {insc.organisation ? `${insc.referent_nom} (${insc.organisation})` : insc.referent_nom}
                      </td>
                      <td className="px-4 py-4 text-sm font-medium">
                        {insc.price_total} €
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${paymentStyle.color}`}>
                          {paymentStyle.label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          className={`px-3 py-1 rounded-full text-xs font-medium ${statusStyle.color}`}
                          value={insc.status}
                          onChange={(e) => handleStatusChange(insc.id, e.target.value)}
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end">
                          <button
                            onClick={() => setSelectedInscription(insc)}
                            className="p-2 hover:bg-gray-100 rounded"
                            title="Détails"
                          >
                            <Eye size={18} />
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

const DOC_STATUS_OPTIONS = [
  { value: 'en_attente', label: 'En attente' },
  { value: 'partiellement_recus', label: 'Partiels' },
  { value: 'complets', label: 'Complets' },
];

function InscriptionDetail({
  inscription,
  onClose,
  onUpdate,
}: {
  inscription: InscriptionSupabase;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const paymentStyle = PAYMENT_STATUS_LABELS[inscription.payment_status || 'pending_payment']
    || PAYMENT_STATUS_LABELS.pending_payment;
  const [saving, setSaving] = useState(false);

  const patchField = async (field: string, value: unknown) => {
    setSaving(true);
    try {
      const token = localStorage.getItem(STORAGE_KEYS.AUTH);
      await fetch(`/api/admin/inscriptions/${inscription.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      onUpdate();
    } catch (err) {
      console.error('Erreur mise à jour:', err);
    } finally {
      setSaving(false);
    }
  };

  const suiviLink = inscription.suivi_token
    ? `${window.location.origin}/suivi/${inscription.suivi_token}`
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Détail inscription</h2>
            {inscription.dossier_ref && (
              <p className="text-sm text-gray-500 font-mono">{inscription.dossier_ref}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          {/* Séjour */}
          <div>
            <h3 className="font-semibold text-primary mb-2">Séjour</h3>
            <p><strong>Slug :</strong> {inscription.sejour_slug}</p>
            <p><strong>Session :</strong> {inscription.session_date}</p>
            <p><strong>Ville départ :</strong> {inscription.city_departure}</p>
          </div>

          {/* Jeune */}
          <div>
            <h3 className="font-semibold text-primary mb-2">Jeune</h3>
            <p><strong>Prénom :</strong> {inscription.jeune_prenom}</p>
            {inscription.jeune_nom && <p><strong>Nom :</strong> {inscription.jeune_nom}</p>}
            <p><strong>Date de naissance :</strong> {inscription.jeune_date_naissance}</p>
          </div>

          {/* Référent */}
          <div>
            <h3 className="font-semibold text-primary mb-2">Référent / Travailleur social</h3>
            {inscription.organisation && <p><strong>Structure :</strong> {inscription.organisation}</p>}
            <p><strong>Nom :</strong> {inscription.referent_nom}</p>
            <p><strong>Email :</strong> {inscription.referent_email}</p>
            <p><strong>Téléphone :</strong> {inscription.referent_tel}</p>
          </div>

          {/* Paiement */}
          <div>
            <h3 className="font-semibold text-primary mb-2">Paiement</h3>
            <p><strong>Montant :</strong> {inscription.price_total} €</p>
            {inscription.payment_reference && (
              <p><strong>Référence :</strong> <span className="font-mono">{inscription.payment_reference}</span></p>
            )}
            <p>
              <strong>Statut :</strong>{' '}
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${paymentStyle.color}`}>
                {paymentStyle.label}
              </span>
            </p>
            {inscription.payment_method && (
              <p><strong>Méthode :</strong> {inscription.payment_method}</p>
            )}
          </div>

          {/* Phase 2 — Suivi séjour (toggles admin) */}
          <div className="border-t pt-4">
            <h3 className="font-semibold text-primary mb-3">Suivi du séjour</h3>

            {/* Documents */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-700">Documents</span>
              <select
                className="text-sm border rounded-lg px-3 py-1.5"
                value={inscription.documents_status || 'en_attente'}
                disabled={saving}
                onChange={(e) => patchField('documents_status', e.target.value)}
              >
                {DOC_STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Besoins pris en compte */}
            <label className="flex items-center justify-between mb-3 cursor-pointer">
              <span className="text-sm text-gray-700">Besoins spécifiques pris en compte</span>
              <input
                type="checkbox"
                checked={inscription.besoins_pris_en_compte || false}
                disabled={saving}
                onChange={(e) => patchField('besoins_pris_en_compte', e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </label>

            {/* Équipe informée */}
            <label className="flex items-center justify-between mb-3 cursor-pointer">
              <span className="text-sm text-gray-700">Équipe informée</span>
              <input
                type="checkbox"
                checked={inscription.equipe_informee || false}
                disabled={saving}
                onChange={(e) => patchField('equipe_informee', e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </label>

            {/* Note pro */}
            <div>
              <label className="text-sm text-gray-700 block mb-1">Note pro (visible par le référent)</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                rows={3}
                defaultValue={inscription.note_pro || ''}
                disabled={saving}
                placeholder="Ex : Prévoir un accompagnateur supplémentaire pour ce groupe..."
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val !== (inscription.note_pro || '')) {
                    patchField('note_pro', val || null);
                  }
                }}
              />
            </div>
          </div>

          {/* Lien suivi pro */}
          {suiviLink && (
            <div className="border-t pt-4">
              <h3 className="font-semibold text-primary mb-2">Lien de suivi pro</h3>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={suiviLink}
                  className="flex-1 text-xs font-mono bg-gray-50 border rounded px-2 py-1.5 text-gray-600"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(suiviLink)}
                  className="p-1.5 hover:bg-gray-100 rounded"
                  title="Copier le lien"
                >
                  <ClipboardCopy size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Notes */}
          {(inscription.options_educatives || inscription.remarques) && (
            <div>
              <h3 className="font-semibold text-primary mb-2">Notes</h3>
              {inscription.options_educatives && (
                <p><strong>Options éducatives :</strong> {inscription.options_educatives}</p>
              )}
              {inscription.remarques && (
                <p><strong>Remarques :</strong> {inscription.remarques}</p>
              )}
            </div>
          )}

          <p className="text-sm text-gray-500">
            Créée le {new Date(inscription.created_at).toLocaleDateString('fr-FR', {
              day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
            {inscription.updated_at && (
              <> · Mise à jour le {new Date(inscription.updated_at).toLocaleDateString('fr-FR', {
                day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}</>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
