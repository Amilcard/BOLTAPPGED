/**
 * Constantes partagées entre les routes API du dossier enfant et les composants frontend.
 * Source unique de vérité — modifier ici se répercute partout.
 */

/**
 * Mapping entre les valeurs de gd_stays.documents_requis
 * et les types dans gd_dossier_enfant.documents_joints.
 *
 * Les entrées 'fiche_sanitaire', 'renseignements', 'bulletin' ne figurent pas ici
 * car elles sont gérées par les colonnes *_completed, pas par documents_joints.
 */
export const REQUIS_TO_JOINT: Record<string, string> = {
  pass_nautique: 'pass_nautique',
  certificat_medical: 'certificat_medical',
  attestation_assurance: 'attestation_assurance',
  autorisation_parentale: 'signature_parentale',
  certificat_plongee: 'certificat_plongee',
};

/**
 * Labels lisibles pour les types de documents optionnels requis par le séjour.
 * Utilisés dans les alertes et indicateurs UI.
 */
export const DOC_OPT_LABELS: Record<string, string> = {
  pass_nautique: 'Pass nautique / aisance aquatique',
  certificat_medical: 'Certificat médical (sport à risque)',
  attestation_assurance: "Attestation d'assurance",
  autorisation_parentale: 'Autorisation parentale',
  certificat_plongee: 'Certificat de plongée',
};
