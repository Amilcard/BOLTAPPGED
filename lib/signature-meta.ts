/**
 * Métadonnées signature électronique simple (SES eIDAS).
 *
 * Quand un bloc du dossier enfant (bulletin / sanitaire / liaison) reçoit une
 * NOUVELLE signature canvas via PATCH, on persiste en DB :
 *   - <bloc>_signed_at   : horodatage signature
 *   - <bloc>_signed_ip   : IP source (preuve identification)
 *   - <bloc>_signer_qualite : enum qualité signataire
 *   - <bloc>_signature_hash : hash SHA-256 du PNG (preuve intégrité)
 *   - consent_text_version  : version du texte de consentement accepté
 *
 * Colonnes créées par migration 083 (2026-04-19). Sert à produire une SES
 * conforme eIDAS : horodatage + identification + intégrité + consentement.
 */
import { createHash } from 'crypto';

export const SIGNER_QUALITES = [
  'responsable_legal',
  'delegataire_ase',
  'tuteur',
] as const;

export type SignerQualite = (typeof SIGNER_QUALITES)[number];

/**
 * Version courante du texte de consentement légal signé par les 3 blocs.
 * Permet de retracer la formulation exacte acceptée pour audit RGPD.
 * À bumper manuellement si le wording des checkboxes change dans les forms.
 */
export const CONSENT_TEXT_VERSION = 'v2026-04';

/**
 * Blocs JSONB susceptibles de porter une signature dans gd_dossier_enfant.
 * La fiche_renseignements ne porte pas de signature (interne, non légale).
 */
const SIGNABLE_BLOC_TO_PREFIX: Record<string, string> = {
  bulletin_complement: 'bulletin',
  fiche_sanitaire: 'sanitaire',
  fiche_liaison_jeune: 'liaison',
};

export function isSignableBloc(bloc: string): boolean {
  return Object.prototype.hasOwnProperty.call(SIGNABLE_BLOC_TO_PREFIX, bloc);
}

/**
 * Construit le patch de colonnes signature metadata à appliquer sur l'UPDATE
 * de `gd_dossier_enfant` quand une nouvelle signature est détectée.
 *
 * Renvoie :
 *   - ok=true + columns={<bloc>_signed_at, ...} si signature nouvelle valide
 *   - ok=false + code='INVALID_SIGNER_QUALITE' si signature présente mais qualité absente/invalide
 *   - ok=true + columns={} si aucune signature nouvelle (no-op)
 *
 * Note : `existingBlocData` contient l'ancienne valeur du bloc JSONB (avant
 * merge) pour détecter si signature_image_url a réellement changé.
 */
export function buildSignatureMeta(params: {
  bloc: string;
  incomingData: Record<string, unknown>;
  existingBlocData: Record<string, unknown>;
  ip: string | undefined;
}):
  | { ok: true; columns: Record<string, unknown> }
  | { ok: false; code: 'INVALID_SIGNER_QUALITE'; message: string } {
  const { bloc, incomingData, existingBlocData, ip } = params;

  if (!isSignableBloc(bloc)) {
    return { ok: true, columns: {} };
  }

  const newSig = incomingData.signature_image_url;
  // Pas de signature dans ce PATCH → rien à persister côté metadata.
  if (newSig === undefined) {
    return { ok: true, columns: {} };
  }
  // Effacement explicite (signature vidée) → on laisse le bloc JSONB faire le job,
  // mais on NE réinitialise PAS les colonnes metadata (historique conservé).
  if (newSig === null || newSig === '') {
    return { ok: true, columns: {} };
  }
  if (typeof newSig !== 'string') {
    return { ok: true, columns: {} };
  }

  const prevSig = existingBlocData?.signature_image_url;
  // Signature identique à l'existante → pas de nouvelle signature, no-op.
  if (typeof prevSig === 'string' && prevSig === newSig) {
    return { ok: true, columns: {} };
  }

  // Nouvelle signature détectée — qualité requise.
  const qualite = incomingData.signer_qualite;
  if (
    typeof qualite !== 'string' ||
    !SIGNER_QUALITES.includes(qualite as SignerQualite)
  ) {
    return {
      ok: false,
      code: 'INVALID_SIGNER_QUALITE',
      message: 'Qualité du signataire manquante ou invalide.',
    };
  }

  const prefix = SIGNABLE_BLOC_TO_PREFIX[bloc];
  const hash = createHash('sha256').update(newSig).digest('hex');

  return {
    ok: true,
    columns: {
      [`${prefix}_signed_at`]: new Date().toISOString(),
      [`${prefix}_signed_ip`]: ip ?? null,
      [`${prefix}_signer_qualite`]: qualite,
      [`${prefix}_signature_hash`]: hash,
      consent_text_version: CONSENT_TEXT_VERSION,
    },
  };
}
