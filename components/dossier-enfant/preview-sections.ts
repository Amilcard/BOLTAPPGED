import type { PreviewSection } from './FichePreview';

function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'string') return v;
  return String(v);
}

function yesNo(v: unknown): string | undefined {
  if (v === 'oui') return 'Oui';
  if (v === 'non') return 'Non';
  if (v === true) return 'Oui';
  if (v === false) return 'Non';
  return undefined;
}

export function buildLiaisonPreviewSections(
  data: Record<string, unknown>,
): PreviewSection[] {
  return [
    {
      title: 'Établissement',
      fields: [
        { label: "Nom de l'établissement", value: str(data.etablissement_nom) },
        { label: 'Adresse', value: str(data.etablissement_adresse) },
        { label: 'Code postal', value: str(data.etablissement_cp) },
        { label: 'Ville', value: str(data.etablissement_ville) },
      ],
    },
    {
      title: "Responsable de l'établissement joignable",
      fields: [
        { label: 'Nom', value: str(data.resp_etablissement_nom) },
        { label: 'Prénom', value: str(data.resp_etablissement_prenom) },
        { label: 'Tél. portable 1', value: str(data.resp_etablissement_tel1) },
        { label: 'Tél. portable 2', value: str(data.resp_etablissement_tel2) },
      ],
    },
    {
      title: 'Partie jeune',
      fields: [
        { label: 'Choix seul(e)', value: yesNo(data.choix_seul) },
        { label: 'Choix avec un(e) ami(e)', value: yesNo(data.choix_ami) },
        { label: 'Choix avec éducateur/trice', value: yesNo(data.choix_educateur) },
        { label: 'Déjà parti en séjour', value: yesNo(data.deja_parti) },
        { label: 'Détail séjour précédent', value: str(data.deja_parti_detail) },
        { label: 'Pourquoi ce séjour', value: str(data.pourquoi_ce_sejour) },
        { label: 'Fiche technique lue', value: yesNo(data.fiche_technique_lue) },
      ],
    },
    {
      title: 'Engagement',
      fields: [
        { label: 'Fait à', value: str(data.signature_fait_a) },
        { label: 'Engagement accepté', value: yesNo(data.engagement_accepte) },
        { label: 'Qualité du signataire', value: str(data.signer_qualite) },
        { label: 'Signature', value: str(data.signature_image_url), isSignature: true },
      ],
    },
  ];
}

export function buildRenseignementsPreviewSections(
  data: Record<string, unknown>,
): PreviewSection[] {
  return [
    {
      title: 'Situation particulière / Handicap',
      fields: [
        { label: 'Type de handicap ou situation', value: str(data.type_situation) },
        { label: 'Aménagements nécessaires', value: str(data.amenagements_necessaires) },
        { label: 'Traitement médical', value: str(data.traitement_medical) },
      ],
    },
    {
      title: 'Médecin référent',
      fields: [
        { label: 'Nom', value: str(data.medecin_referent_nom) },
        { label: 'Téléphone', value: str(data.medecin_referent_tel) },
      ],
    },
    {
      title: 'Contact en cas d\'urgence',
      fields: [
        { label: 'Nom et prénom', value: str(data.contact_urgence_nom) },
        { label: 'Téléphone', value: str(data.contact_urgence_tel) },
      ],
    },
  ];
}
