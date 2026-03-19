'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { DossierEnfantPanel } from '@/components/dossier-enfant/DossierEnfantPanel';

// === Types locaux (lecture seule, pas besoin d'exporter) ===
interface DossierSuivi {
  id: string;
  dossierRef?: string;
  sejourNom: string;
  sessionDate: string;
  cityDeparture: string;
  jeunePrenom: string;
  jeuneNom: string;
  jeuneDateNaissance: string;
  organisation?: string;
  referentNom: string;
  priceTotal: number;
  status: string;
  paymentStatus?: string;
  paymentMethod?: string;
  paymentReference?: string;
  optionsEducatives?: string;
  documentsStatus?: string;
  besoinsPrisEnCompte?: boolean;
  equipeInformee?: boolean;
  notePro?: string;
  // Phase 3 — préférences + besoins
  prefNouvellesSejour?: string;
  prefCanalContact?: string;
  prefBilanFinSejour?: boolean;
  consignesCommunication?: string;
  besoinsSpecifiques?: string;
  createdAt: string;
  updatedAt?: string;
}

interface SuiviData {
  referent: { nom: string; email: string; organisation?: string };
  dossiers: DossierSuivi[];
  count: number;
}

// === Helpers d'affichage ===
const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente', color: '#1d4ed8', bg: '#dbeafe' },
  validee: { label: 'Validée', color: '#166534', bg: '#dcfce7' },
  refusee: { label: 'Refusée', color: '#dc2626', bg: '#fee2e2' },
  annulee: { label: 'Annulée', color: '#6b7280', bg: '#f3f4f6' },
};

const PAYMENT_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment: { label: 'En attente', color: '#c2410c', bg: '#fff7ed' },
  paid: { label: 'Réglé', color: '#166534', bg: '#dcfce7' },
  failed: { label: 'Échoué', color: '#dc2626', bg: '#fee2e2' },
};

const DOC_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'Documents en attente', color: '#c2410c', bg: '#fff7ed' },
  partiellement_recus: { label: 'Documents partiels', color: '#1d4ed8', bg: '#dbeafe' },
  complets: { label: 'Documents complets', color: '#166534', bg: '#dcfce7' },
};

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch { return dateStr; }
}

function formatPaymentMethod(m?: string) {
  if (!m) return '';
  const map: Record<string, string> = {
    stripe: 'Carte bancaire', transfer: 'Virement', check: 'Chèque',
  };
  return map[m] || m;
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      style={{ color, backgroundColor: bg }}
      className="px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
    >
      {label}
    </span>
  );
}

// === Composant principal ===
export default function SuiviProPage() {
  const params = useParams();
  const token = params?.token as string;
  const [data, setData] = useState<SuiviData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/suivi/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error?.message || 'Lien de suivi invalide ou expiré.');
        }
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement de votre suivi...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Accès impossible</h1>
          <p className="text-gray-600">{error || 'Ce lien de suivi n\'est pas valide.'}</p>
          <a href="/" className="inline-block mt-6 text-primary hover:underline text-sm">
            Retour à l'accueil
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header simplifié (pas de nav vitrine, pas de header complet) */}
      <header className="bg-[#2a383f] text-white print:bg-white print:text-black">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Groupe &amp; Découverte</h1>
            <p className="text-sm text-white/70 print:text-gray-500">Espace suivi professionnel</p>
          </div>
          <button
            onClick={() => window.print()}
            className="print:hidden px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition"
          >
            Imprimer le récapitulatif
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Bloc référent + résumé financier */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500">Structure</p>
              <p className="font-semibold text-gray-800">{data.referent.organisation || '—'}</p>
            </div>
            <div className="h-8 w-px bg-gray-200 hidden sm:block" />
            <div>
              <p className="text-sm text-gray-500">Référent</p>
              <p className="font-semibold text-gray-800">{data.referent.nom}</p>
            </div>
            <div className="h-8 w-px bg-gray-200 hidden sm:block" />
            <div>
              <p className="text-sm text-gray-500">Dossiers</p>
              <p className="font-semibold text-gray-800">{data.count} inscription{data.count > 1 ? 's' : ''}</p>
            </div>
          </div>
          {/* Phase 3 — Résumé financier global */}
          {data.count > 1 && (() => {
            const total = data.dossiers.reduce((s, d) => s + d.priceTotal, 0);
            const paid = data.dossiers.filter(d => d.paymentStatus === 'paid').length;
            const pending = data.dossiers.filter(d => d.paymentStatus === 'pending_payment').length;
            return (
              <div className="pt-4 border-t border-gray-100 flex flex-wrap gap-6 text-sm">
                <div>
                  <p className="text-gray-500">Montant total</p>
                  <p className="font-bold text-lg">{total} €</p>
                </div>
                <div>
                  <p className="text-gray-500">Réglés</p>
                  <p className="font-semibold text-green-700">{paid} / {data.count}</p>
                </div>
                {pending > 0 && (
                  <div>
                    <p className="text-gray-500">En attente de paiement</p>
                    <p className="font-semibold text-orange-600">{pending}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Bloc contacts utiles */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-3">Contacts utiles</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Contact Groupe &amp; Découverte</p>
              <p className="font-medium">contact@groupeetdecouverte.fr</p>
              <p className="text-gray-500 mt-0.5">04 77 49 54 75</p>
            </div>
            <div>
              <p className="text-gray-500">Adresse</p>
              <p className="font-medium">3 rue Flobert — 42000 Saint-Étienne</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-gray-500">Horaires</p>
              <p className="font-medium">Du lundi au vendredi, 9h-12h / 14h-17h</p>
              <p className="text-xs text-gray-400 mt-1">Pendant le séjour, l'équipe sur place est joignable aux horaires communiqués dans le courrier de convocation.</p>
            </div>
          </div>
        </div>

        {/* Liste des dossiers */}
        <div className="space-y-4">
          {data.dossiers.map((d) => {
            const st = STATUS_LABELS[d.status] || STATUS_LABELS.en_attente;
            const ps = PAYMENT_LABELS[d.paymentStatus || 'pending_payment'] || PAYMENT_LABELS.pending_payment;
            const ds = d.documentsStatus ? DOC_LABELS[d.documentsStatus] : null;

            return (
              <div key={d.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* En-tête dossier */}
                <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-gray-800">
                      {d.jeunePrenom} {d.jeuneNom}
                    </h2>
                    <p className="text-sm text-gray-500">{d.sejourNom}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge {...st} />
                    <Badge {...ps} />
                  </div>
                </div>

                {/* Corps */}
                <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  {d.dossierRef && (
                    <div>
                      <p className="text-gray-500">N° dossier</p>
                      <p className="font-mono font-semibold">{d.dossierRef}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-500">Session</p>
                    <p className="font-medium">{formatDate(d.sessionDate)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Départ</p>
                    <p className="font-medium">{d.cityDeparture === 'sans_transport' ? 'Sans transport' : d.cityDeparture}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Date de naissance</p>
                    <p className="font-medium">{formatDate(d.jeuneDateNaissance)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Montant</p>
                    <p className="font-bold">{d.priceTotal} €</p>
                  </div>
                  {d.paymentMethod && (
                    <div>
                      <p className="text-gray-500">Mode de paiement</p>
                      <p className="font-medium">{formatPaymentMethod(d.paymentMethod)}</p>
                    </div>
                  )}
                  {d.paymentReference && (
                    <div>
                      <p className="text-gray-500">Réf. paiement</p>
                      <p className="font-mono font-medium">{d.paymentReference}</p>
                    </div>
                  )}
                  {d.optionsEducatives && (
                    <div className="sm:col-span-2">
                      <p className="text-gray-500">Options éducatives</p>
                      <p className="font-medium">{d.optionsEducatives}</p>
                    </div>
                  )}
                </div>

                {/* Phase 2 — Suivi séjour */}
                {(ds || d.besoinsPrisEnCompte || d.equipeInformee || d.notePro) && (
                  <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Suivi du séjour</p>
                    <div className="flex flex-wrap gap-3 items-center">
                      {ds && <Badge {...ds} />}
                      {d.besoinsPrisEnCompte && (
                        <Badge label="Besoins pris en compte" color="#166534" bg="#dcfce7" />
                      )}
                      {d.equipeInformee && (
                        <Badge label="Équipe informée" color="#1d4ed8" bg="#dbeafe" />
                      )}
                    </div>
                    {d.notePro && (
                      <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200 text-sm text-gray-700">
                        <p className="text-xs text-gray-400 mb-1">Note de l'équipe</p>
                        {d.notePro}
                      </div>
                    )}
                  </div>
                )}

                {/* Phase 3 — Préférences de suivi + besoins (éditable par le référent) */}
                <PreferencesBlock dossier={d} token={token} />

                {/* Phase 4 — Dossier enfant : documents officiels */}
                <DossierEnfantPanel
                  inscription={{
                    id: d.id,
                    jeunePrenom: d.jeunePrenom,
                    jeuneNom: d.jeuneNom,
                    jeuneDateNaissance: d.jeuneDateNaissance,
                    sejourNom: d.sejourNom,
                    sessionDate: d.sessionDate,
                  }}
                  token={token}
                />

                {/* Footer léger */}
                <div className="px-6 py-2 text-xs text-gray-400 border-t border-gray-50 flex justify-between">
                  <span>Créé le {formatDate(d.createdAt)}</span>
                  {d.updatedAt && (
                    <span>Mis à jour le {formatDate(d.updatedAt)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer page */}
        <div className="mt-8 text-center text-xs text-gray-400 print:mt-4">
          <p>Groupe &amp; Découverte — Séjours de vacances pour enfants et adolescents</p>
          <p className="mt-1">Ce document a été généré automatiquement. Pour toute question, contactez-nous à contact@groupeetdecouverte.fr</p>
        </div>
      </main>

      {/* CSS print */}
      <style jsx global>{`
        @media print {
          .preferences-block { display: none !important; }
        }
      `}</style>
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:text-black { color: black !important; }
          .print\\:text-gray-500 { color: #6b7280 !important; }
          .shadow-sm, .shadow-lg { box-shadow: none !important; }
          .rounded-xl { border-radius: 4px !important; }
        }
      `}</style>
    </div>
  );
}

// === Composant préférences de suivi (éditable par le référent) ===
function PreferencesBlock({ dossier, token }: { dossier: DossierSuivi; token: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const patchField = async (field: string, value: unknown) => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/suivi/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inscriptionId: dossier.id, field, value }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error('Erreur mise à jour préférence:', err);
    } finally {
      setSaving(false);
    }
  };

  // Indicateur : quelque chose est renseigné
  const hasPrefs = dossier.prefNouvellesSejour && dossier.prefNouvellesSejour !== 'si_besoin';
  const hasBesoins = !!dossier.besoinsSpecifiques;

  return (
    <div className="preferences-block border-t border-gray-100 print:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-3 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50 transition"
      >
        <span className="font-medium">
          Préférences de suivi &amp; besoins spécifiques
          {(hasPrefs || hasBesoins) && (
            <span className="ml-2 text-xs text-green-600 font-normal">Renseigné</span>
          )}
        </span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-6 pb-4 space-y-4">
          <p className="text-xs text-gray-400">
            Ces préférences nous aident à adapter notre communication pendant le séjour. Elles ne constituent pas un engagement contractuel.
          </p>

          {saved && (
            <div className="text-xs text-green-600 font-medium">Enregistré</div>
          )}

          {/* Nouvelles pendant le séjour */}
          <div>
            <label className="text-sm text-gray-700 block mb-1">
              Souhaitez-vous recevoir des nouvelles pendant le séjour ?
            </label>
            <select
              className="text-sm border rounded-lg px-3 py-1.5 w-full sm:w-auto"
              defaultValue={dossier.prefNouvellesSejour || 'si_besoin'}
              disabled={saving}
              onChange={(e) => patchField('pref_nouvelles_sejour', e.target.value)}
            >
              <option value="oui">Oui, je souhaite être tenu informé</option>
              <option value="si_besoin">Uniquement si nécessaire</option>
              <option value="non">Non, sauf urgence</option>
            </select>
          </div>

          {/* Canal préféré */}
          <div>
            <label className="text-sm text-gray-700 block mb-1">
              Canal de contact préféré
            </label>
            <select
              className="text-sm border rounded-lg px-3 py-1.5 w-full sm:w-auto"
              defaultValue={dossier.prefCanalContact || 'email'}
              disabled={saving}
              onChange={(e) => patchField('pref_canal_contact', e.target.value)}
            >
              <option value="email">Email</option>
              <option value="telephone">Téléphone</option>
              <option value="les_deux">Email et téléphone</option>
            </select>
          </div>

          {/* Bilan fin de séjour */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked={dossier.prefBilanFinSejour || false}
              disabled={saving}
              onChange={(e) => patchField('pref_bilan_fin_sejour', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Je souhaite un bilan écrit en fin de séjour</span>
          </label>

          {/* Consignes communication */}
          <div>
            <label className="text-sm text-gray-700 block mb-1">
              Consignes particulières de communication
            </label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
              rows={2}
              maxLength={500}
              defaultValue={dossier.consignesCommunication || ''}
              disabled={saving}
              placeholder="Ex : ne pas appeler entre 12h et 14h, contacter plutôt la directrice de l'établissement..."
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (dossier.consignesCommunication || '')) {
                  patchField('consignes_communication', v);
                }
              }}
            />
          </div>

          {/* Besoins spécifiques */}
          <div>
            <label className="text-sm text-gray-700 block mb-1">
              Besoins spécifiques à anticiper pour le séjour
            </label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
              rows={3}
              maxLength={1000}
              defaultValue={dossier.besoinsSpecifiques || ''}
              disabled={saving}
              placeholder="Ex : attention renforcée nécessaire, repères utiles pour l'équipe, modalités facilitant l'intégration, éléments à anticiper avant le départ..."
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (dossier.besoinsSpecifiques || '')) {
                  patchField('besoins_specifiques', v);
                }
              }}
            />
            <p className="text-xs text-gray-400 mt-1">
              Ces informations sont transmises à l'équipe encadrante pour préparer au mieux l'accueil.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
