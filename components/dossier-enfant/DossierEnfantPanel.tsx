'use client';

import { useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { ClipboardList, Stethoscope, Handshake, FileText, Paperclip, LockKeyhole, Download, Check } from 'lucide-react';
import { DOC_OPT_LABELS } from '@/lib/dossier-shared';
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
  /**
   * Mode d'utilisation :
   *  - 'referent' (défaut) : éducateur via `/suivi/[token]`, tous les onglets
   *    + submit GED + téléchargement PDF + upload PJ activés.
   *  - 'staff-fill' : staff structure (secrétariat/direction/CDS) remplit en
   *    dépannage depuis `/structure/[code]`. Onglets édition OK, mais submit,
   *    PDF download et upload PJ MASQUÉS (routes backend non équivalentes —
   *    l'éducateur garde la main finale sur le dossier via son lien suivi).
   */
  mode?: 'referent' | 'staff-fill';
  /** Code structure — REQUIS si mode='staff-fill' (routage staff URL). */
  structureCode?: string;
  /** Nom référent pour bandeau "absent" (optionnel, UX informative). */
  referentNom?: string;
}

const BASE_TABS = [
  { key: 'bulletin', label: 'Bulletin', icon: ClipboardList, color: 'orange' },
  { key: 'sanitaire', label: 'Fiche sanitaire', icon: Stethoscope, color: 'blue' },
  { key: 'liaison', label: 'Fiche de liaison', icon: Handshake, color: 'red' },
  { key: 'renseignements', label: 'Renseignements', icon: FileText, color: 'purple' },
  { key: 'pj', label: 'Pièces jointes', icon: Paperclip, color: 'green' },
] as const;

// Classes Tailwind complètes (pas d'interpolation dynamique — la purge CSS supprimerait les classes générées)
const TAB_ACTIVE_STYLES: Record<string, string> = {
  bulletin:        'border-orange-500 text-orange-600',
  sanitaire:       'border-blue-500 text-blue-600',
  liaison:         'border-red-500 text-red-600',
  renseignements:  'border-purple-500 text-purple-600',
  pj:              'border-green-500 text-green-600',
};

type TabKey = typeof BASE_TABS[number]['key'];

/**
 * Panel principal dossier enfant — affiché dans la page suivi /suivi/[token]
 * Contient les onglets pour chaque document officiel.
 * Chaque onglet = un formulaire avec sauvegarde progressive.
 */
function PdfDownloadButton({ inscriptionId, token, docType, label, pdfUrl, pdfEmailUrl }: {
  inscriptionId: string; token: string; docType: string; label: string;
  /** URL PDF download override (staff mode). Par défaut : route référent avec token. */
  pdfUrl?: string;
  /** URL PDF email POST override (staff mode). */
  pdfEmailUrl?: string;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const isStaffMode = !!pdfUrl;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const url = isStaffMode
        ? `${pdfUrl}?type=${docType}`
        : `/api/dossier-enfant/${inscriptionId}/pdf?token=${token}&type=${docType}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Erreur téléchargement');
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `${label.replace(/ /g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(objUrl);
    } catch (err) {
      console.error('Download error:', err);
      setRetryCount(c => c + 1);
      setDownloadError(true);
      setTimeout(() => setDownloadError(false), 8000);
    } finally {
      setDownloading(false);
    }
  };

  const handleSendByEmail = async () => {
    setSendingEmail(true);
    try {
      const url = pdfEmailUrl || `/api/dossier-enfant/${inscriptionId}/pdf-email`;
      const body = isStaffMode ? { type: docType } : { token, type: docType };
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setEmailSent(true);
      setDownloadError(false);
    } catch {
      // silence — l'utilisateur voit déjà le message d'erreur
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="px-3 py-2.5 min-h-[44px] bg-white border border-gray-300 hover:bg-gray-100 rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center gap-1"
      >
        <Download className="w-3.5 h-3.5 inline" /> {downloading ? 'Téléchargement...' : label}
      </button>
      {emailSent && (
        <p className="text-xs text-green-700 flex items-center gap-1"><Check className="w-3 h-3" /> Document envoyé par email</p>
      )}
      {downloadError && !emailSent && (
        <div className="text-xs text-amber-700 space-y-1">
          {retryCount < 2 ? (
            <p>Le document n&apos;est pas sorti. <button onClick={handleDownload} className="underline">Réessayer</button></p>
          ) : (
            <p>
              Toujours bloqué ?{' '}
              <button
                onClick={handleSendByEmail}
                disabled={sendingEmail}
                className="underline disabled:opacity-50"
              >
                {sendingEmail ? 'Envoi…' : 'Recevoir par email'}
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sélecteur de mode de signature ───────────────────────────────────────────

function SignatureModeSelector({
  selectorId,
  mode,
  onChange,
  alreadyCompleted,
}: {
  selectorId: string;
  mode: 'online' | 'offline';
  onChange: (m: 'online' | 'offline') => void;
  alreadyCompleted: boolean;
}) {
  // Si déjà complété : ne pas masquer — afficher un lien discret "Remplacer"
  // (changement de responsable légal possible à tout moment : placement, tutelle, ASE)
  if (alreadyCompleted) {
    return (
      <div className="mb-4 p-2 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
        <span className="text-xs text-green-700">Document validé</span>
        <button
          onClick={() => onChange('offline')}
          className="text-xs text-gray-400 underline hover:text-gray-600"
        >
          Remplacer (situation administrative modifiée)
        </button>
      </div>
    );
  }
  return (
    <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-xl">
      <p className="text-xs font-medium text-gray-600 mb-2">Qui va signer ce document ?</p>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={selectorId}
            checked={mode === 'online'}
            onChange={() => onChange('online')}
            className="accent-orange-500"
          />
          <span className="text-sm text-gray-700">Responsable légal présent — signature en ligne</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={selectorId}
            checked={mode === 'offline'}
            onChange={() => onChange('offline')}
            className="accent-orange-500"
          />
          <span className="text-sm text-gray-700">Parent / responsable absent — imprimer et faire signer</span>
        </label>
      </div>
    </div>
  );
}

// ─── Zone de signature physique (télécharger → faire signer → uploader) ───────

function OfflineSignatureZone({
  inscriptionId,
  token,
  docType,
  docLabel,
  signedType,
  onUploadSuccess,
  pdfUrl,
  pdfEmailUrl,
  uploadUrl,
}: {
  inscriptionId: string;
  token: string;
  docType: string;
  docLabel: string;
  signedType: string;
  onUploadSuccess: () => void;
  /** URL PDF download override (staff mode). Forwardée au PdfDownloadButton. */
  pdfUrl?: string;
  /** URL POST email-fallback override (staff mode). */
  pdfEmailUrl?: string;
  /** URL POST upload override (staff mode). Si fourni : pas de token en FormData (auth session cookie). */
  uploadUrl?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploaded, setUploaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isStaffMode = !!uploadUrl;

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setUploadError('Sélectionnez un fichier PDF.'); return; }
    if (file.size > 5 * 1024 * 1024) { setUploadError('Fichier trop volumineux (max 5 Mo).'); return; }
    setUploading(true);
    setUploadError('');
    try {
      const fd = new FormData();
      // Token FormData uniquement en mode référent (staff = session cookie)
      if (!isStaffMode) fd.append('token', token);
      fd.append('type', signedType);
      fd.append('file', file);
      const targetUrl = uploadUrl || `/api/dossier-enfant/${inscriptionId}/upload`;
      const res = await fetch(targetUrl, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur upload');
      setUploaded(true);
      onUploadSuccess();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Erreur upload');
    } finally {
      setUploading(false);
    }
  };

  if (uploaded) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 text-center">
        Document signé intégré au dossier.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <p className="text-sm font-medium text-blue-800 mb-1">Étape 1 — Télécharger le document pré-rempli</p>
        <p className="text-xs text-blue-600 mb-3">
          Le document sera généré avec les données déjà saisies dans le dossier. Imprimez-le, faites-le signer
          par le parent ou responsable légal, puis uploadez-le à l&apos;étape 2.
        </p>
        <PdfDownloadButton
          inscriptionId={inscriptionId}
          token={token}
          docType={docType}
          label={`Télécharger ${docLabel}`}
          pdfUrl={pdfUrl}
          pdfEmailUrl={pdfEmailUrl}
        />
      </div>
      <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
        <p className="text-sm font-medium text-orange-800 mb-1">Étape 2 — Uploader le document signé</p>
        <p className="text-xs text-orange-600 mb-3">
          Une fois le document signé récupéré, uploadez le PDF ici. Il sera automatiquement intégré au dossier.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-100 file:text-orange-700 hover:file:bg-orange-200"
          />
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50 flex items-center gap-2"
          >
            {uploading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Envoi...
              </>
            ) : 'Intégrer au dossier'}
          </button>
        </div>
        {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
      </div>
    </div>
  );
}

// ─── Panel principal ───────────────────────────────────────────────────────────

export function DossierEnfantPanel({ inscription, token, mode = 'referent', structureCode, referentNom }: Props) {
  const isStaffFill = mode === 'staff-fill';
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('bulletin');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [alreadySent, setAlreadySent] = useState(false);
  // signatureModeRef persiste le choix offline entre reloads (useRef survit sans reset)
  const signatureModeRef = useRef<Record<string, 'online' | 'offline'>>({
    bulletin: 'online',
    sanitaire: 'online',
    liaison: 'online',
  });
  const [signatureMode, setSignatureMode] = useState(signatureModeRef.current);

  const setSignatureModeAndRef = (updates: Record<string, 'online' | 'offline'>) => {
    signatureModeRef.current = { ...signatureModeRef.current, ...updates };
    setSignatureMode({ ...signatureModeRef.current });
  };

  // Mémoiser l'objet options — sinon le hook `useCallback` reçoit une
  // nouvelle référence à chaque render et déclenche un re-fetch en boucle.
  const hookOptions = useMemo(
    () => (isStaffFill && structureCode ? { staffMode: { structureCode } } : undefined),
    [isStaffFill, structureCode],
  );

  const {
    dossier, loading, saving, saved, error, saveBloc, reload,
  } = useDossierEnfant(inscription.id, token, hookOptions);

  // Onglets visibles — tous onglets actifs en staff-fill depuis vague 2/4
  // (routes upload staff livrées).
  const TABS = BASE_TABS;

  // Progression — 4 blocs fixes obligatoires (PJ exclues du compteur)
  const hasPJ = (dossier?.documents_joints.length ?? 0) > 0;
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
  const isComplete = completedCount === totalDocs &&
    (dossier?.docs_optionnels_manquants?.length ?? 0) === 0;

  // DOC_OPT_LABELS importé depuis @/lib/dossier-shared

  // Documents manquants pour l'alerte
  const missing: string[] = [];
  if (dossier && !dossier.bulletin_completed) missing.push('Bulletin');
  if (dossier && !dossier.sanitaire_completed) missing.push('Fiche sanitaire');
  if (dossier && !dossier.liaison_completed) missing.push('Fiche de liaison');
  if (dossier && !dossier.renseignements_completed) missing.push('Fiche de renseignements');
  // Docs optionnels requis par le séjour non uploadés
  (dossier?.docs_optionnels_manquants ?? []).forEach(k => {
    missing.push(DOC_OPT_LABELS[k] ?? k);
  });

  // URLs dépendant du mode (référent suivi_token vs staff session cookie)
  const submitUrl = isStaffFill && structureCode
    ? `/api/structure/${encodeURIComponent(structureCode)}/inscriptions/${inscription.id}/submit`
    : `/api/dossier-enfant/${inscription.id}/submit`;
  const uploadApiBase = isStaffFill && structureCode
    ? `/api/structure/${encodeURIComponent(structureCode)}/inscriptions/${inscription.id}/upload`
    : undefined;
  const pdfApiBase = isStaffFill && structureCode
    ? `/api/structure/${encodeURIComponent(structureCode)}/inscriptions/${inscription.id}/pdf`
    : undefined;
  const pdfEmailApiBase = isStaffFill && structureCode
    ? `/api/structure/${encodeURIComponent(structureCode)}/inscriptions/${inscription.id}/pdf-email`
    : undefined;

  // Envoi GED
  const handleSubmit = async () => {
    if (!isComplete || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      // Token dans body uniquement en mode référent ; staff = session cookie.
      const submitBody = isStaffFill ? {} : { token };
      const res = await fetch(submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitBody),
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
        aria-expanded={open}
        aria-controls="dossier-panel-content"
        className="w-full px-6 py-3 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50 transition"
      >
        <span className="font-medium flex flex-wrap items-center gap-2">
          <FileText className="w-4 h-4 inline" /> Dossier enfant
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
                  aria-label={`${title} : ${done ? 'validé' : 'incomplet'}`}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    done ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                  }`}
                >
                  <span aria-hidden="true">{done ? <Check className="w-3 h-3 inline" /> : '!'}</span> {label}
                </span>
              ))}
              {isComplete && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                  <Check className="w-3 h-3 inline" /> Dossier complet
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
          {/* Bandeau mode dépannage — visible uniquement en staff-fill.
              Rappelle à l'utilisateur que ses modifications sont tracées
              (RGPD Art. 9) et que l'envoi final reste à l'éducateur. */}
          {isStaffFill && (
            <div
              role="status"
              className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-brand text-sm text-blue-900"
            >
              <p className="font-medium">
                Mode dépannage {referentNom ? `— absence de ${referentNom}` : ''}
              </p>
              <p className="text-xs text-blue-800 mt-1">
                Vous remplissez ce dossier en l&apos;absence de l&apos;éducateur référent.
                Chaque modification est tracée (RGPD Art. 9). L&apos;envoi final du dossier
                à la GED + téléchargement PDF + upload de pièces jointes restent réservés
                au référent via son lien de suivi personnel.
              </p>
            </div>
          )}
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
              {/* Notice RGPD — données médicales */}
              <div className="mb-4 p-3 bg-muted border border-primary-100 rounded-lg flex gap-2 items-start">
                <LockKeyhole className="w-4 h-4 text-primary-300 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  Les informations saisies dans ce dossier (fiche sanitaire, documents médicaux) sont transmises
                  uniquement à l&apos;équipe Groupe &amp; Découverte dans le cadre du séjour et conservées 3 mois après
                  celui-ci. Elles ne sont jamais communiquées à des tiers.{' '}
                  <Link href="/confidentialite" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-blue-900">
                    Politique de confidentialité
                  </Link>
                </p>
              </div>

              {/* Barre de progression */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Progression du dossier</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progression du dossier : ${progressPct}%`}>
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${progressPct === 100 ? 'bg-primary' : 'bg-secondary'}`}
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
                          ? TAB_ACTIVE_STYLES[tab.key]
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" aria-hidden="true" />
                      {tab.label}
                      {isComplete && <Check className="w-3 h-3 text-primary" />}
                    </button>
                  );
                })}
              </div>

              {/* Boutons téléchargement PDF — actifs aussi en staff-fill depuis
                  vague 3/4 (route GET /api/structure/.../pdf livrée). */}
              {dossier?.exists && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-2">Télécharger les documents (pré-remplis avec les données saisies) :</p>
                  <div className="flex flex-wrap gap-2">
                    <PdfDownloadButton
                      inscriptionId={inscription.id}
                      token={token}
                      docType="bulletin"
                      label={dossier.bulletin_completed ? "Bulletin d'inscription" : "Bulletin (à faire signer)"}
                      pdfUrl={pdfApiBase}
                      pdfEmailUrl={pdfEmailApiBase}
                    />
                    <PdfDownloadButton
                      inscriptionId={inscription.id}
                      token={token}
                      docType="sanitaire"
                      label={dossier.sanitaire_completed ? 'Fiche sanitaire' : 'Fiche sanitaire (à faire signer)'}
                      pdfUrl={pdfApiBase}
                      pdfEmailUrl={pdfEmailApiBase}
                    />
                    <PdfDownloadButton
                      inscriptionId={inscription.id}
                      token={token}
                      docType="liaison"
                      label={dossier.liaison_completed ? 'Fiche de liaison' : 'Fiche de liaison (à faire signer)'}
                      pdfUrl={pdfApiBase}
                      pdfEmailUrl={pdfEmailApiBase}
                    />
                  </div>
                </div>
              )}

              {/* Contenu de l'onglet actif */}
              {activeTab === 'bulletin' && (
                <>
                  <SignatureModeSelector
                    selectorId="sig-bulletin"
                    mode={signatureMode.bulletin}
                    onChange={m => setSignatureModeAndRef({ bulletin: m })}
                    alreadyCompleted={!!dossier?.bulletin_completed}
                  />
                  {signatureMode.bulletin === 'offline' ? (
                    <OfflineSignatureZone
                      inscriptionId={inscription.id}
                      token={token}
                      docType="bulletin"
                      docLabel="Bulletin d'inscription"
                      signedType="bulletin_signe"
                      onUploadSuccess={reload}
                      pdfUrl={pdfApiBase}
                      pdfEmailUrl={pdfEmailApiBase}
                      uploadUrl={uploadApiBase}
                    />
                  ) : (
                    <BulletinComplementForm
                      data={(dossier?.bulletin_complement || {}) as Record<string, unknown>}
                      saving={saving}
                      onSave={(data, completed) => saveBloc('bulletin_complement', data, completed)}
                      jeunePrenom={inscription.jeunePrenom}
                      jeuneNom={inscription.jeuneNom}
                    />
                  )}
                </>
              )}

              {activeTab === 'sanitaire' && (
                <>
                  <SignatureModeSelector
                    selectorId="sig-sanitaire"
                    mode={signatureMode.sanitaire}
                    onChange={m => setSignatureModeAndRef({ sanitaire: m })}
                    alreadyCompleted={!!dossier?.sanitaire_completed}
                  />
                  {signatureMode.sanitaire === 'offline' ? (
                    <OfflineSignatureZone
                      inscriptionId={inscription.id}
                      token={token}
                      docType="sanitaire"
                      docLabel="Fiche sanitaire"
                      signedType="sanitaire_signe"
                      onUploadSuccess={reload}
                      pdfUrl={pdfApiBase}
                      pdfEmailUrl={pdfEmailApiBase}
                      uploadUrl={uploadApiBase}
                    />
                  ) : (
                    <FicheSanitaireForm
                      data={(dossier?.fiche_sanitaire || {}) as Record<string, unknown>}
                      saving={saving}
                      onSave={(data, completed) => saveBloc('fiche_sanitaire', data, completed)}
                      jeunePrenom={inscription.jeunePrenom}
                      jeuneNom={inscription.jeuneNom}
                      jeuneDateNaissance={inscription.jeuneDateNaissance ?? ''}
                    />
                  )}
                </>
              )}

              {activeTab === 'liaison' && (
                <>
                  <SignatureModeSelector
                    selectorId="sig-liaison"
                    mode={signatureMode.liaison}
                    onChange={m => setSignatureModeAndRef({ liaison: m })}
                    alreadyCompleted={!!dossier?.liaison_completed}
                  />
                  {signatureMode.liaison === 'offline' ? (
                    <OfflineSignatureZone
                      inscriptionId={inscription.id}
                      token={token}
                      docType="liaison"
                      docLabel="Fiche de liaison"
                      signedType="liaison_signe"
                      onUploadSuccess={reload}
                      pdfUrl={pdfApiBase}
                      pdfEmailUrl={pdfEmailApiBase}
                      uploadUrl={uploadApiBase}
                    />
                  ) : (
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
                </>
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
                    requiredTypes={dossier?.docs_optionnels_requis ?? []}
                    apiBase={uploadApiBase}
                  />
                </>
              )}

              {/* Bouton envoi GED — actif en staff-fill depuis vague 1/4
                  (décision produit 2026-04-19 : staff = mandataire légitime).
                  L'email de confirmation est envoyé au référent + BCC staff. */}
              {dossier?.exists && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  {(alreadySent || !!dossier.ged_sent_at) ? (
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
