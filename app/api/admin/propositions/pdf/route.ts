export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { verifyAuth } from '@/lib/auth-middleware';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';


// Couleurs GED
const ORANGE = rgb(0.878, 0.478, 0.373);
const DARK = rgb(0.12, 0.12, 0.2);
const GRAY = rgb(0.4, 0.4, 0.4);
const LIGHT_BG = rgb(0.96, 0.96, 0.96);
const WHITE = rgb(1, 1, 1);

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtPrice(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' EUR';
}

export async function GET(req: NextRequest) {
  try {
    const auth = verifyAuth(req);
    if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 });

    const supabase = getSupabase();
    const { data: prop } = await supabase
      .from('gd_propositions_tarifaires')
      .select('*')
      .eq('id', id)
      .single();

    if (!prop) return NextResponse.json({ error: 'Proposition introuvable' }, { status: 404 });

    const p = prop as Record<string, any>;

    // Nettoyer caracteres non-WinAnsi
    const c = (str: unknown): string => {
      if (!str) return '';
      return String(str)
        .replace(/[\u2011\u2013\u2014]/g, '-')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\u2026/g, '...')
        .replace(/\u00A0/g, ' ')
        .replace(/[^\x20-\xFF]/g, '');
    };

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const LEFT = 50;
    const RIGHT = width - 50;
    const COL_RIGHT = RIGHT; // right edge for price alignment

    // Helper write (top-down Y)
    const w = (x: number, y: number, text: string, font = regular, size = 10, color = DARK) => {
      const safe = c(text);
      if (!safe) return;
      page.drawText(safe, { x, y: height - y, size, font, color });
    };

    // Helper write right-aligned
    const wr = (xRight: number, y: number, text: string, font = regular, size = 10, color = DARK) => {
      const safe = c(text);
      if (!safe) return;
      const tw = font.widthOfTextAtSize(safe, size);
      page.drawText(safe, { x: xRight - tw, y: height - y, size, font, color });
    };

    const line = (x1: number, y: number, x2: number, color = ORANGE, thick = 1) => {
      page.drawLine({ start: { x: x1, y: height - y }, end: { x: x2, y: height - y }, thickness: thick, color });
    };

    const rect = (x: number, y: number, w: number, h: number, color: typeof ORANGE) => {
      page.drawRectangle({ x, y: height - y - h, width: w, height: h, color });
    };

    let Y = 0;

    // ========== BANDE HEADER ==========
    rect(0, 0, width, 60, ORANGE);
    w(LEFT, 22, 'ASSOCIATION GROUPE ET DECOUVERTE', bold, 16, WHITE);
    w(LEFT, 40, 'Colonies de vacances - Sejours educatifs', regular, 10, WHITE);

    // ========== DESTINATAIRE (droite) ==========
    Y = 80;
    w(LEFT, Y, `Saint-Etienne, le ${c(new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }))}`, regular, 9, GRAY);

    Y = 100;
    wr(RIGHT, Y, c(p.structure_nom) || '', bold, 11);
    if (p.structure_adresse) { Y += 15; wr(RIGHT, Y, c(p.structure_adresse), regular, 10, GRAY); }
    Y += 15; wr(RIGHT, Y, `${c(p.structure_cp)} ${c(p.structure_ville)}`, regular, 10, GRAY);

    // ========== TITRE ==========
    Y = 160;
    w(LEFT, Y, 'PROPOSITION TARIFAIRE', bold, 22, ORANGE);
    Y += 14;
    line(LEFT, Y, RIGHT, ORANGE, 2);

    // ========== INFOS INSCRIPTION ==========
    Y += 25;
    const LBL = LEFT;
    const VAL = 210;

    const infoRow = (label: string, value: string) => {
      w(LBL, Y, label, regular, 10, GRAY);
      w(VAL, Y, value, bold, 10);
      Y += 18;
    };

    infoRow('Enfant :', `${c((p.enfant_nom || '').toUpperCase())} ${c(p.enfant_prenom || '')}`);
    infoRow('Sejour :', c(p.sejour_titre || p.sejour_slug || ''));
    if (p.sejour_activites) {
      w(LBL, Y, 'Activites :', regular, 10, GRAY);
      const act = c(p.sejour_activites).slice(0, 90);
      w(VAL, Y, act, bold, 9, ORANGE);
      Y += 18;
    }
    infoRow('Periode :', `Du ${fmtDate(p.session_start)} au ${fmtDate(p.session_end)}`);
    infoRow('Ville de depart :', c(p.ville_depart || ''));
    infoRow('N. agrement DSCS :', c(p.agrement_dscs || '069ORG0667'));

    // ========== TABLEAU TARIFICATION ==========
    Y += 10;
    const TABLE_LEFT = LEFT;
    const TABLE_RIGHT = RIGHT;
    const TABLE_W = TABLE_RIGHT - TABLE_LEFT;
    const PRICE_COL = TABLE_RIGHT - 10; // right edge of price column

    // Header du tableau
    rect(TABLE_LEFT, Y, TABLE_W, 28, ORANGE);
    Y += 8;
    w(TABLE_LEFT + 15, Y, 'DESIGNATION', bold, 10, WHITE);
    wr(PRICE_COL, Y, 'MONTANT TTC', bold, 10, WHITE);
    Y += 20;

    // Lignes du tableau
    const priceRow = (label: string, value: string, bg = false) => {
      if (bg) rect(TABLE_LEFT, Y, TABLE_W, 24, LIGHT_BG);
      Y += 7;
      w(TABLE_LEFT + 15, Y, label, regular, 10);
      wr(PRICE_COL, Y, value, bold, 10);
      Y += 17;
      line(TABLE_LEFT, Y, TABLE_RIGHT, rgb(0.9, 0.9, 0.9), 0.5);
    };

    priceRow('Sejour', fmtPrice(Number(p.prix_sejour) || 0), false);
    priceRow('Transport', fmtPrice(Number(p.prix_transport) || 0), true);
    if (p.encadrement) {
      priceRow('Encadrement renforce (animateur dedie)', fmtPrice(Number(p.prix_encadrement) || 0), false);
    }
    priceRow('Adhesion', c(p.adhesion || 'Comprise'), true);

    // Options
    const optText = c(p.options || 'Tranquillite : recherche individualisee, veille educative, bilans.');
    rect(TABLE_LEFT, Y, TABLE_W, 24, false ? LIGHT_BG : WHITE);
    Y += 7;
    w(TABLE_LEFT + 15, Y, 'Options', regular, 10);
    // Truncate options to fit
    const optShort = optText.length > 50 ? optText.slice(0, 50) + '...' : optText;
    wr(PRICE_COL, Y, optShort, regular, 8, GRAY);
    Y += 17;

    // TOTAL
    Y += 5;
    rect(TABLE_LEFT, Y, TABLE_W, 32, ORANGE);
    Y += 10;
    w(TABLE_LEFT + 15, Y, 'TOTAL SEJOUR TTC', bold, 14, WHITE);
    wr(PRICE_COL, Y, fmtPrice(Number(p.prix_total) || 0), bold, 14, WHITE);
    Y += 22;

    // ========== BON POUR ACCORD ==========
    Y += 30;
    rect(LEFT, Y, TABLE_W, 110, LIGHT_BG);

    Y += 15;
    w(LEFT + 20, Y, 'BON POUR ACCORD', bold, 14, ORANGE);
    Y += 25;
    w(LEFT + 20, Y, 'Nom et qualite du signataire : ______________________________________', regular, 10);
    Y += 22;
    w(LEFT + 20, Y, 'Date : ____/____/________', regular, 10);
    w(320, Y, 'Signature et cachet :', regular, 10);

    // ========== PIED DE PAGE ==========
    const FY = 780;
    line(LEFT, FY, RIGHT, ORANGE, 1);
    w(170, FY + 12, 'ASSOCIATION GROUPE ET DECOUVERTE', bold, 8);
    w(185, FY + 24, '3 rue Flobert 42 000 Saint-Etienne', regular, 7, GRAY);
    w(140, FY + 34, 'Tel : 04 23 16 16 71 - Mail : contact@groupeetdecouverte.fr', regular, 7, GRAY);
    w(205, FY + 44, 'www.groupeetdecouverte.fr', regular, 7, ORANGE);
    w(95, FY + 55, 'Association loi 1901, N. Agrement prefectoral 069ORG0667 - N. Siret 51522565400026', regular, 6, GRAY);

    const pdfBytes = await pdfDoc.save();
    const filename = `Proposition_${c(p.enfant_nom)}_${c(p.enfant_prenom)}.pdf`;

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('PDF generation error:', error);
    return NextResponse.json({ error: error.message || 'Erreur generation PDF' }, { status: 500 });
  }
}
