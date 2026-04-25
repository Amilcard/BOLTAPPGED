#!/usr/bin/env tsx
/**
 * Phase B (alternative scriptable) — création AcroForm text fields aux
 * positions des lignes pointillées (`………`) détectées dans les templates.
 *
 * Approche déterministe :
 *  1. `pdftotext -bbox` (Poppler) extrait chaque "mot" avec position exacte
 *     (xMin, yMin, xMax, yMax) — origine top-left.
 *  2. Filtre les "mots" qui sont des lignes pointillées (`………...…`).
 *  3. Pour chaque ligne pointillée, identifie le label texte le plus proche
 *     à GAUCHE sur la même ligne Y (tolérance ±3 px).
 *  4. Slugify le label → field name avec préfixe domaine.
 *  5. Crée un AcroForm text field via pdf-lib aux coordonnées exactes
 *     (conversion top-left → bottom-left pour pdf-lib).
 *  6. Sauvegarde le template enrichi.
 *
 * Non-régression :
 *  - Le code générateur PDF (`route.ts`) continue d'utiliser writeText() —
 *    les fields ajoutés sont vides dans le PDF rendu, le rendu visuel est
 *    INCHANGÉ.
 *  - Bénéfice : base posée pour le refacto futur `route.ts` →
 *    `form.getTextField('name').setText(value)` qui éliminera les bugs
 *    d'alignement définitivement.
 *
 * Run :
 *   npx tsx scripts/pdf/build-acroform-text-fields.ts bulletin
 *   npx tsx scripts/pdf/build-acroform-text-fields.ts sanitaire
 *   npx tsx scripts/pdf/build-acroform-text-fields.ts all
 */
import { PDFDocument } from 'pdf-lib';
import { readFile, writeFile } from 'fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';

interface BboxWord {
  page: number;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  text: string;
}

const TEMPLATES: Record<string, { file: string; prefix: string }> = {
  bulletin: { file: 'bulletin-inscription-template.pdf', prefix: 'bulletin' },
  sanitaire: { file: 'fiche-sanitaire-template.pdf', prefix: 'sanitaire' },
};

const DOT_LINE_RE = /^[…\.\s]+$/u;
const HTML_PAGE_RE = /<page\s+width="[^"]+"\s+height="[^"]+">([\s\S]*?)<\/page>/g;
const HTML_WORD_RE = /<word\s+xMin="([\d.]+)"\s+yMin="([\d.]+)"\s+xMax="([\d.]+)"\s+yMax="([\d.]+)">([^<]*)<\/word>/g;

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseBboxHtml(html: string): BboxWord[] {
  const words: BboxWord[] = [];
  let pageIndex = 0;
  let pageMatch: RegExpExecArray | null;
  HTML_PAGE_RE.lastIndex = 0;
  while ((pageMatch = HTML_PAGE_RE.exec(html)) !== null) {
    const inner = pageMatch[1];
    let wm: RegExpExecArray | null;
    HTML_WORD_RE.lastIndex = 0;
    while ((wm = HTML_WORD_RE.exec(inner)) !== null) {
      words.push({
        page: pageIndex,
        xMin: parseFloat(wm[1]),
        yMin: parseFloat(wm[2]),
        xMax: parseFloat(wm[3]),
        yMax: parseFloat(wm[4]),
        text: decodeXml(wm[5]),
      });
    }
    pageIndex++;
  }
  return words;
}

function isDotLine(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 5) return false;
  return DOT_LINE_RE.test(trimmed);
}

/**
 * Détecte si un mot contient un label SUIVI d'une dotline (ex: `Prénom*:.........`).
 * Si oui, retourne {label, dotlineWord} avec coords estimées de la dotline.
 * Si non, retourne null.
 */
function splitLabelDotline(word: BboxWord): { label: string; dotline: BboxWord } | null {
  const m = word.text.match(/^(.*?)([…\.]{5,})$/u);
  if (!m) return null;
  const labelPart = m[1];
  const dotPart = m[2];
  if (!labelPart || labelPart.length === 0) return null; // pure dotline → géré ailleurs
  const totalLen = word.text.length;
  const labelLen = labelPart.length;
  const ratio = labelLen / totalLen;
  const dotXMin = word.xMin + (word.xMax - word.xMin) * ratio;
  return {
    label: labelPart.replace(/[\s:*]+$/, '').trim(),
    dotline: {
      page: word.page,
      xMin: dotXMin,
      yMin: word.yMin,
      xMax: word.xMax,
      yMax: word.yMax,
      text: dotPart,
    },
  };
}

/**
 * Trouve le label texte le plus proche à GAUCHE sur la même ligne (±tolerance Y).
 * Concatène les mots adjacents pour reconstituer le label complet.
 */
function findLabelLeft(words: BboxWord[], target: BboxWord, tolY = 3): string {
  const sameLine = words
    .filter(w => w !== target && w.page === target.page)
    .filter(w => Math.abs(w.yMin - target.yMin) <= tolY)
    .filter(w => w.xMax <= target.xMin)
    .filter(w => !isDotLine(w.text))
    .sort((a, b) => b.xMax - a.xMax); // plus proche d'abord

  if (sameLine.length === 0) return '';

  // Concaténer les mots contigus (gap < 8 px) du plus proche vers la gauche
  const labelWords: string[] = [];
  let lastX = target.xMin;
  for (const w of sameLine) {
    if (lastX - w.xMax > 8) break; // trou trop grand → fin du label
    labelWords.unshift(w.text);
    lastX = w.xMin;
  }
  return labelWords.join(' ').trim();
}

/**
 * Normalise un label en field name AcroForm : sans accents, snake_case,
 * préfixé par domaine, suffixé par compteur si duplicate.
 */
function makeFieldName(label: string, prefix: string, counters: Map<string, number>): string {
  const slug = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['']/g, '_')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .slice(0, 50);
  const base = `${prefix}_${slug || 'field'}`;
  const n = (counters.get(base) ?? 0) + 1;
  counters.set(base, n);
  return n === 1 ? base : `${base}_${n}`;
}

async function processTemplate(key: string): Promise<void> {
  const cfg = TEMPLATES[key];
  if (!cfg) {
    console.error(`Template inconnu: ${key}. Disponibles: ${Object.keys(TEMPLATES).join(', ')}`);
    process.exit(2);
  }

  const filePath = path.resolve(process.cwd(), 'public', 'templates', cfg.file);
  const bboxPath = `/tmp/acroform-${key}.bbox.html`;

  console.log(`\n=== ${cfg.file} (prefix: ${cfg.prefix}) ===`);

  // 1. Extract bbox HTML
  execSync(`pdftotext -bbox "${filePath}" "${bboxPath}"`, { stdio: 'pipe' });
  const bboxHtml = await readFile(bboxPath, 'utf8');
  const words = parseBboxHtml(bboxHtml);
  console.log(`  → ${words.length} mots extraits sur ${new Set(words.map(w => w.page)).size} page(s)`);

  // 2. Détection 2 modes : (a) mots pure-dotline, (b) mots label+dotline merged
  type Slot = { dotline: BboxWord; embeddedLabel?: string };
  const slots: Slot[] = [];
  for (const w of words) {
    if (isDotLine(w.text)) {
      slots.push({ dotline: w });
      continue;
    }
    const split = splitLabelDotline(w);
    if (split) {
      slots.push({ dotline: split.dotline, embeddedLabel: split.label });
    }
  }
  console.log(`  → ${slots.length} slots détectés (${slots.filter(s => !s.embeddedLabel).length} pures + ${slots.filter(s => s.embeddedLabel).length} merged)`);

  // 3. Load PDF
  const bytes = await readFile(filePath);
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();
  const existingFields = form.getFields();
  const existingNames = new Set(existingFields.map(f => f.getName()));
  console.log(`  → ${existingFields.length} fields AcroForm pré-existants`);

  // 4. Pages
  const pages = pdf.getPages();
  const counters = new Map<string, number>();
  let created = 0;
  let skipped = 0;

  for (const slot of slots) {
    const dl = slot.dotline;
    const page = pages[dl.page];
    if (!page) continue;
    const pageHeight = page.getHeight();

    // Label : embedded (mot label+dot merged) OU à gauche
    const label = slot.embeddedLabel ?? findLabelLeft(words, dl);
    if (!label) {
      skipped++;
      continue;
    }

    const fieldName = makeFieldName(label, cfg.prefix, counters);
    if (existingNames.has(fieldName)) {
      skipped++;
      continue;
    }

    // pdf-lib origin = bottom-left ; bbox origin = top-left
    const x = dl.xMin;
    const y = pageHeight - dl.yMax;
    const width = Math.max(20, dl.xMax - dl.xMin);
    const height = Math.max(10, dl.yMax - dl.yMin);

    try {
      const field = form.createTextField(fieldName);
      field.addToPage(page, { x, y, width, height, borderWidth: 0 });
      existingNames.add(fieldName);
      created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  [skip] ${fieldName}: ${msg}`);
      skipped++;
    }
  }

  console.log(`  → ${created} fields créés, ${skipped} skippés`);

  // 5. Save
  const outBytes = await pdf.save();
  await writeFile(filePath, outBytes);
  console.log(`  ✓ Template enrichi sauvegardé: ${filePath}`);
}

async function main(): Promise<void> {
  const arg = process.argv[2] ?? 'all';
  const keys = arg === 'all' ? Object.keys(TEMPLATES) : [arg];

  for (const k of keys) {
    await processTemplate(k);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
