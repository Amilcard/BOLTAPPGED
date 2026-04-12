'use client';

import { FileCheck, FileClock } from 'lucide-react';

export interface Completude {
  bulletin?: boolean | null;
  sanitaire?: boolean | null;
  liaison?: boolean | null;
  renseignements?: boolean | null;
  pj_count?: number;
  pj_vaccins?: boolean | null;
}

export function DossierBadge({ completude, gedSentAt }: { completude: Completude | null | undefined; gedSentAt?: string | null }) {
  if (!completude) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        <FileClock size={12} /> À faire
      </span>
    );
  }

  const fiches = [completude.bulletin, completude.sanitaire, completude.liaison, completude.renseignements].filter(Boolean).length;
  const total = 4;
  const hasPJ = (completude.pj_count ?? 0) > 0;
  const hasVaccins = completude.pj_vaccins;
  const isComplete = fiches === total;

  if (gedSentAt) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
        <FileCheck size={12} /> ✓ Envoyé
      </span>
    );
  }

  if (isComplete) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <FileCheck size={12} /> Complet
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
        {fiches}/{total} fiches
      </span>
      <div className="flex gap-1">
        <span className={`text-[10px] font-bold px-1 rounded ${completude.bulletin ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`} title="Bulletin d'inscription">B</span>
        <span className={`text-[10px] font-bold px-1 rounded ${completude.sanitaire ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`} title="Fiche sanitaire">S</span>
        <span className={`text-[10px] font-bold px-1 rounded ${completude.liaison ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`} title="Fiche de liaison">L</span>
        <span className={`text-[10px] font-bold px-1 rounded ${completude.renseignements ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`} title="Fiche de renseignements">R</span>
        <span className={`text-[10px] font-bold px-1 rounded ${hasVaccins ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`} title="Carnet de vaccinations">V</span>
        <span className={`text-[10px] font-bold px-1 rounded ${hasPJ ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`} title="Pièces jointes">PJ</span>
      </div>
    </div>
  );
}
