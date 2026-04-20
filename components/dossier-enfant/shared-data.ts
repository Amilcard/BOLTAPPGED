/**
 * Propagation des donnees communes du Bulletin vers les autres blocs.
 *
 * Sens UNIQUE : Bulletin (saisi en premier) -> Sanitaire / Liaison / Renseignements.
 * Ne JAMAIS propager dans l'autre sens (pour eviter d'ecraser la source).
 *
 * Decision produit 2026-04-19 : pour cette vague, seuls 3 champs evidents
 * sont propages (contact urgence nom/tel, fait_a). Elargir quand on aura
 * une lecture terrain claire des autres doublons (adresse postale, resp legaux).
 *
 * Regle d'or : n'ecrase jamais un champ deja rempli cote cible. La cible peut
 * modifier librement sans impacter la source.
 */

export interface SharedFromBulletin {
  // Fiche renseignements
  contact_urgence_nom?: string;
  contact_urgence_tel?: string;
  // Fiche liaison
  signature_fait_a?: string;
}

function toStr(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

/**
 * Extrait les champs propagables depuis le JSONB bulletin_complement.
 * Renvoie undefined pour chaque champ absent ou vide.
 */
export function getSharedDataFromBulletin(
  bulletin: Record<string, unknown> | null | undefined,
): SharedFromBulletin {
  if (!bulletin) return {};
  return {
    contact_urgence_nom: toStr(bulletin.contact_urgence_nom),
    // Nom technique different entre Bulletin (_telephone) et Renseignements (_tel)
    contact_urgence_tel: toStr(bulletin.contact_urgence_telephone),
    // Bulletin.autorisation_fait_a -> Liaison.signature_fait_a
    signature_fait_a: toStr(bulletin.autorisation_fait_a),
  };
}

/**
 * Fusionne `shared` dans `initial` en n'ecrasant jamais un champ deja rempli
 * cote cible. Utiliser au moment de l'initialisation du useState.
 */
export function mergeSharedIntoInitial<T extends Record<string, unknown>>(
  initial: T,
  persisted: Record<string, unknown> | null | undefined,
  shared: SharedFromBulletin,
): T {
  const merged: Record<string, unknown> = { ...initial };
  // 1. Applique d'abord shared, mais uniquement si initial est vide
  for (const [key, value] of Object.entries(shared)) {
    if (value === undefined) continue;
    const existing = merged[key];
    const isEmpty = existing === undefined || existing === null || existing === '';
    if (isEmpty) merged[key] = value;
  }
  // 2. Persisted prime ensuite (le user a deja saisi/modifie ces champs ailleurs)
  if (persisted) {
    for (const [key, value] of Object.entries(persisted)) {
      if (value !== undefined) merged[key] = value;
    }
  }
  return merged as T;
}
