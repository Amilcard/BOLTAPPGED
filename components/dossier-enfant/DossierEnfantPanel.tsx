'use client';

import { useState } from 'react';
import { useDossierEnfant } from './useDossierEnfant';
import { BulletinComplementForm } from './BulletinComplementForm';
import { FicheSanitaireForm } from './FicheSanitaireForm';
import { FicheLiaisonJeuneForm } from './FicheLiaisonJeuneForm';
import { FicheRenseignementsForm } from './FicheRenseignementsForm';
import { DocumentsJointsUpload } from './DocumentsJointsUpload';

interface DossierInfo {
  id: string;
  jeunePrenom: string;
  jeuneNom: string;
  jeuneDateNaissance?: string;
  sejourNom: string;
  sessionDate: string;
}

interface Props {
  inscription: DossierInfo;
  token: string;
}

const BASE_TABS = [
  { key: 'bulletin', label: 'Bulletin', icon: '📋', color: 'orange' },
  { key: 'sanitaire', label: 'Fiche sanitaire', icon: '🏥', color: 'blue' },
  { key: 'liaison', label: 'Fiche de liaison', icon: '🤝', color: 'red' },
  { key: 'renseignements', label: 'Renseignements', icon: '📝', color: 'purple' },
  { key: 'pj', label: 'Pièces jointes', icon: '📎', color: 'green' },
] as const;

type TabKey = typeof BASE_TABS[number]['key'];

/**
 * Panel principal dossier enfant — affiché dans la page suivi /suivi/[token]
 * Contient les onglets pour chaque document officiel.
 * Chaque onglet = un formulaire avec sauvegarde progressive.
 */
function PdfDownloadButton({ inscriptionId, token, docType, label }: {
  inscriptionId: string; token: string; docType: string; label: string;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(
        `/api/dossier-enfant/${inscriptionId}/pdf?token=${token}&type=${docType}`
      );
      if (!res.ok) throw new Error('Erreur téléchargement');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${label.replace(/ /g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center gap-1"
    >
      📥 {downloading ? 'Téléchargement...' : label}
    </button>
  );
}

export function DossierEnfantPanel({ inscription, token }: Props) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('bulletin');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [alreadySent, setAlreadySent] = useState(false);

  const {
    dossier, loading, saving, saved, error, saveBloc, reload,
  } = useDossierEnfant(inscription.id, token);

  // Onglets visibles — tous les onglets sont toujours affichés (renseignements obligatoire pour tous)
  const TABS = BASE_TABS;

  // Progression — 4 blocs fixes obligatoires (PJ exclues du compteur)
  const hasPJ = (dossier?.documents_joints?.length ?? 0) > 0;
  const totalDocs = 4;
  const completedCount = dossier
    ? [
        dossier.bulletin_completed,
        dossier.sanitaire_completed,
        dossier.liaison_completed,
        dossier.renseignements_completed,
      ].filter(Boolean).length
    : 0;
  const progressPct = Math.round((completedCount / totalDocs) * 100);
  const isComplete = completedCount === totalDocs;

  // Documents manquants pour l'alerte
  const missing: string[] = [];
  if (dossier && !dossier.bulletin_completed) missing.push('Bulletin');
  if (dossier && !dossier.sanitaire_completed) missing.push('Fiche sanitaire');
  if (dossier && !dossier.liaison_completed) missing.push('Fiche de liaison');
  if (dossier && !dossier.renseignements_completed) missing.push('Fiche de renseignements');
  // Les pièces jointes sont optionnelles — ne pas les inclure dans les manquants bloquants

  // Envoi GED
  const handleSubmit = async () => {
    if (!isComplete || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`/api/dossier-enfant/${inscription.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409 || body?.alreadySent) {
        setAlreadySent(true);
        return;
      }
      if (!res.ok) {
        throw new Error(body?.error || 'Erreur lors de l\'envoi.');
      }
      setAlreadySent(true);
    } catch (err: unknown) {
      setSubmitError((err as Error).message || 'Erreur lors de l\'envoi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-t border-gray-100 print:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-3 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50 transition"
      >
        <span className="font-medium flex flex-wrap items-center gap-2">
          📄 Dossier enfant
          {/* Badges par document — toujours visibles */}
          {dossier && (
            <>
              {[
                { label: 'B', done: dossier.bulletin_completed, title: 'Bulletin' },
                { label: 'S', done: dossier.sanitaire_completed, title: 'Fiche sanitaire' },
                { label: 'L', done: dossier.liaison_completed, title: 'Fiche de liaison' },
                { label: 'R', done: dossier.renseignements_completed, title: 'Renseignements' },
                { label: 'PJ', done: hasPJ, title: 'Pièces jointes' },
              ].map(({ label, done, title }) => (
                <span
                  key={label}
                  title={title}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    done ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                  }`}
                >
                  {done ? '✓' : '!'} {label}
                </span>
              ))}
              {isComplete && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                  Dossier complet ✓
                </span>
              )}
            </>
          )}
          {!dossier && !loading && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              À compléter
            </span>
          )}
        </span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {/* Alerte documents manquants — visible SANS ouvrir le panel */}
      {dossier && !isComplete && missing.length > 0 && (
        <div className="mx-6 mb-3 p-3 bg-orange-50 border border-orange-200 rounded-xl text-sm">
          <p className="font-medium text-orange-800">
            {missing.length} document{missing.length > 1 ? 's' : ''} manquant{missing.length > 1 ? 's' : ''} :
            {' '}<span className="font-normal">{missing.join(', ')}</span>
          </p>
          {inscription.sessionDate && (
            <p className="text-xs text-orange-600 mt-1">
              Séjour prévu le {new Date(inscription.sessionDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} — pensez à compléter votre dossier avant le départ.
            </p>
          )}
          <button
            onClick={() => setOpen(true)}
            className="mt-2 text-xs font-medium text-orange-700 underline hover:text-orange-900"
          >
            Compléter le dossier →
          </button>
        </div>
      )}

      {open && (
        <div className="px-6 pb-6">
          {loading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-gray-400">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
              Chargement du dossier...
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
              Erreur : {error}
            </div>
          ) : (
            <>
              {/* Barre de progression */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Progression du dossier</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${progressPct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Feedback sauvegarde */}
              {saved && (
                <div className="mb-3 p-2 bg-green-50 text-green-700 rounded-lg text-xs font-medium text-center">
                  Enregistré avec succès
                </div>
              )}

              {/* Onglets */}
              <div className="flex border-b border-gray-200 mb-4 overflow-x-auto">
                {TABS.map(tab => {
                  const isComplete =
                    tab.key === 'bulletin' ? dossier?.bulletin_completed :
                    tab.key === 'sanitaire' ? dossier?.sanitaire_completed :
                    tab.key === 'liaison' ? dossier?.liaison_completed :
                    tab.key === 'renseignements' ? dossier?.renseignements_completed :
                    tab.key === 'pj' ? hasPJ :
                    false;

                  return (
                    <button
                      key={tab.key}
                      data-testid={`tab-${tab.key}`}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                        activeTab === tab.key
                          ? `border-${tab.color}-500 text-${tab.color}-600`
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <span>{tab.icon}</span>
                      {tab.label}
                      {isComplete && <span className="text-green-500 text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>

              {/* Boutons téléchargement PDF */}
              {dossier?.exists && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-2">Télécharger les documents remplis (format officiel PDF) :</p>
                  <div className="flex flex-wrap gap-2">
                    {dossier.bulletin_completed && (
                      <PdfDownloadButton
                        inscriptionId={inscription.id}
                        token={token}
                        docType="bulletin"
                        label="Bulletin d'inscription"
                      />
                    )}
                    {dossier.sanitaire_completed && (
                      <PdfDownloadButton
                        inscriptionId={inscription.id}
                        token={token}
                        docType="sanitaire"
                        label="Fiche sanitaire"
                      />
                    )}
                    {dossier.liaison_completed && (
                      <PdfDownloadButton
                        inscriptionId={inscription.id}
                        token={token}
                        docType="liaison"
                        label="Fiche de liaison"
                      />
                    )}
                    {!dossier.bulletin_completed && !dossier.sanitaire_completed && !dossier.liaison_completed && (
                      <p className="text-xs text-gray-400 italic">
                        Les PDF seront disponibles au téléchargement une fois les fiches validées.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Contenu de l'onglet actif */}
              {activeTab === 'bulletin' && (
                <BulletinComplementForm
                  data={(dossier?.bulletin_complement || {}) as Record<string, unknown>}
                  saving={saving}
                  onSave={(data, completed) => saveBloc('bulletin_complement', data, completed)}
                  jeunePrenom={inscription.jeunePrenom}
                  jeuneNom={inscription.jeuneNom}
                />
              )}

              {activeTab === 'sanitaire' && (
                <FicheSanitaireForm
                  data={(dossier?.fiche_sanitaire || {}) as Record<string, unknown>}
                  saving={saving}
                  onSave={(data, completed) => saveBloc('fiche_sanitaire', data, completed)}
                  jeunePrenom={inscription.jeunePrenom}
                  jeuneNom={inscription.jeuneNom}
                  jeuneDateNaissance={inscription.jeuneDateNaissance ?? ''}
                />
              )}

              {activeTab === 'liaison' && (
                <FicheLiaisonJeuneForm
                  data={(dossier?.fiche_liaison_jeune || {}) as Record<string, unknown>}
                  saving={saving}
                  onSave={(data, completed) => saveBloc('fiche_liaison_jeune', data, completed)}
                  jeunePrenom={inscription.jeunePrenom}
                  jeuneNom={inscription.jeuneNom}
                  sejourNom={inscription.sejourNom}
                  sessionDate={inscription.sessionDate}
                />
              )}

              {activeTab === 'renseignements' && (
                <FicheRenseignementsForm
                  data={(dossier?.fiche_renseignements || {}) as Record<string, unknown>}
                  saving={saving}
                  onSave={(data, completed) => saveBloc('fiche_renseignements', data, completed)}
                  jeunePrenom={inscription.jeunePrenom}
                  jeuneNom={inscription.jeuneNom}
                />
              )}

              {activeTab === 'pj' && (
                <>
                  <p className="text-sm text-gray-500 mb-3">
                    Merci de vérifier que les documents utiles ont bien été transmis si le séjour l&apos;exige :
                    attestation de baignade, autorisation parentale, certificat médical, ou tout autre document demandé.
                  </p>
                  <DocumentsJointsUpload
                    inscriptionId={inscription.id}
                    token={token}
                    onUploadSuccess={reload}
                  />
                </>
              )}

              {/* Bouton envoi GED — visible dès que le dossier existe */}
              {dossier?.exists && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  {(alreadySent || !!dossier?.ged_sent_at) ? (
                    <div data-testid="bandeau-envoye" className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 font-medium text-center">
                      Votre dossier a bien été envoyé à l'équipe Groupe &amp; Découverte.
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <button
                        data-testid="btn-envoyer"
                        onClick={handleSubmit}
                        disabled={!isComplete || submitting || !!dossier?.ged_sent_at}
                        className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition ${
                          isComplete
                            ? 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        } disabled:opacity-60`}
                      >
                        {submitting ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Envoi en cours...
                          </span>
                        ) : (
                          'Envoyer mon dossier'
                        )}
                      </button>
                      {!isComplete && (
                        <p className="text-xs text-gray-500">
                          {totalDocs - completedCount} document{totalDocs - completedCount > 1 ? 's' : ''} restant{totalDocs - completedCount > 1 ? 's' : ''} avant envoi
                        </p>
                      )}
                      {submitError && (
                        <p className="text-xs text-red-600">{submitError}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
