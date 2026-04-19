'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { UUID_RE } from '@/lib/validators';

function validateUUID(s: string): string | null {
  const match = UUID_RE.exec(s);
  return match ? match[0] : null;
}

export interface DossierEnfant {
  exists: boolean;
  inscription_id?: string;
  bulletin_complement: Record<string, unknown>;
  fiche_sanitaire: Record<string, unknown>;
  fiche_liaison_jeune: Record<string, unknown>;
  fiche_renseignements: Record<string, unknown> | null;
  documents_joints: Array<{
    type: string;
    filename: string;
    storage_path: string;
    uploaded_at: string;
  }>;
  bulletin_completed: boolean;
  sanitaire_completed: boolean;
  liaison_completed: boolean;
  renseignements_completed: boolean;
  renseignements_required: boolean;
  ged_sent_at?: string | null;
  docs_optionnels_requis?: string[];
  docs_optionnels_manquants?: string[];
}

interface UseDossierEnfantReturn {
  dossier: DossierEnfant | null;
  loading: boolean;
  saving: boolean;
  saved: boolean;
  error: string | null;
  saveBloc: (bloc: string, data: Record<string, unknown>, completed?: boolean) => Promise<boolean>;
  reload: () => void;
}

/**
 * Options du hook — permet de switcher entre le mode référent (suivi_token
 * public, URLs `/api/dossier-enfant/*`) et le mode staff structure (session
 * cookie JWT, URLs `/api/structure/[code]/inscriptions/[id]/dossier`).
 *
 * Par défaut : mode référent (backward-compat avec les callers existants
 * dans /suivi/[token]).
 */
export interface UseDossierEnfantOptions {
  /**
   * Si fourni, le hook utilise la route structure staff (GET + PATCH via
   * session cookie, pas de token dans l'URL ni le body). Use case :
   * secrétariat/direction remplit en dépannage.
   */
  staffMode?: { structureCode: string };
}

/**
 * Hook pour charger et sauvegarder le dossier enfant d'une inscription.
 * Sauvegarde progressive : chaque appel à saveBloc merge les données dans
 * le bloc JSONB.
 *
 * Backward-compat : appel historique `useDossierEnfant(id, token)` inchangé.
 * Mode staff : `useDossierEnfant(id, '', { staffMode: { structureCode: 'XXX' } })`.
 */
export function useDossierEnfant(
  inscriptionId: string,
  token: string,
  options: UseDossierEnfantOptions = {},
): UseDossierEnfantReturn {
  const [dossier, setDossier] = useState<DossierEnfant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTimeout = useRef<NodeJS.Timeout | null>(null);

  const staffMode = options.staffMode;

  const load = useCallback(async () => {
    const safeId = validateUUID(inscriptionId);
    if (!safeId) return;

    // En mode staff, le token n'est pas requis — session cookie suffit.
    if (!staffMode) {
      const safeToken = validateUUID(token);
      if (!safeToken) return;
    }

    setLoading(true);
    setError(null);
    try {
      const url = staffMode
        ? `/api/structure/${encodeURIComponent(staffMode.structureCode)}/inscriptions/${safeId}/dossier`
        : `/api/dossier-enfant/${safeId}?token=${validateUUID(token)}`;

      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || 'Erreur de chargement');
      }
      const data = await res.json();
      setDossier(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [inscriptionId, token, staffMode]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveBloc = useCallback(async (
    bloc: string,
    data: Record<string, unknown>,
    completed?: boolean
  ): Promise<boolean> => {
    setSaving(true);
    setSaved(false);
    if (savedTimeout.current) clearTimeout(savedTimeout.current);

    try {
      const safeId = validateUUID(inscriptionId);
      if (!safeId) throw new Error('ID invalide');

      const url = staffMode
        ? `/api/structure/${encodeURIComponent(staffMode.structureCode)}/inscriptions/${safeId}/dossier`
        : `/api/dossier-enfant/${safeId}`;

      // En mode staff, ne pas inclure token — auth par session cookie.
      const body = staffMode
        ? { bloc, data, completed }
        : { token, bloc, data, completed };

      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const respBody = await res.json().catch(() => ({}));
        throw new Error(respBody?.error?.message || 'Erreur de sauvegarde');
      }

      const result = await res.json();
      if (result.dossier) {
        setDossier({ exists: true, ...result.dossier });
      }

      setSaved(true);
      savedTimeout.current = setTimeout(() => setSaved(false), 2500);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [inscriptionId, token, staffMode]);

  return {
    dossier,
    loading,
    saving,
    saved,
    error,
    saveBloc,
    reload: load,
  };
}
