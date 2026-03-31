/**
 * Enrichissement commun des inscriptions Supabase.
 * Utilisé par admin/inscriptions et structure/[code].
 */

interface DossierRaw {
  bulletin_completed?: boolean;
  sanitaire_completed?: boolean;
  liaison_completed?: boolean;
  renseignements_completed?: boolean;
  renseignements_required?: boolean;
  documents_joints?: Array<{ type?: string }> | null;
  ged_sent_at?: string | null;
}

interface StayRaw {
  marketing_title?: string;
  title?: string;
}

export interface InscriptionRaw {
  gd_dossier_enfant?: DossierRaw[];
  gd_stays?: StayRaw;
  sejour_slug: string;
  [key: string]: unknown;
}

export function enrichInscription(insc: InscriptionRaw) {
  const dossier = insc.gd_dossier_enfant?.[0] ?? null;
  const docs = dossier && Array.isArray(dossier.documents_joints) ? dossier.documents_joints : [];
  const stay = insc.gd_stays;

  return {
    ...insc,
    gd_dossier_enfant: undefined,
    gd_stays: undefined,
    sejour_titre: stay?.marketing_title || stay?.title || insc.sejour_slug,
    ged_sent_at: dossier?.ged_sent_at ?? null,
    dossier_completude: dossier ? {
      bulletin: !!dossier.bulletin_completed,
      sanitaire: !!dossier.sanitaire_completed,
      liaison: !!dossier.liaison_completed,
      renseignements: !!dossier.renseignements_completed,
      renseignements_required: !!dossier.renseignements_required,
      pj_count: docs.length,
      pj_vaccins: docs.some(d => d.type === 'vaccins'),
    } : null,
  };
}

export function enrichInscriptions(data: InscriptionRaw[]) {
  return data.map(enrichInscription);
}
