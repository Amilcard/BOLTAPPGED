#!/usr/bin/env tsx
/**
 * Phase A — extraction des coordonnées AcroForm des 3 templates GED.
 * Lit les PDFs templates et produit out/pdf-coords.json :
 *   { templateName: { fieldName: { page, x, y, width, height, type } } }
 *
 * Origine y du PDF = bas de page. Les coords sont retournées telles quelles.
 * À utiliser comme source de vérité pour calibrer route.ts (au lieu de devinettes).
 *
 * Run: npx tsx scripts/pdf/extract-template-coords.ts
 */
import { PDFDocument } from 'pdf-lib';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const TEMPLATES = [
  'bulletin-inscription-template.pdf',
  'fiche-sanitaire-template.pdf',
  'fiche-liaison-template.pdf',
  'fiche-renseignements-template.pdf',
];

type Coord = { page: number; x: number; y: number; width: number; height: number; type: string };
type CoordMap = Record<string, Coord>;

async function extractFromTemplate(file: string): Promise<CoordMap> {
  const bytes = await readFile(path.resolve(process.cwd(), 'public', 'templates', file));
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();
  const fields = form.getFields();
  const map: CoordMap = {};

  fields.forEach((f) => {
    const name = f.getName();
    const widgets = f.acroField.getWidgets();
    widgets.forEach((widget, idx) => {
      const rect = widget.getRectangle();
      const pageRef = widget.P();
      let pageIndex = 0;
      pdf.getPages().forEach((p, pi) => {
        if (p.ref === pageRef) pageIndex = pi;
      });
      const key = widgets.length > 1 ? `${name}#${idx}` : name;
      map[key] = {
        page: pageIndex,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        type: f.constructor.name,
      };
    });
  });

  return map;
}

async function main() {
  const outDir = path.resolve(process.cwd(), 'out');
  await mkdir(outDir, { recursive: true });
  const result: Record<string, CoordMap | { error: string }> = {};

  for (const tpl of TEMPLATES) {
    try {
      const coords = await extractFromTemplate(tpl);
      result[tpl] = coords;
      const count = Object.keys(coords).length;
      console.log(`[OK] ${tpl} → ${count} fields extracted`);
    } catch (err) {
      const msg = (err as Error)?.message || String(err);
      result[tpl] = { error: msg };
      console.error(`[KO] ${tpl} → ${msg}`);
    }
  }

  const outPath = path.join(outDir, 'pdf-coords.json');
  await writeFile(outPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\n→ ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
