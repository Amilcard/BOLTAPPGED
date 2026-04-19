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

/**
 * Whitelist des blocs JSONB éditables dans `gd_dossier_enfant`.
 * Source unique utilisée par :
 *   - `PATCH /api/dossier-enfant/[inscriptionId]` (éducateur via suivi_token)
 *   - `PATCH /api/structure/[code]/inscriptions/[id]/dossier` (staff structure)
 *
 * Toute extension DOIT venir ici pour garantir cohérence + sécurité (guard).
 */
export const EDITABLE_BLOCS = [
  'bulletin_complement',
  'fiche_sanitaire',
  'fiche_liaison_jeune',
  'fiche_renseignements',
] as const;

export type EditableBloc = typeof EDITABLE_BLOCS[number];

/**
 * Mapping bloc JSONB → colonne boolean `*_completed` correspondante.
 * Utilisé pour propager le flag `completed` lors d'un PATCH.
 */
export function getCompletedColumn(bloc: string): string | null {
  const map: Record<string, string> = {
    bulletin_complement: 'bulletin_completed',
    fiche_sanitaire: 'sanitaire_completed',
    fiche_liaison_jeune: 'liaison_completed',
    fiche_renseignements: 'renseignements_completed',
  };
  return Object.prototype.hasOwnProperty.call(map, bloc) ? map[bloc] : null;
}
