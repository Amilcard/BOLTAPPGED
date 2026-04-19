'use client';

import { useState, useId } from 'react';
import { SignaturePad } from './SignaturePad';
import { computeProgress, ProgressBar } from './progress-shared';

interface Props {
  data: Record<string, unknown>;
  saving: boolean;
  onSave: (data: Record<string, unknown>, completed?: boolean) => Promise<boolean>;
  jeunePrenom: string;
  jeuneNom: string;
  sejourNom: string;
  sessionDate: string;
}

/**
 * Fiche de liaison page 1 — Partie jeune + éducateur.
 * Pages 2 et 3 sont internes (équipe GED) → pas de formulaire en ligne.
 */
export function FicheLiaisonJeuneForm({ data, saving, onSave, jeunePrenom, jeuneNom, sejourNom, sessionDate }: Props) {
  const [form, setForm] = useState<Record<string, unknown>>({
    // Établissement
    etablissement_nom: '',
    etablissement_adresse: '',
    etablissement_cp: '',
    etablissement_ville: '',
    // Responsable établissement joignable
    resp_etablissement_nom: '',
    resp_etablissement_prenom: '',
    resp_etablissement_tel1: '',
    resp_etablissement_tel2: '',
    // Partie jeune
    choix_seul: '',
    choix_ami: '',
    choix_educateur: '',
    deja_parti: '',
    deja_parti_detail: '',
    pourquoi_ce_sejour: '',
    fiche_technique_lue: '',
    // Engagement
    engagement_accepte: false,
    signature_fait_a: '',
    ...data,
  });

  const update = (key: string, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (completed = false) => {
    await onSave(form, completed);
  };

  // Progression — champs clés de la fiche liaison page 1.
  const progressFields = [
    'etablissement_nom', 'etablissement_adresse', 'etablissement_cp', 'etablissement_ville',
    'resp_etablissement_nom', 'resp_etablissement_prenom', 'resp_etablissement_tel1',
    'pourquoi_ce_sejour', 'fiche_technique_lue',
    'signature_fait_a',
    'engagement_accepte',
    'signature_image_url',
  ];
  const progress = computeProgress(form, progressFields);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-6 bg-red-500 rounded-full" />
        <h3 className="font-bold text-gray-800">Fiche de liaison — Jeune / Éducateur</h3>
      </div>

      <ProgressBar label="Fiche de liaison" filled={progress.filled} total={progress.total} color="red" />

      {/* Renseignements jeune */}
      <Section title="Renseignements concernant le jeune">
        <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600 mb-3">
          {jeunePrenom} {jeuneNom} — Séjour : {sejourNom} — Session : {sessionDate}
        </div>
      </Section>

      {/* Établissement */}
      <Section title="Établissement">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Nom de l'établissement" value={form.etablissement_nom} onChange={v => update('etablissement_nom', v)} className="sm:col-span-2" />
          <Input label="Adresse" value={form.etablissement_adresse} onChange={v => update('etablissement_adresse', v)} className="sm:col-span-2" />
          <Input label="Code postal" value={form.etablissement_cp} onChange={v => update('etablissement_cp', v)} />
          <Input label="Ville" value={form.etablissement_ville} onChange={v => update('etablissement_ville', v)} />
        </div>
      </Section>

      {/* Responsable établissement */}
      <Section title="Responsable de l'établissement joignable à tout moment">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Nom" value={form.resp_etablissement_nom} onChange={v => update('resp_etablissement_nom', v)} />
          <Input label="Prénom" value={form.resp_etablissement_prenom} onChange={v => update('resp_etablissement_prenom', v)} />
          <Input label="Tél. portable 1" value={form.resp_etablissement_tel1} onChange={v => update('resp_etablissement_tel1', v)} type="tel" />
          <Input label="Tél. portable 2" value={form.resp_etablissement_tel2} onChange={v => update('resp_etablissement_tel2', v)} type="tel" />
        </div>
      </Section>

      {/* Partie à remplir par le jeune */}
      <Section title="Partie à remplir par le jeune">
        <p className="text-xs text-gray-400 mb-3">
          Ces questions permettent de mieux connaître le jeune et ses attentes pour le séjour.
        </p>

        <p className="text-sm text-gray-700 mb-2">Comment as-tu choisi ton séjour ?</p>
        <div className="flex flex-wrap gap-4 mb-4">
          <RadioYesNo label="Seul(e)" value={form.choix_seul as string} onChange={v => update('choix_seul', v)} />
          <RadioYesNo label="Avec un(e) ami(e)" value={form.choix_ami as string} onChange={v => update('choix_ami', v)} />
          <RadioYesNo label="Avec l'aide d'un(e) éducateur/trice" value={form.choix_educateur as string} onChange={v => update('choix_educateur', v)} />
        </div>

        <RadioYesNo label="Es-tu déjà parti(e) en séjour de vacances ?" value={form.deja_parti as string} onChange={v => update('deja_parti', v)} />
        {form.deja_parti === 'oui' && (
          <div className="mt-2 pl-4 border-l-2 border-gray-200">
            <Input label="Si oui, où et quand ?" value={form.deja_parti_detail} onChange={v => update('deja_parti_detail', v)} />
          </div>
        )}

        <div className="mt-3">
          <label className="text-sm text-gray-700 block mb-1">Pourquoi as-tu choisi ce séjour ? (activités, destination, autre…)</label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm"
            rows={3}
            value={(form.pourquoi_ce_sejour as string) || ''}
            onChange={e => update('pourquoi_ce_sejour', e.target.value)}
          />
        </div>

        <div className="mt-3">
          <RadioYesNo label="As-tu pris connaissance de la fiche technique du séjour ?" value={form.fiche_technique_lue as string} onChange={v => update('fiche_technique_lue', v)} />
        </div>
      </Section>

      {/* Engagement */}
      <Section title="Engagement">
        <div className="p-3 bg-red-50 rounded-lg text-xs text-gray-600 mb-3">
          La vie en groupe nécessite de mettre en place des règles de vie. La réglementation des centres
          de vacances impose de respecter des directives précises destinées à assurer la sécurité de tous
          et les meilleures conditions de vie collective. Tout comportement de nature à nuire à la sécurité
          ou pouvant compromettre la qualité des vacances pourra donner lieu à une décision de renvoi.
        </div>
        <div className="mb-3 max-w-xs">
          <Input label="Fait à" value={form.signature_fait_a} onChange={v => update('signature_fait_a', v)} />
        </div>
        <Checkbox
          label="Le jeune et le responsable attestent avoir pris connaissance des règles et s'engagent à les respecter"
          checked={!!form.engagement_accepte}
          onChange={v => update('engagement_accepte', v)}
        />
        <div className="mt-3">
          <SignaturePad
            label="Signature du jeune et du responsable"
            value={form.signature_image_url as string | null}
            onChange={dataUrl => update('signature_image_url', dataUrl)}
            disabled={saving}
          />
        </div>
      </Section>

      {/* Boutons */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          onClick={() => handleSave(true)}
          disabled={saving || !form.engagement_accepte}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
        >
          {saving ? 'Enregistrement...' : 'Valider le bloc'}
        </button>
      </div>
      {!form.engagement_accepte && (
        <p className="text-xs text-red-600 mt-1">Cochez la case d'engagement ci-dessus pour pouvoir valider ce bloc.</p>
      )}
    </div>
  );
}

// === Sous-composants ===

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-2">{title}</p>
      {children}
    </div>
  );
}

function Input({
  label, value, onChange, type = 'text', className = '',
}: {
  label: string; value: unknown; onChange: (v: string) => void;
  type?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs text-gray-500 block mb-0.5">{label}</label>
      <input type={type} className="w-full border rounded-lg px-3 py-1.5 text-sm"
        value={(value as string) || ''} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
      {label}
    </label>
  );
}

function RadioYesNo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const name = useId();
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      <div className="flex gap-3">
        <label className="flex items-center gap-1 text-sm cursor-pointer">
          <input type="radio" name={name} value="oui" checked={value === 'oui'} onChange={() => onChange('oui')} /> Oui
        </label>
        <label className="flex items-center gap-1 text-sm cursor-pointer">
          <input type="radio" name={name} value="non" checked={value === 'non'} onChange={() => onChange('non')} /> Non
        </label>
      </div>
    </div>
  );
}
