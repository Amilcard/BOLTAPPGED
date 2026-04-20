'use client';

import { useState } from 'react';
import { SignaturePad } from './SignaturePad';
import { computeProgress, ProgressBar } from './progress-shared';

interface Props {
  data: Record<string, unknown>;
  saving: boolean;
  onSave: (data: Record<string, unknown>, completed?: boolean) => Promise<boolean>;
  jeunePrenom: string;
  jeuneNom: string;
}

/**
 * Formulaire complément bulletin d'inscription.
 * Champs NON déjà captés à l'inscription :
 * - Adresse permanente
 * - Adresse de départ (si différente)
 * - Adresse de retour (si différente)
 * - Contact urgence pendant le séjour
 * - Financement détaillé
 * - Envoi documents (adresse pour fiche liaison + convocation)
 */
export function BulletinComplementForm({ data, saving, onSave, jeunePrenom, jeuneNom }: Props) {
  const [form, setForm] = useState<Record<string, unknown>>({
    adresse_permanente: '',
    // #13 — Sous-champs adresse permanente (éclatement num/rue/CP/ville).
    // adresse_permanente (string concaténée) reste maintenu pour compat PDF.
    adresse_permanente_numero: '',
    adresse_permanente_rue: '',
    adresse_permanente_cp: '',
    adresse_permanente_ville: '',
    adresse_depart_nom: '',
    adresse_depart_adresse: '',
    adresse_depart_lien: '',
    adresse_depart_telephone: '',
    adresse_retour_nom: '',
    adresse_retour_adresse: '',
    adresse_retour_lien: '',
    adresse_retour_telephone: '',
    contact_urgence_nom: '',
    contact_urgence_adresse: '',
    contact_urgence_lien: '',
    contact_urgence_telephone: '',
    financement_ase: false,
    financement_etablissement: false,
    financement_famille: false,
    financement_autres: false,
    financement_montants: '',
    envoi_fiche_liaison: 'permanente',
    envoi_convocation: 'permanente',
    autorisation_accepte: false,
    autorisation_fait_a: '',
    // C#3 — Qualité du signataire (SES eIDAS). Enum back : responsable_legal | delegataire_ase | tuteur.
    signer_qualite: '',
    ...flattenObject(data),
  });

  const update = (key: string, value: unknown) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      // #13 — Recompose la string adresse_permanente à partir des sous-champs
      // pour rester compatible avec le rendu PDF existant (s(d.adresse_permanente)).
      if (key.startsWith('adresse_permanente_')) {
        next.adresse_permanente = composeAdressePermanente(next);
      }
      return next;
    });
  };

  const handleSave = async (completed = false) => {
    await onSave(form, completed);
  };

  // Progression — champs requis minimaux pour la complétude du bloc.
  // La liste reflète les contraintes métier + la checkbox d'autorisation
  // (seule condition actuelle du bouton "Valider").
  const progressFields = [
    'adresse_permanente',
    'contact_urgence_nom',
    'contact_urgence_telephone',
    'autorisation_fait_a',
    'autorisation_accepte',
    'signature_image_url',
  ];
  const progress = computeProgress(form, progressFields);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-6 bg-orange-500 rounded-full" />
        <h3 className="font-bold text-gray-800">
          Bulletin d&apos;inscription — Complément pour {jeunePrenom} {jeuneNom}
        </h3>
      </div>

      <ProgressBar label="Bulletin" filled={progress.filled} total={progress.total} color="orange" />

      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-800" role="note">
        Ce formulaire engage les responsabilités. Prenez le temps nécessaire,
        toutes vos saisies sont sauvegardées automatiquement. Vous pourrez revenir
        compléter ou corriger à tout moment avant l&apos;envoi final.
      </div>

      {/* Adresse permanente — #13 éclatée en 4 champs */}
      <Section title="Adresse permanente">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <Input
            label="Numéro"
            value={form.adresse_permanente_numero}
            onChange={v => update('adresse_permanente_numero', v)}
            className="sm:col-span-2"
          />
          <Input
            label="Rue *"
            value={form.adresse_permanente_rue}
            onChange={v => update('adresse_permanente_rue', v)}
            className="sm:col-span-10"
            required
          />
          <Input
            label="Code postal *"
            value={form.adresse_permanente_cp}
            onChange={v => update('adresse_permanente_cp', v.replace(/\D/g, '').slice(0, 5))}
            className="sm:col-span-3"
            required
          />
          <Input
            label="Ville *"
            value={form.adresse_permanente_ville}
            onChange={v => update('adresse_permanente_ville', v)}
            className="sm:col-span-9"
            required
          />
        </div>
        {!!form.adresse_permanente && !form.adresse_permanente_rue && !form.adresse_permanente_cp && !form.adresse_permanente_ville && (
          <p className="mt-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2">
            Adresse précédente : <strong>{form.adresse_permanente as string}</strong>.
            Recopiez-la dans les champs ci-dessus pour la mettre à jour.
          </p>
        )}
      </Section>

      {/* Adresse de départ */}
      <Section title="Adresse de départ (si différente de l'adresse permanente)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Nom" value={form.adresse_depart_nom} onChange={v => update('adresse_depart_nom', v)} />
          <Input label="Lien avec l'enfant" value={form.adresse_depart_lien} onChange={v => update('adresse_depart_lien', v)} />
          <Input label="Adresse" value={form.adresse_depart_adresse} onChange={v => update('adresse_depart_adresse', v)} className="sm:col-span-2" />
          <Input label="Téléphone" value={form.adresse_depart_telephone} onChange={v => update('adresse_depart_telephone', v)} type="tel" />
        </div>
      </Section>

      {/* Adresse de retour */}
      <Section title="Adresse de retour (si différente)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Nom" value={form.adresse_retour_nom} onChange={v => update('adresse_retour_nom', v)} />
          <Input label="Lien avec l'enfant" value={form.adresse_retour_lien} onChange={v => update('adresse_retour_lien', v)} />
          <Input label="Adresse" value={form.adresse_retour_adresse} onChange={v => update('adresse_retour_adresse', v)} className="sm:col-span-2" />
          <Input label="Téléphone" value={form.adresse_retour_telephone} onChange={v => update('adresse_retour_telephone', v)} type="tel" />
        </div>
      </Section>

      {/* Contact urgence */}
      <Section title="Personne à contacter en cas d'urgence lors du séjour">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Nom" value={form.contact_urgence_nom} onChange={v => update('contact_urgence_nom', v)} required />
          <Input label="Lien avec l'enfant" value={form.contact_urgence_lien} onChange={v => update('contact_urgence_lien', v)} />
          <Input label="Adresse" value={form.contact_urgence_adresse} onChange={v => update('contact_urgence_adresse', v)} className="sm:col-span-2" />
          <Input label="Téléphone" value={form.contact_urgence_telephone} onChange={v => update('contact_urgence_telephone', v)} type="tel" required />
        </div>
      </Section>

      {/* Envoi documents */}
      <Section title="Envoi des documents">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600 block mb-1">Fiche de liaison et trousseau</label>
            <select
              className="w-full border rounded-lg px-3 py-1.5 text-sm"
              value={(form.envoi_fiche_liaison as string) || 'permanente'}
              onChange={e => update('envoi_fiche_liaison', e.target.value)}
            >
              <option value="permanente">Adresse permanente</option>
              <option value="depart">Adresse de départ</option>
              <option value="retour">Adresse de retour</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Convocation de départ et retour</label>
            <select
              className="w-full border rounded-lg px-3 py-1.5 text-sm"
              value={(form.envoi_convocation as string) || 'permanente'}
              onChange={e => update('envoi_convocation', e.target.value)}
            >
              <option value="permanente">Adresse permanente</option>
              <option value="depart">Adresse de départ</option>
              <option value="retour">Adresse de retour</option>
            </select>
          </div>
        </div>
      </Section>

      {/* Financement */}
      <Section title="Modalités de financement">
        <div className="flex flex-wrap gap-4 mb-3">
          <Checkbox label="Prise en charge ASE" checked={!!form.financement_ase} onChange={v => update('financement_ase', v)} />
          <Checkbox label="Établissement" checked={!!form.financement_etablissement} onChange={v => update('financement_etablissement', v)} />
          <Checkbox label="Famille" checked={!!form.financement_famille} onChange={v => update('financement_famille', v)} />
          <Checkbox label="Autres (bons CAF, allocations...)" checked={!!form.financement_autres} onChange={v => update('financement_autres', v)} />
        </div>
        <Input label="Montants / précisions" value={form.financement_montants} onChange={v => update('financement_montants', v)} />
      </Section>

      {/* Autorisation */}
      <Section title="Autorisation du responsable légal">
        <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600 mb-3">
          Je soussigné(e), responsable légal de l&apos;enfant {jeunePrenom} {jeuneNom}, déclare exacts
          les renseignements ci-dessus et avoir pris connaissance et accepté les conditions générales des séjours.
          J&apos;autorise l&apos;enfant à participer au centre de vacances et à toutes les activités proposées dans le cadre du séjour.
        </div>
        <div className="mb-3 max-w-xs">
          <Input label="Fait à" value={form.autorisation_fait_a} onChange={v => update('autorisation_fait_a', v)} />
        </div>
        <SignerQualiteSelect
          value={(form.signer_qualite as string) || ''}
          onChange={v => update('signer_qualite', v)}
        />
        <Checkbox
          label="J'atteste l'exactitude des renseignements et j'accepte les conditions générales"
          checked={!!form.autorisation_accepte}
          onChange={v => update('autorisation_accepte', v)}
        />
        <div className="mt-3">
          <SignaturePad
            label="Signature du responsable légal"
            value={form.signature_image_url as string | null}
            onChange={dataUrl => update('signature_image_url', dataUrl)}
            disabled={saving}
          />
        </div>
      </Section>

      {/* Boutons */}
      {(() => {
        const urgenceTelOk = !!(form.contact_urgence_telephone as string)?.trim();
        const signatureOk = !!(form.signature_image_url as string)?.trim();
        const qualiteOk = !!(form.signer_qualite as string)?.trim();
        const canValidate =
          !!form.autorisation_accepte && urgenceTelOk && signatureOk && qualiteOk;
        return (
          <>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => { void handleSave(true); }}
                disabled={saving || !canValidate}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Valider le bloc'}
              </button>
            </div>
            {!form.autorisation_accepte && (
              <p className="text-xs text-orange-600 mt-1">Cochez la case d&apos;autorisation ci-dessus pour pouvoir valider ce bloc.</p>
            )}
            {form.autorisation_accepte && !urgenceTelOk && (
              <p className="text-xs text-orange-600 mt-1">Renseignez le téléphone du contact d&apos;urgence (champ obligatoire).</p>
            )}
            {form.autorisation_accepte && urgenceTelOk && !qualiteOk && (
              <p className="text-xs text-orange-600 mt-1">Indiquez la qualité du signataire.</p>
            )}
            {form.autorisation_accepte && urgenceTelOk && qualiteOk && !signatureOk && (
              <p className="text-xs text-orange-600 mt-1">Signez dans le cadre pour valider le bloc.</p>
            )}
          </>
        );
      })()}
    </div>
  );
}

// === Sous-composants réutilisables ===

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
  label: string;
  value: unknown;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs text-gray-500 block mb-0.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        className="w-full border rounded-lg px-3 py-1.5 text-sm"
        value={(value as string) || ''}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

/**
 * C#3 — Sélecteur "qualité du signataire" pour la signature électronique simple (SES eIDAS).
 * Valeur envoyée au back : enum (responsable_legal | delegataire_ase | tuteur).
 * Obligatoire dans les 3 blocs Bulletin / Sanitaire / Liaison.
 */
function SignerQualiteSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-3">
      <label className="text-xs text-gray-600 block mb-1">Qualité du signataire *</label>
      <select
        className="w-full sm:max-w-sm border rounded-lg px-3 py-1.5 text-sm"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">— Sélectionnez —</option>
        <option value="responsable_legal">Responsable légal (parent de l&apos;enfant)</option>
        <option value="delegataire_ase">Délégataire de l&apos;autorité parentale (ASE)</option>
        <option value="tuteur">Tuteur / tutrice</option>
      </select>
    </div>
  );
}

function Checkbox({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-gray-300"
      />
      {label}
    </label>
  );
}

// #13 — Recompose "12 rue Flobert, 42000 Saint-Étienne" depuis les sous-champs.
// Tolère les champs vides : produit "rue, cp ville" minimum. Renvoie '' si tout vide.
function composeAdressePermanente(form: Record<string, unknown>): string {
  const num = ((form.adresse_permanente_numero as string) || '').trim();
  const rue = ((form.adresse_permanente_rue as string) || '').trim();
  const cp = ((form.adresse_permanente_cp as string) || '').trim();
  const ville = ((form.adresse_permanente_ville as string) || '').trim();
  const left = [num, rue].filter(Boolean).join(' ');
  const right = [cp, ville].filter(Boolean).join(' ');
  if (!left && !right) return '';
  if (!left) return right;
  if (!right) return left;
  return `${left}, ${right}`;
}

// Utilitaire : aplatir un objet nested en clés plates
function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}_${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

