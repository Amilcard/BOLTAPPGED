# Flux signature complet — PDF hybride + docs optionnels conditionnels

> **For agentic workers:** Use skill `executing-plans` to implement this plan task-by-task.

**Goal:** Couvrir tous les cas de signature : en ligne (responsable légal présent) ou physique (parent absent → téléchargement → signature → réintégration), et bloquer l'envoi si des documents optionnels requis par le séjour manquent.

**Architecture:**
- Chantier A : mode de signature par bloc (toggle UI) + upload PDF signé → auto-complete du bloc
- Chantier B : validation conditionnelle des docs optionnels requis par le séjour (pass nautique, certificat médical, etc.) dans GET dossier + submit

**Tech Stack:** Next.js 14 App Router, Supabase, TypeScript, Tailwind CSS

---

## Chantier A — Flux signature hybride (en ligne / physique)

### Task A1 : Upload route — accepter les PDF signés physiquement

**Files:**
- Modify: `app/api/dossier-enfant/[inscriptionId]/upload/route.ts:4`

- [ ] **Step 1 : Ajouter les types signés et la logique d'auto-complétion**

Remplacer la ligne 4 et ajouter la map dans `upload/route.ts` :

```typescript
const ALLOWED_TYPES = [
  'vaccins', 'ordonnance', 'pass_nautique', 'certificat_plongee',
  'certificat_medical', 'attestation_assurance', 'signature_parentale',
  'bulletin_signe', 'sanitaire_signe', 'liaison_signe',
  'autre',
] as const;

const SIGNED_TO_COMPLETED: Record<string, string> = {
  bulletin_signe: 'bulletin_completed',
  sanitaire_signe: 'sanitaire_completed',
  liaison_signe: 'liaison_completed',
};
```

- [ ] **Step 2 : Après la mise à jour de `documents_joints` (ligne ~104), ajouter l'auto-complétion**

Insérer ce bloc juste après `if (updateError) { ... }` et avant la génération de `publicUrl` :

```typescript
// Si PDF signé physiquement → marquer le bloc comme complété
if (SIGNED_TO_COMPLETED[docType]) {
  await supabase
    .from('gd_dossier_enfant')
    .update({ [SIGNED_TO_COMPLETED[docType]]: true })
    .eq('inscription_id', inscriptionId);
}
```

Faire la même chose dans la branche `else` (insert nouveau dossier, lignes ~111-123) — dans ce cas le bloc completed ne peut pas être true immédiatement car le dossier vient d'être créé avec juste le document. OK de ne pas auto-compléter dans ce cas car `gd_dossier_enfant` vient d'être créé et on peut faire le update juste après :

```typescript
// Branche ELSE (dossier inexistant) : insert puis auto-compléter si signé
const { data: newDossier } = await supabase
  .from('gd_dossier_enfant')
  .insert({ inscription_id: inscriptionId, documents_joints: [newDoc] })
  .select('id')
  .single();

if (insertError) {
  await supabase.storage.from('dossier-documents').remove([storagePath]);
  throw insertError;
}

if (SIGNED_TO_COMPLETED[docType] && newDossier) {
  await supabase
    .from('gd_dossier_enfant')
    .update({ [SIGNED_TO_COMPLETED[docType]]: true })
    .eq('id', newDossier.id);
}
```

> ⚠️ La branche `else` actuelle (lignes 111-123) utilise `insertError` mais ne select pas l'id. Il faut modifier l'insert pour récupérer l'id. Voir le code actuel exact avant d'éditer.

- [ ] **Step 3 : Vérifier TypeScript**
```bash
cd /Users/laidhamoudi/groupe-et-decouverte/dev-ged && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 erreurs liées aux fichiers modifiés.

- [ ] **Step 4 : Commit**
```bash
git add app/api/dossier-enfant/\[inscriptionId\]/upload/route.ts
git commit -m "feat(upload): accept bulletin/sanitaire/liaison_signe types and auto-complete bloc on upload"
```

---

### Task A2 : Interface — sélecteur de mode de signature par bloc

**Files:**
- Modify: `components/dossier-enfant/DossierEnfantPanel.tsx`

Le principe : dans chaque onglet (bulletin, sanitaire, liaison), afficher en haut un sélecteur à 2 options :
- **"Responsable légal présent"** → formulaire + signature canvas (comportement actuel)
- **"Parent / responsable absent"** → télécharger le PDF pré-rempli → faire signer → uploader ici

Ce sélecteur est en state local React, pas en base. Il se réinitialise à chaque ouverture du panel (OK — c'est un choix de workflow, pas une donnée persistée).

- [ ] **Step 1 : Ajouter le state et le composant de sélection dans DossierEnfantPanel**

En haut du composant `DossierEnfantPanel`, après les states existants, ajouter :

```typescript
// Mode signature par onglet (local, non persisté)
const [signatureMode, setSignatureMode] = useState<Record<string, 'online' | 'offline'>>({
  bulletin: 'online',
  sanitaire: 'online',
  liaison: 'online',
});
```

- [ ] **Step 2 : Créer le composant SignatureModeSelector dans le même fichier**

Ajouter juste avant la définition de `DossierEnfantPanel` (après `PdfDownloadButton`) :

```typescript
function SignatureModeSelector({
  mode,
  onChange,
  alreadyCompleted,
}: {
  mode: 'online' | 'offline';
  onChange: (m: 'online' | 'offline') => void;
  alreadyCompleted: boolean;
}) {
  if (alreadyCompleted) return null;
  return (
    <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-xl">
      <p className="text-xs font-medium text-gray-600 mb-2">Qui va signer ce document ?</p>
      <div className="flex gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`mode-${Math.random()}`}
            checked={mode === 'online'}
            onChange={() => onChange('online')}
            className="accent-orange-500"
          />
          <span className="text-sm text-gray-700">Responsable légal présent — signature en ligne</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`mode-${Math.random()}`}
            checked={mode === 'offline'}
            onChange={() => onChange('offline')}
            className="accent-orange-500"
          />
          <span className="text-sm text-gray-700">Parent absent — imprimer et faire signer</span>
        </label>
      </div>
    </div>
  );
}
```

> Note : `Math.random()` pour le `name` est un anti-pattern — utiliser plutôt `useId()` de React ou un prop `id`. Voir ci-dessous.

Version correcte avec `useId` (React 18+) :

> ⚠️ **Règle de sécurité administrative :** même quand `alreadyCompleted = true`, le sélecteur ne disparaît pas — il affiche un lien "Remplacer" pour couvrir les cas de changement de responsable légal (ordonnance de placement, substitution ASE, tutelle modifiée en urgence). La suppression totale du sélecteur est interdite.

```typescript
function SignatureModeSelector({
  selectorId,
  mode,
  onChange,
  alreadyCompleted,
}: {
  selectorId: string;
  mode: 'online' | 'offline';
  onChange: (m: 'online' | 'offline') => void;
  alreadyCompleted: boolean;
}) {
  // Si déjà complété : ne pas masquer — afficher un lien discret "Remplacer"
  // (changement de responsable légal possible à tout moment : placement, tutelle, ASE)
  if (alreadyCompleted) {
    return (
      <div className="mb-4 p-2 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
        <span className="text-xs text-green-700">Document validé</span>
        <button
          onClick={() => onChange('offline')}
          className="text-xs text-gray-400 underline hover:text-gray-600"
        >
          Remplacer (situation administrative modifiée)
        </button>
      </div>
    );
  }
  return (
    <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-xl">
      <p className="text-xs font-medium text-gray-600 mb-2">Qui va signer ce document ?</p>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={selectorId}
            checked={mode === 'online'}
            onChange={() => onChange('online')}
            className="accent-orange-500"
          />
          <span className="text-sm text-gray-700">Responsable légal présent — signature en ligne</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={selectorId}
            checked={mode === 'offline'}
            onChange={() => onChange('offline')}
            className="accent-orange-500"
          />
          <span className="text-sm text-gray-700">Parent / responsable absent — imprimer et faire signer</span>
        </label>
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : Créer le composant OfflineSignatureZone dans le même fichier**

Ce composant s'affiche quand mode = 'offline'. Il contient :
1. Bouton télécharger le PDF (pré-rempli avec les données actuelles)
2. Zone upload pour réintégrer le PDF signé

```typescript
function OfflineSignatureZone({
  inscriptionId,
  token,
  docType,
  docLabel,
  signedType,
  onUploadSuccess,
}: {
  inscriptionId: string;
  token: string;
  docType: string;
  docLabel: string;
  signedType: string;
  onUploadSuccess: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploaded, setUploaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setUploadError('Sélectionnez un fichier PDF.'); return; }
    if (file.size > 5 * 1024 * 1024) { setUploadError('Fichier trop volumineux (max 5 Mo).'); return; }
    setUploading(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('token', token);
      fd.append('type', signedType);
      fd.append('file', file);
      const res = await fetch(`/api/dossier-enfant/${inscriptionId}/upload`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur upload');
      setUploaded(true);
      onUploadSuccess();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Erreur upload');
    } finally {
      setUploading(false);
    }
  };

  if (uploaded) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 text-center">
        Document signé intégré au dossier.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <p className="text-sm font-medium text-blue-800 mb-1">Étape 1 — Télécharger le document pré-rempli</p>
        <p className="text-xs text-blue-600 mb-3">
          Le document sera généré avec les données déjà saisies dans le dossier. Imprimez-le, faites-le signer par le parent ou responsable légal, puis uploadez-le à l&apos;étape 2.
        </p>
        <PdfDownloadButton
          inscriptionId={inscriptionId}
          token={token}
          docType={docType}
          label={`Télécharger ${docLabel}`}
        />
      </div>
      <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
        <p className="text-sm font-medium text-orange-800 mb-1">Étape 2 — Uploader le document signé</p>
        <p className="text-xs text-orange-600 mb-3">
          Une fois le document signé récupéré, uploadez le PDF ici. Il sera automatiquement intégré au dossier.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-100 file:text-orange-700 hover:file:bg-orange-200"
          />
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50 flex items-center gap-2"
          >
            {uploading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Envoi...
              </>
            ) : 'Intégrer au dossier'}
          </button>
        </div>
        {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4 : Modifier le rendu des onglets bulletin / sanitaire / liaison**

Remplacer les blocs `{activeTab === 'bulletin' && (...)}`, `{activeTab === 'sanitaire' && (...)}`, `{activeTab === 'liaison' && (...)}` dans DossierEnfantPanel :

**Avant (exemple bulletin) :**
```typescript
{activeTab === 'bulletin' && (
  <BulletinComplementForm
    data={(dossier?.bulletin_complement || {}) as Record<string, unknown>}
    saving={saving}
    onSave={(data, completed) => saveBloc('bulletin_complement', data, completed)}
    jeunePrenom={inscription.jeunePrenom}
    jeuneNom={inscription.jeuneNom}
  />
)}
```

**Après (exemple bulletin) :**
```typescript
{activeTab === 'bulletin' && (
  <>
    <SignatureModeSelector
      selectorId="sig-bulletin"
      mode={signatureMode.bulletin}
      onChange={m => setSignatureMode(prev => ({ ...prev, bulletin: m }))}
      alreadyCompleted={!!dossier?.bulletin_completed}
    />
    {signatureMode.bulletin === 'offline' ? (
      <OfflineSignatureZone
        inscriptionId={inscription.id}
        token={token}
        docType="bulletin"
        docLabel="Bulletin d'inscription"
        signedType="bulletin_signe"
        onUploadSuccess={reload}
      />
    ) : (
      <BulletinComplementForm
        data={(dossier?.bulletin_complement || {}) as Record<string, unknown>}
        saving={saving}
        onSave={(data, completed) => saveBloc('bulletin_complement', data, completed)}
        jeunePrenom={inscription.jeunePrenom}
        jeuneNom={inscription.jeuneNom}
      />
    )}
  </>
)}
```

**Répéter pour sanitaire :**
```typescript
{activeTab === 'sanitaire' && (
  <>
    <SignatureModeSelector
      selectorId="sig-sanitaire"
      mode={signatureMode.sanitaire}
      onChange={m => setSignatureMode(prev => ({ ...prev, sanitaire: m }))}
      alreadyCompleted={!!dossier?.sanitaire_completed}
    />
    {signatureMode.sanitaire === 'offline' ? (
      <OfflineSignatureZone
        inscriptionId={inscription.id}
        token={token}
        docType="sanitaire"
        docLabel="Fiche sanitaire"
        signedType="sanitaire_signe"
        onUploadSuccess={reload}
      />
    ) : (
      <FicheSanitaireForm
        data={(dossier?.fiche_sanitaire || {}) as Record<string, unknown>}
        saving={saving}
        onSave={(data, completed) => saveBloc('fiche_sanitaire', data, completed)}
        jeunePrenom={inscription.jeunePrenom}
        jeuneNom={inscription.jeuneNom}
        jeuneDateNaissance={inscription.jeuneDateNaissance ?? ''}
      />
    )}
  </>
)}
```

**Répéter pour liaison :**
```typescript
{activeTab === 'liaison' && (
  <>
    <SignatureModeSelector
      selectorId="sig-liaison"
      mode={signatureMode.liaison}
      onChange={m => setSignatureMode(prev => ({ ...prev, liaison: m }))}
      alreadyCompleted={!!dossier?.liaison_completed}
    />
    {signatureMode.liaison === 'offline' ? (
      <OfflineSignatureZone
        inscriptionId={inscription.id}
        token={token}
        docType="liaison"
        docLabel="Fiche de liaison"
        signedType="liaison_signe"
        onUploadSuccess={reload}
      />
    ) : (
      <FicheLiaisonJeuneForm
        data={(dossier?.fiche_liaison_jeune || {}) as Record<string, unknown>}
        saving={saving}
        onSave={(data, completed) => saveBloc('fiche_liaison_jeune', data, completed)}
        jeunePrenom={inscription.jeunePrenom}
        jeuneNom={inscription.jeuneNom}
        sejourNom={inscription.sejourNom}
        sessionDate={inscription.sessionDate}
      />
    )}
  </>
)}
```

- [ ] **Step 5 : Mettre à jour les boutons de téléchargement — toujours visibles**

Remplacer le bloc "Boutons téléchargement PDF" (lignes ~340-375 de DossierEnfantPanel) pour afficher les boutons même si le bloc n'est pas encore complété :

```typescript
{dossier?.exists && (
  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
    <p className="text-xs text-gray-500 mb-2">Télécharger les documents (pré-remplis avec les données saisies) :</p>
    <div className="flex flex-wrap gap-2">
      <PdfDownloadButton
        inscriptionId={inscription.id}
        token={token}
        docType="bulletin"
        label={dossier.bulletin_completed ? "Bulletin d'inscription" : "Bulletin (à faire signer)"}
      />
      <PdfDownloadButton
        inscriptionId={inscription.id}
        token={token}
        docType="sanitaire"
        label={dossier.sanitaire_completed ? "Fiche sanitaire" : "Fiche sanitaire (à faire signer)"}
      />
      <PdfDownloadButton
        inscriptionId={inscription.id}
        token={token}
        docType="liaison"
        label={dossier.liaison_completed ? "Fiche de liaison" : "Fiche de liaison (à faire signer)"}
      />
    </div>
  </div>
)}
```

- [ ] **Step 6 : Vérifier TypeScript**
```bash
cd /Users/laidhamoudi/groupe-et-decouverte/dev-ged && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 7 : Commit**
```bash
git add components/dossier-enfant/DossierEnfantPanel.tsx
git commit -m "feat(dossier): add signature mode selector (online/offline) and offline PDF upload per bloc"
```

---

## Chantier B — Documents optionnels conditionnels

### Task B1 : GET dossier — exposer les docs requis manquants

**Files:**
- Modify: `app/api/dossier-enfant/[inscriptionId]/route.ts:57-106`
- Modify: `components/dossier-enfant/useDossierEnfant.ts` (interface DossierEnfant)

**Mapping requis ↔ documents_joints :**

```typescript
// Types de documents_requis (gd_stays) qui correspondent à des pièces jointes
const REQUIS_TO_JOINT: Record<string, string> = {
  pass_nautique: 'pass_nautique',
  certificat_medical: 'certificat_medical',
  attestation_assurance: 'attestation_assurance',
  autorisation_parentale: 'signature_parentale',
  certificat_plongee: 'certificat_plongee',
};
// 'fiche_sanitaire', 'renseignements', 'fiche_informations', 'bulletin' → gérés par *_completed
```

- [ ] **Step 1 : Extraire la logique de fetch sejour dans route.ts (GET)**

La route GET charge déjà `documents_requis` pour calculer `renseignements_required`. Étendre cette logique pour aussi calculer `docs_optionnels_requis` et `docs_optionnels_manquants`.

Dans `route.ts` GET, après la récupération du dossier (ligne ~46), ajouter une fonction helper en bas du fichier :

```typescript
const REQUIS_TO_JOINT: Record<string, string> = {
  pass_nautique: 'pass_nautique',
  certificat_medical: 'certificat_medical',
  attestation_assurance: 'attestation_assurance',
  autorisation_parentale: 'signature_parentale',
  certificat_plongee: 'certificat_plongee',
};

async function getDocsOptionnelsManquants(
  supabase: ReturnType<typeof getSupabase>,
  inscriptionId: string,
  documentsJoints: Array<{ type: string }>
): Promise<{ requis: string[]; manquants: string[] }> {
  const { data: inscRaw } = await supabase
    .from('gd_inscriptions')
    .select('sejour_slug')
    .eq('id', inscriptionId)
    .single();
  if (!inscRaw) return { requis: [], manquants: [] };

  const { data: stayRaw } = await supabase
    .from('gd_stays')
    .select('documents_requis')
    .eq('slug', (inscRaw as { sejour_slug?: string }).sejour_slug)
    .maybeSingle();
  if (!stayRaw) return { requis: [], manquants: [] };

  const docsRequis = Array.isArray((stayRaw as { documents_requis?: unknown[] }).documents_requis)
    ? ((stayRaw as { documents_requis: unknown[] }).documents_requis as string[])
    : [];

  const uploadedTypes = new Set(documentsJoints.map(d => d.type));
  const requis: string[] = [];
  const manquants: string[] = [];

  for (const requis_key of docsRequis) {
    const jointType = REQUIS_TO_JOINT[requis_key];
    if (!jointType) continue; // géré par *_completed, pas par documents_joints
    requis.push(requis_key);
    if (!uploadedTypes.has(jointType)) {
      manquants.push(requis_key);
    }
  }

  return { requis, manquants };
}
```

- [ ] **Step 2 : Utiliser la fonction dans la branche dossier existant (GET)**

Dans la branche `return NextResponse.json({ exists: true, ...dossier })` (ligne ~96), remplacer par :

```typescript
const docsJoints = Array.isArray(dossier.documents_joints)
  ? (dossier.documents_joints as Array<{ type: string }>)
  : [];
const { requis: docs_optionnels_requis, manquants: docs_optionnels_manquants } =
  await getDocsOptionnelsManquants(supabase, inscriptionId, docsJoints);

return NextResponse.json({
  exists: true,
  ...dossier,
  docs_optionnels_requis,
  docs_optionnels_manquants,
});
```

- [ ] **Step 3 : Idem dans la branche dossier inexistant (squelette vide, ligne ~80-93)**

```typescript
return NextResponse.json({
  exists: false,
  inscriptionId,
  bulletin_complement: {},
  fiche_sanitaire: {},
  fiche_liaison_jeune: {},
  fiche_renseignements: null,
  documents_joints: [],
  bulletin_completed: false,
  sanitaire_completed: false,
  liaison_completed: false,
  renseignements_completed: false,
  renseignements_required: renseignementsRequired,
  docs_optionnels_requis: [],
  docs_optionnels_manquants: [],
});
```

- [ ] **Step 4 : Mettre à jour l'interface DossierEnfant dans useDossierEnfant.ts**

Ajouter deux champs à l'interface :

```typescript
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
  docs_optionnels_requis?: string[];     // ← nouveau
  docs_optionnels_manquants?: string[];  // ← nouveau
}
```

- [ ] **Step 5 : Vérifier TypeScript**
```bash
cd /Users/laidhamoudi/groupe-et-decouverte/dev-ged && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6 : Commit**
```bash
git add app/api/dossier-enfant/\[inscriptionId\]/route.ts components/dossier-enfant/useDossierEnfant.ts
git commit -m "feat(dossier): expose docs_optionnels_requis and docs_optionnels_manquants in GET response"
```

---

### Task B2 : Submit route — bloquer si docs optionnels manquants

**Files:**
- Modify: `app/api/dossier-enfant/[inscriptionId]/submit/route.ts:80-88`

- [ ] **Step 1 : Ajouter la même map REQUIS_TO_JOINT en haut du fichier submit**

Après les imports, ajouter :

```typescript
const REQUIS_TO_JOINT: Record<string, string> = {
  pass_nautique: 'pass_nautique',
  certificat_medical: 'certificat_medical',
  attestation_assurance: 'attestation_assurance',
  autorisation_parentale: 'signature_parentale',
  certificat_plongee: 'certificat_plongee',
};
```

- [ ] **Step 2 : Ajouter la vérification après le check de complétude (après ligne 88)**

Après le bloc `if (!dossier.bulletin_completed || ...)` (ligne 82-88), ajouter :

```typescript
// 5. Vérifier documents optionnels requis par le séjour
const { data: inscForStay } = await supabase
  .from('gd_inscriptions')
  .select('sejour_slug')
  .eq('id', inscriptionId)
  .single();

if (inscForStay) {
  const { data: stayForDocs } = await supabase
    .from('gd_stays')
    .select('documents_requis')
    .eq('slug', (inscForStay as { sejour_slug?: string }).sejour_slug)
    .maybeSingle();

  if (stayForDocs) {
    const docsRequis = Array.isArray((stayForDocs as { documents_requis?: unknown[] }).documents_requis)
      ? ((stayForDocs as { documents_requis: unknown[] }).documents_requis as string[])
      : [];
    const uploadedTypes = new Set(
      (dossier.documents_joints as Array<{ type: string }>).map(d => d.type)
    );
    const manquants = docsRequis
      .filter(k => REQUIS_TO_JOINT[k])
      .filter(k => !uploadedTypes.has(REQUIS_TO_JOINT[k]));

    if (manquants.length > 0) {
      return NextResponse.json(
        { error: 'Documents requis manquants.', docs_manquants: manquants },
        { status: 400 }
      );
    }
  }
}
```

> ⚠️ Renuméroter les commentaires des étapes suivantes dans le code (était 5. Marquer comme envoyé → devient 6.).

- [ ] **Step 3 : Vérifier TypeScript**
```bash
cd /Users/laidhamoudi/groupe-et-decouverte/dev-ged && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4 : Commit**
```bash
git add app/api/dossier-enfant/\[inscriptionId\]/submit/route.ts
git commit -m "feat(submit): block submission if sejour-required optional docs are missing"
```

---

### Task B3 : Frontend — afficher les docs manquants et bloquer l'envoi

**Files:**
- Modify: `components/dossier-enfant/DossierEnfantPanel.tsx`
- Modify: `components/dossier-enfant/DocumentsJointsUpload.tsx`

**Labels lisibles pour chaque type :**
```typescript
const DOC_LABELS: Record<string, string> = {
  pass_nautique: 'Pass nautique / aisance aquatique',
  certificat_medical: 'Certificat médical (sport à risque)',
  attestation_assurance: 'Attestation d\'assurance',
  autorisation_parentale: 'Autorisation parentale',
  certificat_plongee: 'Certificat de plongée',
};
```

- [ ] **Step 1 : Mettre à jour isComplete dans DossierEnfantPanel**

Remplacer :
```typescript
const isComplete = completedCount === totalDocs;
```
Par :
```typescript
const isComplete = completedCount === totalDocs &&
  (dossier?.docs_optionnels_manquants?.length ?? 0) === 0;
```

- [ ] **Step 2 : Ajouter les docs optionnels manquants à l'alerte**

Remplacer la section `// Documents manquants pour l'alerte` :

```typescript
const DOC_LABELS: Record<string, string> = {
  pass_nautique: 'Pass nautique / aisance aquatique',
  certificat_medical: 'Certificat médical (sport à risque)',
  attestation_assurance: "Attestation d'assurance",
  autorisation_parentale: 'Autorisation parentale',
  certificat_plongee: 'Certificat de plongée',
};

const missing: string[] = [];
if (dossier && !dossier.bulletin_completed) missing.push('Bulletin');
if (dossier && !dossier.sanitaire_completed) missing.push('Fiche sanitaire');
if (dossier && !dossier.liaison_completed) missing.push('Fiche de liaison');
if (dossier && !dossier.renseignements_completed) missing.push('Fiche de renseignements');
// Docs optionnels requis par le séjour
(dossier?.docs_optionnels_manquants ?? []).forEach(k => {
  missing.push(DOC_LABELS[k] ?? k);
});
```

- [ ] **Step 3 : Passer requiredTypes à DocumentsJointsUpload**

Dans l'onglet PJ, remplacer :
```typescript
<DocumentsJointsUpload
  inscriptionId={inscription.id}
  token={token}
  onUploadSuccess={reload}
/>
```
Par :
```typescript
<DocumentsJointsUpload
  inscriptionId={inscription.id}
  token={token}
  onUploadSuccess={reload}
  requiredTypes={dossier?.docs_optionnels_requis ?? []}
/>
```

- [ ] **Step 4 : Mettre à jour DocumentsJointsUpload pour afficher les docs requis**

Ajouter le prop `requiredTypes` à l'interface et mettre en évidence les types requis :

```typescript
interface Props {
  inscriptionId: string;
  token: string;
  onUploadSuccess?: () => void;
  requiredTypes?: string[];   // ← nouveau
}
```

Dans la liste des `DOC_TYPES`, à l'affichage dans la section `/* Indicateur de completude */`, remplacer par :

```typescript
{/* Docs requis par le séjour */}
{(requiredTypes?.length ?? 0) > 0 && (
  <div className="text-xs pt-2 border-t">
    <p className="font-medium text-gray-600 mb-1">Documents requis pour ce séjour :</p>
    {(requiredTypes ?? []).map(reqType => {
      // Trouver le jointType correspondant
      const REQUIS_TO_JOINT: Record<string, string> = {
        pass_nautique: 'pass_nautique',
        certificat_medical: 'certificat_medical',
        attestation_assurance: 'attestation_assurance',
        autorisation_parentale: 'signature_parentale',
        certificat_plongee: 'certificat_plongee',
      };
      const jointType = REQUIS_TO_JOINT[reqType] ?? reqType;
      const uploaded = documents.some(d => d.type === jointType);
      const label = DOC_TYPES.find(d => d.value === jointType)?.label ?? reqType;
      return (
        <span
          key={reqType}
          className={`inline-flex items-center gap-1 mr-3 ${uploaded ? 'text-green-600' : 'text-red-500 font-medium'}`}
        >
          {uploaded ? '✓' : '!'} {label} {!uploaded && <span className="text-xs">(manquant)</span>}
        </span>
      );
    })}
  </div>
)}
```

- [ ] **Step 5 : Vérifier TypeScript**
```bash
cd /Users/laidhamoudi/groupe-et-decouverte/dev-ged && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6 : Commit**
```bash
git add components/dossier-enfant/DossierEnfantPanel.tsx components/dossier-enfant/DocumentsJointsUpload.tsx
git commit -m "feat(dossier): block submit + show alert for missing sejour-required optional docs"
```

---

## Récapitulatif des fichiers modifiés

| Fichier | Chantier | Raison |
|---|---|---|
| `app/api/dossier-enfant/[inscriptionId]/upload/route.ts` | A | Types signés + auto-complete bloc |
| `app/api/dossier-enfant/[inscriptionId]/route.ts` | B | Exposer docs_optionnels_manquants |
| `app/api/dossier-enfant/[inscriptionId]/submit/route.ts` | B | Bloquer si docs manquants |
| `components/dossier-enfant/useDossierEnfant.ts` | B | Interface DossierEnfant étendue |
| `components/dossier-enfant/DossierEnfantPanel.tsx` | A+B | Sélecteur mode, OfflineZone, alertes |
| `components/dossier-enfant/DocumentsJointsUpload.tsx` | B | Highlight docs requis par séjour |

## Vérification finale

- [ ] `npx tsc --noEmit` → 0 erreurs
- [ ] `npm run build` → build réussi
- [ ] Test manuel flux A (online) : remplir bulletin → signer → valider → badge B vert
- [ ] Test manuel flux A (offline) : choisir "parent absent" → télécharger → uploader PDF → badge B vert automatiquement
- [ ] Test manuel flux B : séjour avec pass_nautique requis → tenter envoi sans PJ → erreur 400 → uploader pass_nautique → envoi OK
