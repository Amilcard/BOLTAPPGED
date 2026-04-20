'use client';

import { useState } from 'react';
import { computeProgress, ProgressBar } from './progress-shared';
import { mergeSharedIntoInitial, type SharedFromBulletin } from './shared-data';

interface Props {
  data: Record<string, unknown>;
  saving: boolean;
  onSave: (data: Record<string, unknown>, completed?: boolean) => Promise<boolean>;
  jeunePrenom: string;
  jeuneNom: string;
  /**
   * Donnees pre-remplies depuis le Bulletin (contact urgence, fait_a...).
   * Prop OPTIONNELLE : backward-compat avec les appels existants. Les
   * valeurs ne sont appliquees qu'au mount et ne sont JAMAIS repropagees
   * vers le Bulletin (sens unique).
   */
  initialShared?: SharedFromBulletin;
}

/**
 * Fiche de renseignements — bloc obligatoire pour tous les séjours.
 * renseignements_required est conservé en base pour la compatibilité
 * mais ne conditionne plus la visibilité ni la complétude.
 * Pattern identique aux autres formulaires (brouillon / valider).
 */
export function FicheRenseignementsForm({ data, saving, onSave, jeunePrenom, jeuneNom, initialShared }: Props) {
  // Initial state = defaults + shared (appliques uniquement si vides) + persisted.
  // mergeSharedIntoInitial garantit l'ordre : data persiste prime toujours sur shared.
  const [form, setForm] = useState<Record<string, unknown>>(() =>
    mergeSharedIntoInitial<Record<string, unknown>>(
      {
        type_situation: '',
        amenagements_necessaires: '',
        traitement_medical: '',
        medecin_referent_nom: '',
        medecin_referent_tel: '',
        contact_urgence_nom: '',
        contact_urgence_tel: '',
      },
      data,
      initialShared ?? {},
    ),
  );

  const update = (key: string, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (completed = false) => {
    await onSave(form, completed);
  };

  // Progression — champs métier (requis * + infos clés).
  const progressFields = [
    'type_situation',
    'amenagements_necessaires',
    'medecin_referent_nom',
    'medecin_referent_tel',
    'contact_urgence_nom',
    'contact_urgence_tel',
  ];
  const progress = computeProgress(form, progressFields);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
        <h3 className="font-bold text-gray-800">
          Fiche de renseignements — {jeunePrenom} {jeuneNom}
        </h3>
      </div>

      <ProgressBar label="Renseignements" filled={progress.filled} total={progress.total} color="purple" />

      <p className="text-sm text-gray-500">
        Cette fiche est requise pour ce séjour. Elle permet à l'équipe encadrante d'adapter l'accueil aux besoins spécifiques du jeune.
      </p>

      {/* Type de situation */}
      <Section title="Situation particulière / Handicap">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">
              Type de handicap ou de situation particulière *
            </label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
              rows={3}
              placeholder="Ex : déficience intellectuelle légère, trouble autistique, handicap moteur partiel..."
              value={(form.type_situation as string) || ''}
              onChange={e => update('type_situation', e.target.value)}
            />
          </div>
        </div>
      </Section>

      {/* Aménagements */}
      <Section title="Aménagements nécessaires">
        <textarea
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
          rows={3}
          placeholder="Ex : chambre proche des toilettes, aide au repas, accompagnement pour les déplacements..."
          value={(form.amenagements_necessaires as string) || ''}
          onChange={e => update('amenagements_necessaires', e.target.value)}
        />
      </Section>

      {/* Traitement médical */}
      <Section title="Traitement médical particulier">
        <textarea
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
          rows={2}
          placeholder="Préciser les médicaments, dosages et fréquences si applicable — sinon laisser vide"
          value={(form.traitement_medical as string) || ''}
          onChange={e => update('traitement_medical', e.target.value)}
        />
      </Section>

      {/* Médecin référent */}
      <Section title="Médecin référent">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">Nom du médecin</label>
            <input
              type="text"
              className="w-full border rounded-lg px-3 py-1.5 text-sm"
              placeholder="Dr. Dupont"
              value={(form.medecin_referent_nom as string) || ''}
              onChange={e => update('medecin_referent_nom', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">Téléphone du médecin</label>
            <input
              type="tel"
              className="w-full border rounded-lg px-3 py-1.5 text-sm"
              placeholder="06 00 00 00 00"
              value={(form.medecin_referent_tel as string) || ''}
              onChange={e => update('medecin_referent_tel', e.target.value)}
            />
          </div>
        </div>
      </Section>

      {/* Contact urgence */}
      <Section title="En cas d'urgence, contacter">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">Nom et prénom *</label>
            <input
              type="text"
              className="w-full border rounded-lg px-3 py-1.5 text-sm"
              placeholder="Nom Prénom"
              value={(form.contact_urgence_nom as string) || ''}
              onChange={e => update('contact_urgence_nom', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">Téléphone *</label>
            <input
              type="tel"
              className="w-full border rounded-lg px-3 py-1.5 text-sm"
              placeholder="06 00 00 00 00"
              value={(form.contact_urgence_tel as string) || ''}
              onChange={e => update('contact_urgence_tel', e.target.value)}
            />
          </div>
        </div>
      </Section>

      {/* Boutons */}
      <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
        <button
          onClick={() => handleSave(true)}
          disabled={saving || !form.type_situation || !form.contact_urgence_nom || !form.contact_urgence_tel}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50"
        >
          {saving ? 'Enregistrement...' : 'Valider le bloc'}
        </button>
      </div>
      {(!form.type_situation || !form.contact_urgence_nom || !form.contact_urgence_tel) && (
        <p className="text-xs text-purple-600 mt-1">Remplissez la situation particulière et le contact d'urgence pour pouvoir valider ce bloc.</p>
      )}
    </div>
  );
}

// ─── Sous-composants ───

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-1">{title}</h4>
      {children}
    </div>
  );
}
