import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const ORANGE = rgb(0.878, 0.478, 0.373);
const DARK   = rgb(0.12, 0.12, 0.2);
const GRAY   = rgb(0.4, 0.4, 0.4);

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtPrice(n: number) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(n) + ' EUR';
}

export interface FactureLigne {
  enfant_prenom: string; enfant_nom: string; sejour_titre: string;
  session_start?: string | null; session_end?: string | null; ville_depart?: string | null;
  prix_sejour: number; prix_transport: number; prix_encadrement: number; prix_ligne_total: number;
}

export interface FactureData {
  numero: string;
  structure_nom: string; structure_adresse?: string | null; structure_cp?: string | null; structure_ville?: string | null;
  montant_total: number; statut: string; created_at: string;
  lignes: FactureLigne[];
}

export async function generateFacturePdf(f: FactureData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page   = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const c = (s: unknown) => String(s ?? '').replace(/[\u2011\u2013\u2014]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').replace(/\u2026/g,'...').replace(/\u00A0/g,' ').replace(/[^\x20-\xFF]/g,'');

  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: DARK });
  page.drawText(c('Association Groupe et Decouverte'), { x: 40, y: height - 30, size: 10, font, color: rgb(1,1,1) });
  page.drawText(c('FACTURE'), { x: 40, y: height - 55, size: 20, font: fontBold, color: ORANGE });
  page.drawText(c(f.numero), { x: width - 150, y: height - 50, size: 12, font: fontBold, color: rgb(1,1,1) });

  let y = height - 120;
  page.drawText(c('Facturer a :'), { x: 40, y, size: 10, font, color: GRAY });
  y -= 16;
  page.drawText(c(f.structure_nom), { x: 40, y, size: 11, font: fontBold, color: DARK });
  if (f.structure_adresse) { y -= 14; page.drawText(c(f.structure_adresse), { x: 40, y, size: 10, font, color: DARK }); }
  if (f.structure_cp || f.structure_ville) {
    y -= 14;
    page.drawText(c(`${f.structure_cp ?? ''} ${f.structure_ville ?? ''}`.trim()), { x: 40, y, size: 10, font, color: DARK });
  }

  y -= 30;
  page.drawText(c(`Date : ${fmtDate(f.created_at)}`), { x: 40, y, size: 10, font, color: GRAY });

  y -= 30;
  const colEnfant = 40;
  const colSejour = 170;
  const colDates  = 310;
  const colTotal  = width - 120;

  page.drawRectangle({ x: 40, y: y - 4, width: width - 80, height: 20, color: rgb(0.94,0.94,0.94) });
  page.drawText(c('Enfant'),  { x: colEnfant, y, size: 9, font: fontBold, color: DARK });
  page.drawText(c('Sejour'),  { x: colSejour, y, size: 9, font: fontBold, color: DARK });
  page.drawText(c('Session'), { x: colDates,  y, size: 9, font: fontBold, color: DARK });
  page.drawText(c('Total'),   { x: colTotal,  y, size: 9, font: fontBold, color: DARK });

  for (const l of f.lignes) {
    y -= 20;
    page.drawText(c(`${l.enfant_prenom} ${l.enfant_nom}`).slice(0,20), { x: colEnfant, y, size: 9, font, color: DARK });
    page.drawText(c(l.sejour_titre).slice(0,25), { x: colSejour, y, size: 9, font, color: DARK });
    const dates = l.session_start ? fmtDate(l.session_start) : '';
    page.drawText(c(dates), { x: colDates, y, size: 9, font, color: DARK });
    page.drawText(c(fmtPrice(l.prix_ligne_total)), { x: colTotal, y, size: 9, font, color: DARK });
    page.drawLine({ start: { x: 40, y: y - 3 }, end: { x: width - 40, y: y - 3 }, thickness: 0.4, color: rgb(0.9,0.9,0.9) });
  }

  y -= 30;
  page.drawRectangle({ x: 40, y: y - 4, width: width - 80, height: 24, color: ORANGE });
  page.drawText(c('TOTAL TTC'), { x: 50, y, size: 11, font: fontBold, color: rgb(1,1,1) });
  page.drawText(c(fmtPrice(f.montant_total)), { x: colTotal - 20, y, size: 11, font: fontBold, color: rgb(1,1,1) });

  page.drawText(c('Groupe et Decouverte - 04 23 16 16 71 - contact@groupeetdecouverte.fr'), { x: 40, y: 30, size: 8, font, color: GRAY });

  return pdfDoc.save();
}
