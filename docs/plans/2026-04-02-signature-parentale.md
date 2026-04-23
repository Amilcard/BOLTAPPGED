# Signature Parentale en Ligne — Implementation Plan

> **For agentic workers:** Use `executing-plans` or `subagent-driven-development` to implement task-by-task.

**Goal:** Permettre au responsable légal de signer directement dans l'app (souris / trackpad / tactile) sur les 3 formulaires de complétude, avec injection de l'image dans le PDF final.

**Architecture:**
- Composant `SignaturePad` canvas natif (zéro dépendance npm) — pointer events universels
- Upload PNG → Supabase Storage bucket `dossier-documents` via route upload existante
- Stockage URL dans JSONB existants (`fiche_sanitaire.signature_image_url`, etc.)
- Injection dans PDF via `pdf-lib` `embedPng` + `drawImage`

**Tech Stack:** Next.js 14, pdf-lib, Supabase Storage, canvas API natif, Tailwind CSS

**Périmètre signatures :**
- ✅ Canvas dans app : responsable légal (Fiche Sanitaire, Bulletin, Fiche Liaison)
- ✅ Upload document : médecin, maître-nageur, pass nautique, plongée → DÉJÀ géré

---

## Fichiers

| Action | Fichier |
|---|---|
| CRÉER | `components/dossier-enfant/SignaturePad.tsx` |
| MODIFIER | `app/api/dossier-enfant/[inscriptionId]/upload/route.ts` |
| MODIFIER | `components/dossier-enfant/FicheSanitaireForm.tsx` |
| MODIFIER | `components/dossier-enfant/BulletinComplementForm.tsx` |
| MODIFIER | `components/dossier-enfant/FicheLiaisonJeuneForm.tsx` |
| MODIFIER | `app/api/dossier-enfant/[inscriptionId]/pdf/route.ts` |

---

## Task 1 : Composant SignaturePad

**Files:**
- Create: `components/dossier-enfant/SignaturePad.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
'use client';
import { useRef, useEffect, useCallback } from 'react';

interface SignaturePadProps {
  value?: string | null;          // URL ou base64 existante
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  label?: string;
}

export function SignaturePad({ value, onChange, disabled = false, label }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  // Initialiser canvas — fond blanc
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Résolution adaptée au devicePixelRatio
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Charger signature existante si présente
    if (value && value.startsWith('data:')) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
    }
  }, []);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    drawing.current = true;
    canvasRef.current!.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [disabled]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [disabled]);

  const onPointerUp = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    const dataUrl = canvasRef.current!.toDataURL('image/png');
    onChange(dataUrl);
  }, [onChange]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    onChange(null);
  }, [onChange]);

  return (
    <div className="space-y-1">
      {label && <p className="text-xs font-medium text-gray-700">{label}</p>}
      <div className="relative border border-gray-300 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full h-24 touch-none cursor-crosshair"
          style={{ display: 'block' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {!disabled && (
          <button
            type="button"
            onClick={clear}
            className="absolute top-1 right-1 text-xs text-gray-400 hover:text-gray-600 bg-white/80 px-1 rounded"
          >
            Effacer
          </button>
        )}
      </div>
      {!value && !disabled && (
        <p className="text-xs text-gray-400">Signez dans le cadre ci-dessus</p>
      )}
      {value && (
        <p className="text-xs text-green-600">✓ Signature enregistrée</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier le rendu**

Lancer `npm run dev` et ouvrir un formulaire de dossier — le composant sera ajouté aux steps suivants. Pour l'instant vérifier que le fichier compile sans erreur TypeScript :

```bash
cd /Users/laidhamoudi/groupe-et-decouverte/dev-ged
npx tsc --noEmit 2>&1 | grep SignaturePad
```

Expected : aucune erreur sur `SignaturePad.tsx`

- [ ] **Step 3 : Commit**

```bash
git add components/dossier-enfant/SignaturePad.tsx
git commit -m "feat: add SignaturePad canvas component (pointer events, mouse/touch/trackpad)"
```

---

## Task 2 : Ajouter `signature_parentale` à la route upload

**Files:**
- Modify: `app/api/dossier-enfant/[inscriptionId]/upload/route.ts:4`

- [ ] **Step 1 : Modifier ALLOWED_TYPES**

Ligne 4, remplacer :
```typescript
const ALLOWED_TYPES = ['vaccins', 'ordonnance', 'pass_nautique', 'certificat_plongee', 'certificat_medical', 'attestation_assurance', 'autre'] as const;
```
Par :
```typescript
const ALLOWED_TYPES = ['vaccins', 'ordonnance', 'pass_nautique', 'certificat_plongee', 'certificat_medical', 'attestation_assurance', 'signature_parentale', 'autre'] as const;
```

- [ ] **Step 2 : Vérifier que la route retourne bien le storage_path**

Lire la suite de la route upload (lignes 60+) et confirmer que le JSON retourné contient `storage_path` ou `url`. Si la route retourne `{ document: { storage_path, ... } }`, noter le champ exact pour l'étape d'intégration formulaire.

Si la route ne retourne pas l'URL publique, ajouter dans le corps de réponse :

```typescript
// Après upload réussi, récupérer l'URL publique
const { data: { publicUrl } } = supabase
  .storage
  .from('dossier-documents')
  .getPublicUrl(storagePath);

// Inclure dans la réponse
return NextResponse.json({ success: true, document: { storage_path: storagePath, url: publicUrl, type: docType } });
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep upload
```
Expected : aucune erreur

- [ ] **Step 4 : Commit**

```bash
git add app/api/dossier-enfant/\[inscriptionId\]/upload/route.ts
git commit -m "feat: allow signature_parentale type in upload route"
```

---

## Task 3 : Signature dans FicheSanitaireForm

**Files:**
- Modify: `components/dossier-enfant/FicheSanitaireForm.tsx`

- [ ] **Step 1 : Ajouter l'import**

En haut du fichier, ajouter :
```typescript
import { SignaturePad } from './SignaturePad';
```

- [ ] **Step 2 : Ajouter l'état et le handler d'upload signature**

Dans le composant `FicheSanitaireForm`, après la déclaration de `update`, ajouter :

```typescript
const handleSignature = async (dataUrl: string | null) => {
  if (!dataUrl) {
    update('signature_image_url', null);
    return;
  }
  // Convertir dataUrl en File PNG
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], 'signature_parentale.png', { type: 'image/png' });

  const fd = new FormData();
  fd.append('token', (data.token as string) ?? '');
  fd.append('type', 'signature_parentale');
  fd.append('file', file);

  // inscriptionId doit être passé en prop — vérifier si disponible dans data ou props
  // Si non disponible, utiliser l'URL courante : window.location.pathname.split('/').find(...)
  const inscriptionId = (data.inscription_id as string) ?? '';
  const response = await fetch(`/api/dossier-enfant/${inscriptionId}/upload`, {
    method: 'POST',
    body: fd,
  });
  const json = await response.json() as { document?: { url?: string; storage_path?: string } };
  const url = json.document?.url ?? json.document?.storage_path ?? null;
  update('signature_image_url', url);
};
```

> **Note :** Vérifier comment `inscriptionId` et `token` sont disponibles dans ce composant — adapter si nécessaire depuis les props ou le contexte.

- [ ] **Step 3 : Ajouter le SignaturePad dans la section "Autorisation soins"**

Dans la section `Autorisation soins` (autour de la ligne 275), après le `Checkbox` existant et avant les boutons, ajouter :

```tsx
<div className="mt-3">
  <SignaturePad
    label="Signature du responsable légal"
    value={form.signature_image_url as string | null}
    onChange={(dataUrl) => { void handleSignature(dataUrl); }}
    disabled={saving}
  />
</div>
```

- [ ] **Step 4 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep FicheSanitaire
```
Expected : aucune erreur

- [ ] **Step 5 : Test visuel**

Ouvrir une fiche sanitaire dans l'app, vérifier :
- Le canvas s'affiche sous la case d'autorisation
- On peut signer à la souris
- "Signature enregistrée" apparaît après levée du clic
- Le bouton "Effacer" remet le canvas blanc

- [ ] **Step 6 : Commit**

```bash
git add components/dossier-enfant/FicheSanitaireForm.tsx
git commit -m "feat: add parent signature canvas to FicheSanitaireForm"
```

---

## Task 4 : Signature dans BulletinComplementForm

**Files:**
- Modify: `components/dossier-enfant/BulletinComplementForm.tsx`

- [ ] **Step 1 : Ajouter import**

```typescript
import { SignaturePad } from './SignaturePad';
```

- [ ] **Step 2 : Ajouter handleSignature (même pattern que Task 3)**

Copier le handler `handleSignature` de Task 3, adapter `token` et `inscriptionId` selon ce qui est disponible dans `BulletinComplementForm` (même logique).

- [ ] **Step 3 : Ajouter SignaturePad dans section "Autorisation du responsable légal"**

Après le `Checkbox autorisation_accepte` (ligne ~165), avant les boutons :

```tsx
<div className="mt-3">
  <SignaturePad
    label="Signature du responsable légal"
    value={form.signature_image_url as string | null}
    onChange={(dataUrl) => { void handleSignature(dataUrl); }}
    disabled={saving}
  />
</div>
```

- [ ] **Step 4 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep BulletinComplement
```

- [ ] **Step 5 : Test visuel** — même vérifications que Task 3

- [ ] **Step 6 : Commit**

```bash
git add components/dossier-enfant/BulletinComplementForm.tsx
git commit -m "feat: add parent signature canvas to BulletinComplementForm"
```

---

## Task 5 : Signature dans FicheLiaisonJeuneForm

**Files:**
- Modify: `components/dossier-enfant/FicheLiaisonJeuneForm.tsx`

- [ ] **Step 1 : Ajouter import**

```typescript
import { SignaturePad } from './SignaturePad';
```

- [ ] **Step 2 : Ajouter handleSignature** — même pattern Tasks 3 & 4

- [ ] **Step 3 : Ajouter SignaturePad dans section "Engagement"**

Après le `Checkbox engagement_accepte` (ligne ~141), avant les boutons :

```tsx
<div className="mt-3">
  <SignaturePad
    label="Signature du jeune et du responsable"
    value={form.signature_image_url as string | null}
    onChange={(dataUrl) => { void handleSignature(dataUrl); }}
    disabled={saving}
  />
</div>
```

- [ ] **Step 4 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep FicheLiaison
```

- [ ] **Step 5 : Test visuel** — idem Tasks 3 & 4

- [ ] **Step 6 : Commit**

```bash
git add components/dossier-enfant/FicheLiaisonJeuneForm.tsx
git commit -m "feat: add parent/youth signature canvas to FicheLiaisonJeuneForm"
```

---

## Task 6 : Injection signature dans le PDF final

**Files:**
- Modify: `app/api/dossier-enfant/[inscriptionId]/pdf/route.ts`

- [ ] **Step 1 : Lire les coordonnées des zones de signature dans les templates**

Exécuter ce script pour inspecter les templates PDF et identifier les zones de signature :

```bash
cd /Users/laidhamoudi/groupe-et-decouverte/dev-ged
node -e "
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const files = ['public/templates/bulletin.pdf', 'public/templates/sanitaire.pdf', 'public/templates/liaison.pdf'];
files.forEach(async f => {
  if (!fs.existsSync(f)) return;
  const doc = await PDFDocument.load(fs.readFileSync(f));
  const page = doc.getPages()[doc.getPageCount() - 1];
  console.log(f, 'last page size:', page.getSize());
});
"
```

Retient les dimensions (width/height) de chaque page — les coordonnées de signature sont généralement en bas de la dernière page.

> Les coordonnées exactes (x, y) sont à déterminer visuellement en ouvrant les templates PDF dans un lecteur. Zone typique : bas de page, y ≈ 240-260 (top-down), x ≈ 300-400.

- [ ] **Step 2 : Ajouter helper d'embedding image dans pdf/route.ts**

Après les imports existants, ajouter l'import si nécessaire (pdf-lib est déjà importé) :
```typescript
// pdf-lib déjà importé — PDFDocument, StandardFonts, rgb disponibles
// Ajouter fetch pour charger l'image depuis Supabase Storage
```

- [ ] **Step 3 : Ajouter la logique d'embedding pour chaque docType**

Dans la fonction de génération PDF, pour chaque docType (`bulletin`, `sanitaire`, `liaison`), après remplissage des champs texte existants, ajouter :

```typescript
// Embedding signature parentale (si présente)
const signatureUrl = s(d.signature_image_url);
if (signatureUrl) {
  try {
    // Charger l'image depuis Supabase Storage
    const imgResponse = await fetch(signatureUrl);
    const imgBuffer = await imgResponse.arrayBuffer();
    const signatureImage = await pdfDoc.embedPng(new Uint8Array(imgBuffer));

    // Coordonnées à adapter selon le template (voir Step 1)
    // Les valeurs ci-dessous sont des estimations — ajuster après inspection visuelle
    const sigCoords: Record<string, { page: number; x: number; y: number; w: number; h: number }> = {
      sanitaire: { page: 0, x: 300, y: 245, w: 120, h: 30 },
      bulletin:  { page: 0, x: 300, y: 245, w: 120, h: 30 },
      liaison:   { page: 0, x: 300, y: 245, w: 120, h: 30 },
    };
    const coords = sigCoords[docType];
    if (coords) {
      const targetPage = pdfDoc.getPages()[coords.page];
      if (targetPage) {
        const { height } = targetPage.getSize();
        targetPage.drawImage(signatureImage, {
          x: coords.x,
          y: height - coords.y - coords.h,  // top-down → bottom-up
          width: coords.w,
          height: coords.h,
          opacity: 1,
        });
      }
    }
  } catch {
    // Signature non critique — ne pas bloquer la génération PDF si l'image échoue
  }
}
```

- [ ] **Step 4 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "pdf/route"
```
Expected : aucune erreur

- [ ] **Step 5 : Test PDF**

Ouvrir un dossier avec signature enregistrée, télécharger le PDF correspondant, vérifier :
- La signature apparaît dans le PDF
- Le reste du PDF n'est pas altéré
- Un dossier sans signature génère un PDF normal (fallback silencieux)

- [ ] **Step 6 : Ajuster les coordonnées**

Après inspection visuelle du PDF généré, ajuster `sigCoords` pour chaque template jusqu'à positionnement correct.

- [ ] **Step 7 : Commit**

```bash
git add app/api/dossier-enfant/\[inscriptionId\]/pdf/route.ts
git commit -m "feat: embed parent signature image in PDF output (sanitaire/bulletin/liaison)"
```

---

## Vérification finale

- [ ] Build propre :
```bash
npm run build 2>&1 | tail -20
```
Expected : aucune erreur de compilation

- [ ] Flux complet :
  1. Ouvrir fiche sanitaire → signer → Valider
  2. Télécharger PDF → signature visible
  3. Ouvrir fiche sans signature → PDF généré normalement

- [ ] Régression :
  - Upload documents externes (pass nautique, vaccins) toujours fonctionnel
  - Checkboxes existantes toujours opérationnelles

---

## Limites

| Limite | Note |
|---|---|
| Coordonnées PDF à ajuster | Nécessite inspection visuelle des templates — prévu Task 6 Step 1 |
| `inscriptionId` / `token` dans formulaires | À vérifier selon les props disponibles — adapter handler si besoin |
| Valeur juridique | Signature canvas = attestation comportementale, non qualifiée eIDAS — suffisant pour usage interne structures sociales |
| Médecin / maître-nageur / plongée | Non concernés — upload document existant, hors scope |
