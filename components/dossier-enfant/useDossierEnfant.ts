'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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
 * Hook pour charger et sauvegarder le dossier enfant d'une inscription.
 * Sauvegarde progressive : chaque appel à saveBloc merge les données dans le bloc JSONB.
 */
export function useDossierEnfant(inscriptionId: string, token: string): UseDossierEnfantReturn {
  const [dossier, setDossier] = useState<DossierEnfant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTimeout = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(async () => {
    if (!inscriptionId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dossier-enfant/${inscriptionId}?token=${token}`);
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
  }, [inscriptionId, token]);

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
      const res = await fetch(`/api/dossier-enfant/${inscriptionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, bloc, data, completed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || 'Erreur de sauvegarde');
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
  }, [inscriptionId, token]);

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
