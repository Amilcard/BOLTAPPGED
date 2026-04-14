import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const ORANGE = rgb(0.878, 0.478, 0.373);
const DARK = rgb(0.12, 0.12, 0.2);
const GRAY = rgb(0.4, 0.4, 0.4);
const LIGHT_BG = rgb(0.96, 0.96, 0.96);
const WHITE = rgb(1, 1, 1);

/** Sanitize non-WinAnsi characters */
function c(str: unknown): string {
  if (!str) return '';
  return String(str)
    .replace(/[\u2011\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\xFF]/g, '');
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtPrice(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' EUR';
}

interface FactureLigne {
  enfant_nom?: string;
  enfant_prenom?: string;
  sejour_titre?: string;
  session_start?: string;
  session_end?: string;
  ville_depart?: string;
  prix_sejour?: number;
  prix_transport?: number;
  prix_encadrement?: number;
  prix_ligne_total?: number;
}

interface Paiement {
  date_paiement?: string;
  montant?: number;
  methode?: string;
}

interface Facture {
  numero?: string;
  structure_nom?: string;
  structure_adresse?: string;
  structure_cp?: string;
  structure_ville?: string;
  montant_total?: number;
  created_at?: string;
  date_envoi?: string;
  [key: string]: unknown;
}

/**
 * Generate a PDF for a facture with its lignes and paiements.
 */
export async function generateFacturePdf(
  facture: Facture,
  lignes: FactureLigne[],
  paiements: Paiement[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const LEFT = 50;
  const RIGHT = width - 50;

  const w = (x: number, y: number, text: string, font = regular, size = 10, color = DARK) => {
    const safe = c(text);
    if (!safe) return;
    page.drawText(safe, { x, y: height - y, size, font, color });
  };

  const wr = (xRight: number, y: number, text: string, font = regular, size = 10, color = DARK) => {
    const safe = c(text);
    if (!safe) return;
    const tw = font.widthOfTextAtSize(safe, size);
    page.drawText(safe, { x: xRight - tw, y: height - y, size, font, color });
  };

  const line = (x1: number, y: number, x2: number, color = ORANGE, thick = 1) => {
    page.drawLine({ start: { x: x1, y: height - y }, end: { x: x2, y: height - y }, thickness: thick, color });
  };

  const rect = (x: number, y: number, rw: number, h: number, color: typeof ORANGE) => {
    page.drawRectangle({ x, y: height - y - h, width: rw, height: h, color });
  };

  let Y = 0;

  // ========== HEADER BAND ==========
  rect(0, 0, width, 60, ORANGE);
  w(LEFT, 22, 'ASSOCIATION GROUPE ET DECOUVERTE', bold, 16, WHITE);
  w(LEFT, 40, 'Colonies de vacances - Sejours educatifs', regular, 10, WHITE);

  // ========== DATE ==========
  Y = 80;
  const rawDate = facture.date_envoi || facture.created_at || null;
  const factureDate = rawDate && !isNaN(new Date(String(rawDate)).getTime()) ? String(rawDate) : new Date().toISOString();
  w(LEFT, Y, `Saint-Etienne, le ${c(new Date(factureDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }))}`, regular, 9, GRAY);

  // ========== STRUCTURE BLOCK (right) ==========
  Y = 100;
  wr(RIGHT, Y, c(facture.structure_nom) || '', bold, 11);
  if (facture.structure_adresse) { Y += 15; wr(RIGHT, Y, c(facture.structure_adresse), regular, 10, GRAY); }
  Y += 15; wr(RIGHT, Y, `${c(facture.structure_cp)} ${c(facture.structure_ville)}`, regular, 10, GRAY);

  // ========== TITLE ==========
  Y = 160;
  const titre = `FACTURE N. ${c(facture.numero) || '---'}`;
  w(LEFT, Y, titre, bold, 22, ORANGE);
  Y += 14;
  line(LEFT, Y, RIGHT, ORANGE, 2);

  // ========== TABLE: DETAIL DES PRESTATIONS ==========
  Y += 25;
  const TABLE_W = RIGHT - LEFT;
  const COL_ENFANT = LEFT + 10;
  const COL_SEJOUR = LEFT + 130;
  const COL_PERIODE = LEFT + 270;
  const COL_VILLE = LEFT + 370;
  const COL_MONTANT = RIGHT - 10;

  // Header row
  rect(LEFT, Y, TABLE_W, 24, ORANGE);
  Y += 7;
  w(COL_ENFANT, Y, 'Enfant', bold, 8, WHITE);
  w(COL_SEJOUR, Y, 'Sejour', bold, 8, WHITE);
  w(COL_PERIODE, Y, 'Periode', bold, 8, WHITE);
  w(COL_VILLE, Y, 'Ville dep.', bold, 8, WHITE);
  wr(COL_MONTANT, Y, 'Montant', bold, 8, WHITE);
  Y += 17;

  // Rows — avec gestion de page overflow
  const PAGE_BREAK_Y = height - 120; // marge basse de sécurité pour footer

  for (let i = 0; i < lignes.length; i++) {
    // Check si on dépasse la page → nouvelle page
    if (Y > PAGE_BREAK_Y) {
      page = pdfDoc.addPage([width, height]);
      Y = 40;
    }

    const l = lignes[i];
    const bg = i % 2 === 1;
    if (bg) rect(LEFT, Y, TABLE_W, 20, LIGHT_BG);
    Y += 6;

    const enfantStr = `${c(String(l.enfant_nom || '').toUpperCase())} ${c(l.enfant_prenom)}`;
    w(COL_ENFANT, Y, enfantStr.slice(0, 20), regular, 8);
    w(COL_SEJOUR, Y, c(l.sejour_titre || '').slice(0, 22), regular, 8);

    const periode = l.session_start && l.session_end
      ? `${fmtDate(l.session_start)} - ${fmtDate(l.session_end)}`
      : '';
    w(COL_PERIODE, Y, periode, regular, 7);
    w(COL_VILLE, Y, c(l.ville_depart || '').slice(0, 14), regular, 8);
    wr(COL_MONTANT, Y, fmtPrice(Number(l.prix_ligne_total) || 0), bold, 8);
    Y += 14;

    // Sub-lines for transport / encadrement if > 0
    const transport = Number(l.prix_transport) || 0;
    const encadrement = Number(l.prix_encadrement) || 0;

    if (transport > 0 || encadrement > 0) {
      if (transport > 0) {
        w(COL_SEJOUR, Y, '  dont transport', regular, 7, GRAY);
        wr(COL_MONTANT, Y, fmtPrice(transport), regular, 7, GRAY);
        Y += 12;
      }
      if (encadrement > 0) {
        w(COL_SEJOUR, Y, '  dont encadrement', regular, 7, GRAY);
        wr(COL_MONTANT, Y, fmtPrice(encadrement), regular, 7, GRAY);
        Y += 12;
      }
    }

    line(LEFT, Y, RIGHT, rgb(0.9, 0.9, 0.9), 0.5);
  }

  // TOTAL TTC
  Y += 5;
  rect(LEFT, Y, TABLE_W, 28, ORANGE);
  Y += 8;
  w(LEFT + 15, Y, 'TOTAL TTC', bold, 12, WHITE);
  wr(COL_MONTANT, Y, fmtPrice(Number(facture.montant_total) || 0), bold, 12, WHITE);
  Y += 20;

  // ========== SECTION: REGLEMENTS RECUS ==========
  if (paiements.length > 0) {
    Y += 20;
    w(LEFT, Y, 'REGLEMENTS RECUS', bold, 12, ORANGE);
    Y += 5;
    line(LEFT, Y, RIGHT, ORANGE, 1);
    Y += 10;

    // Header
    const P_DATE = LEFT + 10;
    const P_MONTANT = LEFT + 200;
    const P_MODE = LEFT + 350;

    rect(LEFT, Y, TABLE_W, 20, ORANGE);
    Y += 6;
    w(P_DATE, Y, 'Date', bold, 8, WHITE);
    w(P_MONTANT, Y, 'Montant', bold, 8, WHITE);
    w(P_MODE, Y, 'Mode', bold, 8, WHITE);
    Y += 14;

    let totalPaye = 0;
    for (let i = 0; i < paiements.length; i++) {
      const p = paiements[i];
      const bg = i % 2 === 1;
      if (bg) rect(LEFT, Y, TABLE_W, 18, LIGHT_BG);
      Y += 5;
      w(P_DATE, Y, fmtDate(p.date_paiement || ''), regular, 8);
      w(P_MONTANT, Y, fmtPrice(Number(p.montant) || 0), regular, 8);

      const methodeLabel: Record<string, string> = { virement: 'Virement', cb_stripe: 'Carte bancaire', cheque: 'Cheque' };
      w(P_MODE, Y, methodeLabel[p.methode || ''] || c(p.methode || ''), regular, 8);
      totalPaye += Number(p.montant) || 0;
      Y += 13;
      line(LEFT, Y, RIGHT, rgb(0.9, 0.9, 0.9), 0.5);
    }

    // Total regle + Solde restant
    Y += 8;
    w(LEFT + 15, Y, 'TOTAL REGLE', bold, 10);
    wr(COL_MONTANT, Y, fmtPrice(totalPaye), bold, 10);
    Y += 18;

    const solde = Math.max(0, (Number(facture.montant_total) || 0) - totalPaye);
    rect(LEFT, Y, TABLE_W, 24, solde > 0 ? ORANGE : rgb(0.2, 0.6, 0.3));
    Y += 7;
    w(LEFT + 15, Y, 'SOLDE RESTANT DU', bold, 10, WHITE);
    wr(COL_MONTANT, Y, fmtPrice(solde), bold, 10, WHITE);
    Y += 17;
  }

  // ========== FOOTER ==========
  const FY = 780;
  line(LEFT, FY, RIGHT, ORANGE, 1);
  w(170, FY + 12, 'ASSOCIATION GROUPE ET DECOUVERTE', bold, 8);
  w(185, FY + 24, '3 rue Flobert 42 000 Saint-Etienne', regular, 7, GRAY);
  w(140, FY + 34, 'Tel : 04 23 16 16 71 - Mail : contact@groupeetdecouverte.fr', regular, 7, GRAY);
  w(205, FY + 44, 'www.groupeetdecouverte.fr', regular, 7, ORANGE);
  w(95, FY + 55, 'Association loi 1901, N. Agrement prefectoral 069ORG0667 - N. Siret 51522565400026', regular, 6, GRAY);

  return await pdfDoc.save();
}
