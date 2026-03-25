'use client';

import { useState } from 'react';

interface Props {
  data: Record<string, unknown>;
  saving: boolean;
  onSave: (data: Record<string, unknown>, completed?: boolean) => Promise<boolean>;
  jeunePrenom: string;
  jeuneNom: string;
  jeuneDateNaissance?: string;
}

const VACCINS = [
  { key: 'diphterie', label: 'Diphtérie' },
  { key: 'tetanos', label: 'Tétanos' },
  { key: 'poliomyelite', label: 'Poliomyélite' },
  { key: 'coqueluche', label: 'Coqueluche' },
  { key: 'haemophilus', label: 'Haemophilus' },
  { key: 'rubeole_oreillons_rougeole', label: 'Rubéole / Oreillons / Rougeole' },
  { key: 'hepatite_b', label: 'Hépatite B' },
  { key: 'meningocoque_c', label: 'Méningocoque C' },
  { key: 'pneumocoque', label: 'Pneumocoque' },
];

export function FicheSanitaireForm({ data, saving, onSave, jeunePrenom, jeuneNom, jeuneDateNaissance }: Props) {
  const [form, setForm] = useState<Record<string, unknown>>({
    // Enfant
    classe: '',
    sexe: '',
    sieste: '',
    pai: false,
    aeeh: false,
    // Responsable 1
    resp1_nom: '', resp1_prenom: '', resp1_parente: '', resp1_adresse: '',
    resp1_profession: '', resp1_email: '', resp1_tel_domicile: '',
    resp1_tel_portable: '', resp1_tel_travail: '',
    // Responsable 2
    resp2_nom: '', resp2_prenom: '', resp2_parente: '', resp2_adresse: '',
    resp2_profession: '', resp2_email: '', resp2_tel_domicile: '',
    resp2_tel_portable: '', resp2_tel_travail: '',
    // CAF
    allocataire_caf_msa: '', quotient_familial: '',
    // Délégations (max 4)
    delegation_1_nom: '', delegation_1_prenom: '', delegation_1_lien: '', delegation_1_tel: '',
    delegation_2_nom: '', delegation_2_prenom: '', delegation_2_lien: '', delegation_2_tel: '',
    delegation_3_nom: '', delegation_3_prenom: '', delegation_3_lien: '', delegation_3_tel: '',
    // Médecin
    medecin_nom: '', medecin_tel: '',
    // Vaccinations (chaque vaccin : oui/non + date rappel)
    ...VACCINS.reduce((acc, v) => ({
      ...acc,
      [`vaccin_${v.key}`]: '',
      [`vaccin_${v.key}_date`]: '',
    }), {}),
    // Médical
    poids: '', taille: '',
    traitement_en_cours: false,
    traitement_detail: '',
    allergie_asthme: '',
    allergie_alimentaire: '',
    allergie_medicamenteuse: '',
    allergie_autres: '',
    allergie_detail: '',
    probleme_sante: '',
    probleme_sante_detail: '',
    // Recommandations
    recommandations_parents: '',
    // Autorisation soins
    autorisation_soins_soussigne: '',
    autorisation_soins_accepte: false,
    ...data,
  });

  const update = (key: string, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (completed = false) => {
    await onSave(form, completed);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
        <h3 className="font-bold text-gray-800">Fiche sanitaire de liaison</h3>
      </div>

      {/* 1. L'enfant */}
      <Section title="1. L'enfant">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div className="col-span-2">
            <p className="text-sm text-gray-600">{jeunePrenom} {jeuneNom} — né(e) le {jeuneDateNaissance}</p>
          </div>
          <Input label="Classe (2025/2026)" value={form.classe} onChange={v => update('classe', v)} />
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">Sexe *</label>
            <select className="w-full border rounded-lg px-3 py-1.5 text-sm" value={(form.sexe as string) || ''} onChange={e => update('sexe', e.target.value)}>
              <option value="">—</option>
              <option value="garcon">Garçon</option>
              <option value="fille">Fille</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 mb-3">
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">Sieste (petits)</label>
            <select className="border rounded-lg px-3 py-1.5 text-sm" value={(form.sieste as string) || ''} onChange={e => update('sieste', e.target.value)}>
              <option value="">Non concerné</option>
              <option value="oui">Oui (besoin d&apos;une couche)</option>
              <option value="ca_depend">Ça dépend (préciser le matin)</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <Checkbox label="Enfant détenteur d'un P.A.I." checked={!!form.pai} onChange={v => update('pai', v)} />
          <Checkbox label="Bénéficiaire de l'AEEH" checked={!!form.aeeh} onChange={v => update('aeeh', v)} />
        </div>
      </Section>

      {/* 2. Responsables légaux */}
      <Section title="2. Responsable légal 1 (payeur)">
        <ResponsableFields prefix="resp1" form={form} update={update} />
      </Section>

      <Section title="Responsable légal 2">
        <ResponsableFields prefix="resp2" form={form} update={update} />
      </Section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="N° Allocataire CAF ou MSA *" value={form.allocataire_caf_msa} onChange={v => update('allocataire_caf_msa', v)} required />
        <Input label="Quotient Familial *" value={form.quotient_familial} onChange={v => update('quotient_familial', v)} required />
      </div>

      {/* 3. Délégations */}
      <Section title="3. Délégations (personnes autorisées à récupérer l'enfant)">
        <p className="text-xs text-gray-400 mb-3">Indiquez les personnes ayant reçu votre autorisation.</p>
        {[1, 2, 3].map(i => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <Input label="Nom" value={form[`delegation_${i}_nom`]} onChange={v => update(`delegation_${i}_nom`, v)} />
            <Input label="Prénom" value={form[`delegation_${i}_prenom`]} onChange={v => update(`delegation_${i}_prenom`, v)} />
            <Input label="Lien" value={form[`delegation_${i}_lien`]} onChange={v => update(`delegation_${i}_lien`, v)} />
            <Input label="Téléphone" value={form[`delegation_${i}_tel`]} onChange={v => update(`delegation_${i}_tel`, v)} type="tel" />
          </div>
        ))}
      </Section>

      {/* 4. Vaccinations */}
      <Section title="4. Vaccinations">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Input label="Nom du médecin traitant" value={form.medecin_nom} onChange={v => update('medecin_nom', v)} />
          <Input label="Téléphone médecin" value={form.medecin_tel} onChange={v => update('medecin_tel', v)} type="tel" />
        </div>
        <p className="text-xs text-gray-400 mb-2">Joindre obligatoirement une copie des vaccins du carnet de santé.</p>
        <div className="overflow-x-auto">
        <div className="border rounded-lg overflow-hidden min-w-[480px]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 text-xs text-gray-500">Vaccin</th>
                <th className="text-center px-2 py-2 text-xs text-gray-500 w-16">Oui</th>
                <th className="text-center px-2 py-2 text-xs text-gray-500 w-16">Non</th>
                <th className="text-left px-3 py-2 text-xs text-gray-500">Date dernier rappel</th>
              </tr>
            </thead>
            <tbody>
              {VACCINS.map(v => (
                <tr key={v.key} className="border-t">
                  <td className="px-3 py-1.5 text-gray-700">{v.label}</td>
                  <td className="text-center px-2">
                    <input type="radio" name={`vaccin_${v.key}`} value="oui"
                      checked={form[`vaccin_${v.key}`] === 'oui'}
                      onChange={() => update(`vaccin_${v.key}`, 'oui')}
                    />
                  </td>
                  <td className="text-center px-2">
                    <input type="radio" name={`vaccin_${v.key}`} value="non"
                      checked={form[`vaccin_${v.key}`] === 'non'}
                      onChange={() => update(`vaccin_${v.key}`, 'non')}
                    />
                  </td>
                  <td className="px-3">
                    <input type="text" className="w-full border rounded px-2 py-1 text-xs"
                      placeholder="JJ/MM/AAAA"
                      value={(form[`vaccin_${v.key}_date`] as string) || ''}
                      onChange={e => update(`vaccin_${v.key}_date`, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </Section>

      {/* 5. Renseignements médicaux */}
      <Section title="5. Renseignements médicaux">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <Input label="Poids (kg)" value={form.poids} onChange={v => update('poids', v)} />
          <Input label="Taille (cm)" value={form.taille} onChange={v => update('taille', v)} />
        </div>

        <div className="mb-3">
          <Checkbox label="Votre enfant suit un traitement médical pendant l'accueil"
            checked={!!form.traitement_en_cours} onChange={v => update('traitement_en_cours', v)} />
          {form.traitement_en_cours === true && (
            <p className="text-xs text-orange-600 mt-1 ml-6">
              Si oui, joindre une ordonnance de moins de 3 mois et les médicaments correspondants.
            </p>
          )}
        </div>

        <p className="text-sm font-medium text-gray-700 mb-2">Allergies et difficultés de santé</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <RadioYesNo label="Asthme" value={form.allergie_asthme as string} onChange={v => update('allergie_asthme', v)} />
          <RadioYesNo label="Alimentaires" value={form.allergie_alimentaire as string} onChange={v => update('allergie_alimentaire', v)} />
          <RadioYesNo label="Médicamenteuses" value={form.allergie_medicamenteuse as string} onChange={v => update('allergie_medicamenteuse', v)} />
          <Input label="Autres (animaux, plantes, pollen...)" value={form.allergie_autres} onChange={v => update('allergie_autres', v)} />
        </div>
        <textarea
          className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
          rows={2}
          placeholder="Préciser la cause de l'allergie, les signes évocateurs et la conduite à tenir"
          value={(form.allergie_detail as string) || ''}
          onChange={e => update('allergie_detail', e.target.value)}
        />

        <RadioYesNo label="Problème de santé particulier nécessitant la transmission d'informations médicales"
          value={form.probleme_sante as string} onChange={v => update('probleme_sante', v)} />
        {form.probleme_sante === 'oui' && (
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm mt-2"
            rows={2}
            placeholder="Précisions sur le problème de santé, précautions à prendre, soins éventuels"
            value={(form.probleme_sante_detail as string) || ''}
            onChange={e => update('probleme_sante_detail', e.target.value)}
          />
        )}
      </Section>

      {/* Recommandations */}
      <Section title="Recommandations utiles des parents">
        <textarea
          className="w-full border rounded-lg px-3 py-2 text-sm"
          rows={3}
          placeholder="Port de lunettes, appareils dentaires ou auditifs, comportement, difficultés de sommeil, besoins éducatifs particuliers, régimes alimentaires (sans porc / sans viande)..."
          value={(form.recommandations_parents as string) || ''}
          onChange={e => update('recommandations_parents', e.target.value)}
        />
      </Section>

      {/* Autorisation soins */}
      <Section title="Autorisation de soins">
        <div className="p-3 bg-blue-50 rounded-lg text-xs text-gray-600 mb-3">
          Je soussigné(e), responsable légal de l&apos;enfant mineur, déclare exacts les renseignements portés
          sur cette fiche. J&apos;autorise le responsable de l&apos;accueil à prendre toutes les mesures
          (traitement médical, hospitalisation, intervention chirurgicale) rendues nécessaires par
          l&apos;état de santé du mineur, suivant les prescriptions d&apos;un médecin.
        </div>
        <Input label="Je soussigné(e) *" value={form.autorisation_soins_soussigne} onChange={v => update('autorisation_soins_soussigne', v)} required />
        <div className="mt-2">
          <Checkbox
            label="J'atteste l'exactitude des renseignements et j'autorise les soins d'urgence"
            checked={!!form.autorisation_soins_accepte}
            onChange={v => update('autorisation_soins_accepte', v)}
          />
        </div>
      </Section>

      {/* Boutons */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium transition disabled:opacity-50"
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving || !form.autorisation_soins_accepte}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
        >
          Valider
        </button>
      </div>
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
  label, value, onChange, type = 'text', required, className = '',
}: {
  label: string; value: unknown; onChange: (v: string) => void;
  type?: string; required?: boolean; className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs text-gray-500 block mb-0.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
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
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      <div className="flex gap-3">
        <label className="flex items-center gap-1 text-sm cursor-pointer">
          <input type="radio" checked={value === 'oui'} onChange={() => onChange('oui')} /> Oui
        </label>
        <label className="flex items-center gap-1 text-sm cursor-pointer">
          <input type="radio" checked={value === 'non'} onChange={() => onChange('non')} /> Non
        </label>
      </div>
    </div>
  );
}

function ResponsableFields({ prefix, form, update }: {
  prefix: string;
  form: Record<string, unknown>;
  update: (key: string, value: unknown) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Input label="Nom *" value={form[`${prefix}_nom`]} onChange={v => update(`${prefix}_nom`, v)} required />
      <Input label="Prénom *" value={form[`${prefix}_prenom`]} onChange={v => update(`${prefix}_prenom`, v)} required />
      <Input label="Parenté" value={form[`${prefix}_parente`]} onChange={v => update(`${prefix}_parente`, v)} />
      <Input label="Profession *" value={form[`${prefix}_profession`]} onChange={v => update(`${prefix}_profession`, v)} required />
      <Input label="Adresse *" value={form[`${prefix}_adresse`]} onChange={v => update(`${prefix}_adresse`, v)} required className="sm:col-span-2" />
      <Input label="Email *" value={form[`${prefix}_email`]} onChange={v => update(`${prefix}_email`, v)} type="email" required />
      <Input label="Tél. domicile" value={form[`${prefix}_tel_domicile`]} onChange={v => update(`${prefix}_tel_domicile`, v)} type="tel" />
      <Input label="Tél. portable *" value={form[`${prefix}_tel_portable`]} onChange={v => update(`${prefix}_tel_portable`, v)} type="tel" required />
      <Input label="Tél. travail *" value={form[`${prefix}_tel_travail`]} onChange={v => update(`${prefix}_tel_travail`, v)} type="tel" required />
    </div>
  );
}
