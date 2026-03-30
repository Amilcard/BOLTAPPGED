'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { STORAGE_KEYS, formatDate } from '@/lib/utils';
import {
  ArrowLeft, Trash2, ExternalLink, ClipboardCopy,
  FileCheck, FileClock, Download, Save, Loader2,
} from 'lucide-react';
import { InscriptionSupabase, InscriptionEnriched, DossierEnfant } from '@/lib/types';
import { useAdminUI } from '@/components/admin/admin-ui';

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

const DOC_STATUS_OPTIONS = [
  { value: 'en_attente', label: 'En attente' },
  { value: 'partiellement_recus', label: 'Partiels' },
  { value: 'complets', label: 'Complets' },
];

export default function InscriptionDetailPage() {
  const router = useRouter();
  const { confirm, toast } = useAdminUI();
  const params = useParams();
  const inscriptionId = params.id as string;

  const [insc, setInsc] = useState<InscriptionSupabase | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dossier, setDossier] = useState<DossierEnfant | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [autresInscriptions, setAutresInscriptions] = useState<InscriptionSupabase[]>([]);
  const [relanceLoading, setRelanceLoading] = useState(false);
  const [relanceSent, setRelanceSent] = useState(false);
  const [relanceError, setRelanceError] = useState<string | null>(null);
  const [relanceAt, setRelanceAt] = useState<string | null>(null);

  const authHeaders = () => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH);
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const loadInscription = async () => {
    try {
      const res = await fetch(`/api/admin/inscriptions/${inscriptionId}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setInsc(data);
        // Charger les autres inscriptions du même référent
        if (data.referent_email) {
          const allRes = await fetch('/api/admin/inscriptions', { headers: authHeaders() });
          if (allRes.ok) {
            const all: InscriptionSupabase[] = await allRes.json();
            setAutresInscriptions(all.filter(i => i.referent_email === data.referent_email && i.id !== inscriptionId));
          }
        }
      } else {
        void router.replace('/admin/demandes');
      }
    } catch {
      router.replace('/admin/demandes');
    } finally {
      setLoading(false);
    }
  };

  const loadDossier = async () => {
    setDossierLoading(true);
    try {
      const res = await fetch(`/api/admin/dossier-enfant/${inscriptionId}`, {
        headers: authHeaders(),
      });
      if (res.ok) setDossier(await res.json());
    } catch { /* silent */ }
    finally { setDossierLoading(false); }
  };

  useEffect(() => {
    void loadInscription();
    void loadDossier();
  }, [inscriptionId]);

  const patchField = async (field: string, value: unknown) => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/inscriptions/${inscriptionId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        toast('Erreur lors de l\'enregistrement');
        return;
      }
      await loadInscription();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Erreur mise a jour:', err);
      toast('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleRelance = async () => {
    if (relanceLoading || relanceSent) return;
    setRelanceLoading(true);
    setRelanceError(null);
    try {
      const res = await fetch(`/api/admin/inscriptions/${inscriptionId}/relance`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        setRelanceSent(true);
        if (body?.relance_at) {
          setRelanceAt(new Date(body.relance_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
        }
      } else {
        const body = await res.json().catch(() => ({}));
        setRelanceError(body?.error || `Erreur ${res.status}`);
      }
    } catch {
      setRelanceError('Erreur réseau');
    } finally {
      setRelanceLoading(false);
    }
  };

  const handleDelete = () => {
    if (!insc) return;
    confirm(`Supprimer définitivement l'inscription de ${insc.jeune_prenom} ${insc.jeune_nom} ? Cette action est irréversible.`, async () => {
      try {
        const res = await fetch(`/api/admin/inscriptions/${inscriptionId}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast(`Erreur : ${err?.error?.message || res.status}`);
          return;
        }
        void router.replace('/admin/demandes');
      } catch {
        toast('Erreur réseau');
      }
    });
  };

  if (loading || !insc) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  const paymentStyle = PAYMENT_STATUS_LABELS[insc.payment_status || 'pending_payment'] || PAYMENT_STATUS_LABELS.pending_payment;
  const statusStyle = STATUS_OPTIONS.find(s => s.value === insc.status) || STATUS_OPTIONS[0];
  const suiviUrl = insc.suivi_token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/suivi/${insc.suivi_token}` : null;

  // PJ exclues du compteur — optionnelles. 4 blocs obligatoires pour tous les séjours.
  const totalDocs = 4;
  const completedCount = dossier
    ? [
        dossier.bulletin_completed,
        dossier.sanitaire_completed,
        dossier.liaison_completed,
        dossier.renseignements_completed,
      ].filter(Boolean).length
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => void router.replace('/admin/demandes')} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {insc.jeune_prenom} {insc.jeune_nom}
            </h1>
            <p className="text-sm text-gray-500 font-mono">{insc.dossier_ref || inscriptionId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600 font-medium">Enregistre</span>}
          {saving && <Loader2 size={16} className="animate-spin text-gray-400" />}
          {suiviUrl && (
            <a
              href={suiviUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition text-sm"
            >
              <ExternalLink size={16} />
              Vue referent
            </a>
          )}
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition text-sm"
          >
            <Trash2 size={16} />
            Supprimer
          </button>
        </div>
      </div>

      {/* Statut principal */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center gap-6">
          <div>
            <label className="text-xs text-gray-500 uppercase font-medium">Statut inscription</label>
            <select
              className={`mt-1 block px-4 py-2 rounded-lg text-sm font-medium ${statusStyle.color} cursor-pointer`}
              value={insc.status}
              onChange={(e) => patchField('status', e.target.value)}
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase font-medium">Paiement</label>
            <p className="mt-1">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${paymentStyle.color}`}>
                {paymentStyle.label}
              </span>
            </p>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase font-medium">Montant</label>
            <p className="mt-1 text-lg font-bold">{insc.price_total} EUR</p>
          </div>
          {insc.payment_reference && (
            <div>
              <label className="text-xs text-gray-500 uppercase font-medium">Ref. paiement</label>
              <p className="mt-1 text-sm font-mono text-gray-600">{insc.payment_reference}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Sejour */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Sejour</h2>
          <div className="space-y-3 text-sm">
            <div><span className="text-gray-500">Sejour :</span> <strong>{(insc as InscriptionEnriched).sejour_titre || insc.sejour_slug}</strong></div>
            <div><span className="text-gray-500">Session :</span> <strong>{insc.session_date}</strong></div>
            <div><span className="text-gray-500">Ville depart :</span> <strong className="capitalize">{insc.city_departure}</strong></div>
            {insc.payment_method && <div><span className="text-gray-500">Methode :</span> <strong>{insc.payment_method}</strong></div>}
          </div>
        </div>

        {/* Jeune */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Jeune</h2>
          <div className="space-y-3 text-sm">
            <div><span className="text-gray-500">Prenom :</span> <strong>{insc.jeune_prenom}</strong></div>
            {insc.jeune_nom && <div><span className="text-gray-500">Nom :</span> <strong>{insc.jeune_nom}</strong></div>}
            <div><span className="text-gray-500">Date de naissance :</span> <strong>{insc.jeune_date_naissance}</strong></div>
          </div>
        </div>

        {/* Referent */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Referent / Structure</h2>
          <div className="space-y-3 text-sm">
            {insc.organisation && <div><span className="text-gray-500">Structure / Organisme :</span> <strong>{insc.organisation}</strong></div>}
            <div><span className="text-gray-500">Référent :</span> <strong>{insc.referent_nom}</strong></div>
            <div><span className="text-gray-500">Email référent :</span> <strong>{insc.referent_email}</strong></div>
            <div><span className="text-gray-500">Téléphone référent :</span> <strong>{insc.referent_tel}</strong></div>
          </div>
        </div>

        {/* Suivi du sejour */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Suivi du sejour</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Documents</span>
              <select
                className="text-sm border rounded-lg px-3 py-1.5"
                value={insc.documents_status || 'en_attente'}
                onChange={(e) => patchField('documents_status', e.target.value)}
              >
                {DOC_STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-700">Besoins specifiques pris en compte</span>
              <input
                type="checkbox"
                checked={insc.besoins_pris_en_compte || false}
                onChange={(e) => patchField('besoins_pris_en_compte', e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-300"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-700">Equipe informee</span>
              <input
                type="checkbox"
                checked={insc.equipe_informee || false}
                onChange={(e) => patchField('equipe_informee', e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-300"
              />
            </label>

            <div>
              <label className="text-sm text-gray-700 block mb-1">Note pro</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-orange-300 focus:border-orange-500 outline-none"
                rows={3}
                defaultValue={insc.note_pro || ''}
                placeholder="Note visible par le referent..."
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val !== (insc.note_pro || '')) patchField('note_pro', val || null);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Preferences de contact du referent (lecture seule) */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Préférences de contact</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Mode de contact :</span>{' '}
            <strong>
              {{ email: 'Email', telephone: 'Téléphone', les_deux: 'Email + Tél' }[insc.pref_canal_contact || ''] || (insc.pref_canal_contact ? insc.pref_canal_contact : '—')}
            </strong>
          </div>
          <div>
            <span className="text-gray-500">Nouvelles du jeune :</span>{' '}
            <strong>
              {{ oui: 'Régulièrement', non: 'Non', si_besoin: 'Si besoin' }[insc.pref_nouvelles_sejour || ''] || (insc.pref_nouvelles_sejour ? insc.pref_nouvelles_sejour : '—')}
            </strong>
          </div>
          <div>
            <span className="text-gray-500">Bilan fin de séjour :</span>{' '}
            <strong className={insc.pref_bilan_fin_sejour ? 'text-green-700' : ''}>
              {insc.pref_bilan_fin_sejour === true ? 'Oui' : insc.pref_bilan_fin_sejour === false ? 'Non' : '—'}
            </strong>
          </div>
          {insc.consignes_communication && (
            <div className="col-span-2 bg-gray-50 rounded-lg p-3">
              <span className="text-gray-500">Consignes communication :</span>
              <p className="mt-1">{insc.consignes_communication}</p>
            </div>
          )}
          {insc.besoins_specifiques && (
            <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <span className="text-gray-500">Besoins spécifiques :</span>
              <p className="mt-1 font-medium">{insc.besoins_specifiques}</p>
            </div>
          )}
        </div>
      </div>

      {/* Dossier enfant */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Dossier enfant</h2>
        {dossierLoading ? (
          <div className="flex items-center gap-2 text-gray-400"><Loader2 size={16} className="animate-spin" /> Chargement...</div>
        ) : !dossier || !dossier.exists ? (
          <p className="text-sm text-gray-500 italic">Le referent n'a pas encore commence le dossier enfant.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.round((completedCount / totalDocs) * 100)}%` }} />
              </div>
              <span className="text-sm font-medium text-gray-600">{completedCount}/{totalDocs}</span>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {[
                { key: 'bulletin', label: 'Bulletin', completed: dossier.bulletin_completed, required: true },
                { key: 'sanitaire', label: 'Fiche sanitaire', completed: dossier.sanitaire_completed, required: true },
                { key: 'liaison', label: 'Fiche liaison', completed: dossier.liaison_completed, required: true },
                { key: 'renseignements', label: 'Renseignements', completed: dossier.renseignements_completed, required: true },
              ].map(doc => (
                <div key={doc.key} className={`p-3 rounded-lg border ${doc.completed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-2">
                    {doc.completed ? <FileCheck size={16} className="text-green-600" /> : <FileClock size={16} className="text-gray-400" />}
                    <span className={`text-sm font-medium ${doc.completed ? 'text-green-700' : 'text-gray-500'}`}>{doc.label}</span>
                  </div>
                </div>
              ))}
              {/* Pièces jointes — informatives uniquement, hors compteur */}
              <div className={`p-3 rounded-lg border ${(dossier.documents_joints?.length ?? 0) > 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  {(dossier.documents_joints?.length ?? 0) > 0
                    ? <FileCheck size={16} className="text-blue-600" />
                    : <FileClock size={16} className="text-gray-400" />}
                  <span className={`text-sm font-medium ${(dossier.documents_joints?.length ?? 0) > 0 ? 'text-blue-700' : 'text-gray-500'}`}>
                    PJ ({dossier.documents_joints?.length ?? 0})
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rappel dossier incomplet */}
      {/* Visible si le dossier n'existe pas encore OU si ged_sent_at est null (pas encore soumis) */}
      {!dossier?.ged_sent_at && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-2 text-amber-800">Relancer le référent</h2>
          <p className="text-sm text-amber-700 mb-4">Le dossier n'a pas encore été envoyé. Vous pouvez envoyer un email de rappel au référent.</p>
          <div className="flex items-center gap-3">
            <button
              data-testid="btn-relance"
              onClick={handleRelance}
              disabled={relanceLoading || relanceSent}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed transition text-sm font-medium"
            >
              {relanceLoading && <Loader2 size={16} className="animate-spin" />}
              {relanceSent ? 'Rappel envoyé' : 'Envoyer un rappel'}
            </button>
            {relanceError && (
              <span className="text-sm text-red-600">{relanceError}</span>
            )}
          </div>
          {relanceAt && (
            <p className="text-xs text-amber-600 mt-2">Dernière relance envoyée le {relanceAt}</p>
          )}
        </div>
      )}

      {/* Lien suivi */}
      {suiviUrl && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-3">Lien de suivi pro</h2>
          <div className="flex items-center gap-2">
            <input readOnly value={suiviUrl} className="flex-1 text-xs font-mono bg-gray-50 border rounded-lg px-3 py-2 text-gray-600" />
            <button onClick={() => navigator.clipboard.writeText(suiviUrl)} className="p-2 hover:bg-gray-100 rounded-lg" title="Copier">
              <ClipboardCopy size={16} />
            </button>
            <a href={suiviUrl} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-gray-100 rounded-lg" title="Ouvrir">
              <ExternalLink size={16} />
            </a>
          </div>
        </div>
      )}

      {/* Notes */}
      {(insc.options_educatives || insc.remarques) && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-3">Notes</h2>
          <div className="space-y-2 text-sm">
            {insc.options_educatives && <p><span className="text-gray-500">Options educatives :</span> {insc.options_educatives}</p>}
            {insc.remarques && <p><span className="text-gray-500">Remarques :</span> {insc.remarques}</p>}
          </div>
        </div>
      )}

      {/* Autres inscriptions du même référent */}
      {autresInscriptions.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6 mb-4">
          <h2 className="text-lg font-semibold mb-4 text-primary">
            Autres demandes de {insc.referent_nom} ({autresInscriptions.length})
          </h2>
          <div className="space-y-2">
            {autresInscriptions.map(a => (
              <div
                key={a.id}
                onClick={() => void router.push(`/admin/demandes/${a.id}`)}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition"
              >
                <div>
                  <span className="font-medium text-sm">{a.jeune_prenom} {a.jeune_nom}</span>
                  <span className="text-xs text-gray-500 ml-2">{a.sejour_slug}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  a.status === 'validee' ? 'bg-green-100 text-green-700' :
                  a.status === 'refusee' ? 'bg-red-100 text-red-700' :
                  a.status === 'annulee' ? 'bg-gray-100 text-gray-500' :
                  'bg-orange-100 text-orange-700'
                }`}>
                  {a.status === 'validee' ? 'Validée' : a.status === 'refusee' ? 'Refusée' : a.status === 'annulee' ? 'Annulée' : 'En attente'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center pb-8">
        Cree le {formatDate(insc.created_at)}
        {insc.updated_at && <> - Mis a jour le {formatDate(insc.updated_at)}</>}
      </p>
    </div>
  );
}
