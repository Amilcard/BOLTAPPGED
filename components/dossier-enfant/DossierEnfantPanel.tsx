'use client';

import { useState } from 'react';
import { useDossierEnfant } from './useDossierEnfant';
import { BulletinComplementForm } from './BulletinComplementForm';
import { FicheSanitaireForm } from './FicheSanitaireForm';
import { FicheLiaisonJeuneForm } from './FicheLiaisonJeuneForm';
import { DocumentsJointsUpload } from './DocumentsJointsUpload';

interface DossierInfo {
  id: string;
  jeunePrenom: string;
  jeuneNom: string;
  jeuneDateNaissance: string;
  sejourNom: string;
  sessionDate: string;
}

interface Props {
  inscription: DossierInfo;
  token: string;
}

const TABS = [
  { key: 'bulletin', label: 'Bulletin', icon: '📋', color: 'orange' },
  { key: 'sanitaire', label: 'Fiche sanitaire', icon: '🏥', color: 'blue' },
  { key: 'liaison', label: 'Fiche de liaison', icon: '🤝', color: 'red' },
  { key: 'pj', label: 'Pieces jointes', icon: '📎', color: 'green' },
] as const;

type TabKey = typeof TABS[number]['key'];

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

  const {
    dossier, loading, saving, saved, error, saveBloc,
  } = useDossierEnfant(inscription.id, token);

  // Progression
  const completedCount = dossier
    ? [dossier.bulletin_completed, dossier.sanitaire_completed, dossier.liaison_completed].filter(Boolean).length
    : 0;
  const totalDocs = 3;
  const progressPct = Math.round((completedCount / totalDocs) * 100);

  return (
    <div className="border-t border-gray-100 print:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-3 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50 transition"
      >
        <span className="font-medium flex items-center gap-2">
          📄 Dossier enfant — Documents officiels
          {completedCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              {completedCount}/{totalDocs} validé{completedCount > 1 ? 's' : ''}
            </span>
          )}
          {completedCount === 0 && dossier?.exists && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
              En cours
            </span>
          )}
          {!dossier?.exists && !loading && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              À compléter
            </span>
          )}
        </span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

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
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
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
                    dossier?.liaison_completed;

                  return (
                    <button
                      key={tab.key}
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
                  jeuneDateNaissance={inscription.jeuneDateNaissance}
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

              {activeTab === 'pj' && (
                <DocumentsJointsUpload
                  inscriptionId={inscription.id}
                  token={token}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
