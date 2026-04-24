'use client';

import { Eye, CheckCircle2, Mail } from 'lucide-react';

export interface PreviewField {
  label: string;
  /** Valeur actuelle (si le parent a déjà saisi avant la migration). */
  value?: string | number | boolean | null;
  /** Champ signature : badge discret sans afficher la data base64. */
  isSignature?: boolean;
}

export interface PreviewSection {
  title: string;
  fields: PreviewField[];
}

interface Props {
  /** Titre affiché en tête (ex. "Fiche de liaison — Jeune / Éducateur"). */
  title: string;
  /** Couleur thématique (liaison = red, renseignements = purple). */
  color: 'red' | 'purple';
  /** Sections de champs à prévisualiser. */
  sections: PreviewSection[];
  /**
   * True si le dossier contient déjà de la data réelle pour ce bloc
   * (dossier historique pré-migration). Change le bandeau.
   */
  alreadyCompleted: boolean;
}

const COLOR_MAP = {
  red: {
    bar: 'bg-red-500',
    badge: 'bg-red-100 text-red-700',
    dashed: 'border-red-200',
  },
  purple: {
    bar: 'bg-purple-500',
    badge: 'bg-purple-100 text-purple-700',
    dashed: 'border-purple-200',
  },
} as const;

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  if (typeof v === 'string' && v.length > 80) return v.slice(0, 77) + '…';
  return String(v);
}

export function FichePreview({ title, color, sections, alreadyCompleted }: Props) {
  const c = COLOR_MAP[color];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-1.5 h-6 ${c.bar} rounded-full`} aria-hidden="true" />
        <h3 className="font-bold text-gray-800">{title}</h3>
        <span
          className={`ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${c.badge}`}
        >
          <Eye className="w-3 h-3" aria-hidden="true" /> Aperçu
        </span>
      </div>

      {alreadyCompleted ? (
        <div
          role="status"
          className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex items-start gap-2"
        >
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">Déjà complété</p>
            <p className="text-xs text-green-700 mt-0.5">
              Vous avez déjà saisi ces informations. Elles sont archivées dans
              votre dossier. Le document papier vous sera tout de même envoyé
              par mail pour signature et retour.
            </p>
          </div>
        </div>
      ) : (
        <div
          role="status"
          className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-start gap-2"
        >
          <Mail className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">
              Ce document vous sera envoyé par mail à la soumission
            </p>
            <p className="text-xs text-blue-700 mt-0.5">
              Voici un aperçu des informations qui vous seront demandées sur le
              PDF à compléter et retourner signé.
            </p>
          </div>
        </div>
      )}

      {sections.map(section => (
        <fieldset
          key={section.title}
          disabled
          className={`rounded-lg border border-dashed ${c.dashed} bg-gray-50/60 p-3 space-y-2`}
        >
          <legend className="px-1 text-xs font-semibold text-gray-600">
            {section.title}
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {section.fields.map(f => (
              <div key={f.label} className="flex flex-col">
                <span className="text-[11px] text-gray-500">{f.label}</span>
                {f.isSignature ? (
                  <span className="text-xs text-gray-400 italic">
                    {f.value ? 'Signature enregistrée' : 'À signer sur le PDF'}
                  </span>
                ) : (
                  <span className="text-sm text-gray-700 truncate">
                    {formatValue(f.value)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
