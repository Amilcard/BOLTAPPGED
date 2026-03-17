export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readFile } from 'fs/promises';
import path from 'path';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Couleurs GED
const ORANGE = rgb(0.878, 0.478, 0.373);      // #e07a5f
const DARK_TEXT = rgb(0.1, 0.1, 0.18);         // #1a1a2e
const GRAY_TEXT = rgb(0.35, 0.35, 0.35);
const LIGHT_GRAY = rgb(0.85, 0.85, 0.85);

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount) + ' €';
}

/**
 * GET /api/admin/propositions/pdf?id=xxx
 * Génère le PDF de la proposition tarifaire (page 1)
 */
export async function GET(req: NextRequest) {
  try {
    const propositionId = req.nextUrl.searchParams.get('id');
    if (!propositionId) {
      return NextResponse.json({ error: 'ID manquant' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: prop } = await supabase
      .from('gd_propositions_tarifaires')
      .select('*')
      .eq('id', propositionId)
      .single();

    if (!prop) {
      return NextResponse.json({ error: 'Proposition introuvable' }, { status: 404 });
    }

    const p = prop as Record<string, any>;

    // Créer un nouveau document PDF A4
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Helper : écriture top-down
    const write = (x: number, y: number, text: string, opts?: { font?: typeof fontBold; size?: number; color?: typeof ORANGE }) => {
      if (!text) return;
      page.drawText(text, {
        x,
        y: height - y,
        size: opts?.size || 10,
        font: opts?.font || fontRegular,
        color: opts?.color || DARK_TEXT,
      });
    };

    const drawLine = (x1: number, y: number, x2: number, color = ORANGE, thickness = 1) => {
      page.drawLine({
        start: { x: x1, y: height - y },
        end: { x: x2, y: height - y },
        thickness,
        color,
      });
    };

    const drawRect = (x: number, y: number, w: number, h: number, color: typeof ORANGE) => {
      page.drawRectangle({
        x,
        y: height - y - h,
        width: w,
        height: h,
        color,
      });
    };

    // ===================================================
    // HEADER — Logo + Titre Association
    // ===================================================

    // Bande orange en haut
    drawRect(0, 0, width, 4, ORANGE);

    // Essayer de charger le logo
    try {
      const logoPath = path.join(process.cwd(), 'public', 'GLOGO GED NEW.png');
      const logoBytes = await readFile(logoPath);
      const logoImage = await pdfDoc.embedPng(logoBytes);
      const logoDims = logoImage.scale(0.15);
      page.drawImage(logoImage, {
        x: 40,
        y: height - 85,
        width: logoDims.width,
        height: logoDims.height,
      });
    } catch {
      // Si logo manquant, on continue sans
    }

    // Titre association
    write(120, 30, 'Association Groupe et Découverte', { font: fontBold, size: 16, color: ORANGE });
    write(120, 50, 'Colonies de vacances - Séjours de distanciation', { size: 11, color: GRAY_TEXT });

    // ===================================================
    // DESTINATAIRE — Structure sociale (en haut à droite)
    // ===================================================
    const destX = 340;
    write(destX, 100, p.structure_nom, { font: fontBold, size: 11 });
    write(destX, 115, p.structure_adresse, { size: 10 });
    write(destX, 130, `${p.structure_cp} ${p.structure_ville}`, { size: 10 });

    // Date et lieu
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    write(destX, 160, `Saint-Etienne, le ${today}`, { size: 10, color: GRAY_TEXT });

    // ===================================================
    // TITRE — Proposition Tarifaire
    // ===================================================
    write(40, 200, 'Proposition Tarifaire', { font: fontBold, size: 20 });
    drawLine(40, 210, 555, ORANGE, 2);

    // ===================================================
    // INFOS INSCRIPTION
    // ===================================================
    const labelX = 40;
    const valueX = 200;
    let curY = 240;

    const writeRow = (label: string, value: string, bold = false) => {
      write(labelX, curY, label, { size: 10, color: GRAY_TEXT });
      write(valueX, curY, value, { font: bold ? fontBold : fontRegular, size: 10 });
      curY += 20;
    };

    writeRow('De l\'inscrit :', `${p.enfant_nom.toUpperCase()} ${p.enfant_prenom}`, true);
    writeRow('Concerne le séjour :', p.sejour_titre, true);

    // Activités — peut être long, on le met en plus petit
    if (p.sejour_activites) {
      write(labelX, curY, 'Activité(s) :', { size: 10, color: GRAY_TEXT });
      // Tronquer si trop long
      const activites = String(p.sejour_activites).slice(0, 100);
      write(valueX, curY, activites, { font: fontBold, size: 9, color: ORANGE });
      curY += 20;
    }

    writeRow('Pour la période du :', `${formatDate(p.session_start)} au ${formatDate(p.session_end)}`, true);
    writeRow('Numéro d\'agrément DSCS:', p.agrement_dscs || '069ORG0667', true);

    // ===================================================
    // TARIFICATION
    // ===================================================
    curY += 10;
    drawLine(40, curY, 555, LIGHT_GRAY, 1);
    curY += 20;

    const priceValueX = 200;

    const writePriceRow = (label: string, value: string) => {
      write(labelX, curY, label, { size: 11 });
      write(priceValueX, curY, value, { font: fontBold, size: 11 });
      curY += 22;
    };

    writePriceRow('Montant du séjour :', formatPrice(Number(p.prix_sejour)));
    writePriceRow('Transport :', formatPrice(Number(p.prix_transport)));
    writePriceRow('Encadrement :', p.encadrement ? formatPrice(Number(p.prix_encadrement)) : '0 €');
    writePriceRow('Adhésion :', p.adhesion || 'Comprise');

    // Options
    write(labelX, curY, 'Options :', { size: 10 });
    const optionsText = p.options || 'Tranquillité : recherche individualisée, veille éducative, informations mise en lien, bilans.';
    // Wrap options text
    const maxCharsPerLine = 65;
    const optLine1 = optionsText.slice(0, maxCharsPerLine);
    const optLine2 = optionsText.slice(maxCharsPerLine, maxCharsPerLine * 2);
    write(priceValueX, curY, optLine1, { font: fontBold, size: 9 });
    if (optLine2) {
      curY += 14;
      write(priceValueX, curY, optLine2, { font: fontBold, size: 9 });
    }
    curY += 30;

    // Total
    drawLine(40, curY - 5, 555, ORANGE, 2);
    curY += 5;
    write(labelX, curY, 'Total Séjour :', { font: fontBold, size: 14 });
    write(priceValueX, curY, formatPrice(Number(p.prix_total)), { font: fontBold, size: 14, color: ORANGE });
    curY += 15;
    drawLine(40, curY, 555, ORANGE, 2);

    // ===================================================
    // ZONE BON POUR ACCORD
    // ===================================================
    curY += 40;

    // Cadre gris clair
    drawRect(40, curY, width - 80, 120, rgb(0.96, 0.96, 0.96));

    curY += 20;
    write(60, curY, 'BON POUR ACCORD', { font: fontBold, size: 14, color: ORANGE });
    curY += 25;
    write(60, curY, 'Nom et qualité du signataire : ____________________________________', { size: 10 });
    curY += 25;
    write(60, curY, 'Date : ____/____/________', { size: 10 });
    write(300, curY, 'Signature et cachet :', { size: 10 });

    // ===================================================
    // PIED DE PAGE
    // ===================================================
    const footerY = 790;
    drawLine(40, footerY, 555, ORANGE, 1);

    write(120, footerY + 12, 'ASSOCIATION GROUPE ET DÉCOUVERTE', { font: fontBold, size: 8 });
    write(155, footerY + 24, '3 rue Flobert 42 000 Saint-Etienne', { size: 7, color: GRAY_TEXT });
    write(110, footerY + 34, 'Tél : 04 23 16 16 71 - Mail : contact@groupeetdecouverte.fr', { size: 7, color: GRAY_TEXT });
    write(175, footerY + 44, 'www.groupeetdecouverte.fr', { size: 7, color: ORANGE });
    write(65, footerY + 56, 'Association loi 1901, N° Agrément préfectoral 069ORG0667 - N° Siret 51522565400026', { size: 6, color: GRAY_TEXT });

    // Générer le PDF
    const pdfBytes = await pdfDoc.save();

    const filename = `Proposition_Tarifaire_${p.enfant_nom}_${p.enfant_prenom}.pdf`;

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('PDF generation error:', error);
    return NextResponse.json({ error: error.message || 'Erreur génération PDF' }, { status: 500 });
  }
}
