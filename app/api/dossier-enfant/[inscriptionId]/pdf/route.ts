export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readFile } from 'fs/promises';
import path from 'path';

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

type DocType = 'bulletin' | 'sanitaire' | 'liaison';

const TEMPLATE_FILES: Record<DocType, string> = {
  bulletin: 'bulletin-inscription-template.pdf',
  sanitaire: 'fiche-sanitaire-template.pdf',
  liaison: 'fiche-liaison-template.pdf',
};

/**
 * GET /api/dossier-enfant/[inscriptionId]/pdf?token=xxx&type=bulletin|sanitaire|liaison
 * Génère un PDF fidèle au modèle officiel en superposant les données saisies sur le template.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { inscriptionId: string } }
) {
  try {
    const { inscriptionId } = params;
    const token = req.nextUrl.searchParams.get('token');
    const docType = req.nextUrl.searchParams.get('type') as DocType;

    if (!token || !inscriptionId || !docType) {
      return NextResponse.json(
        { error: { code: 'MISSING_PARAMS', message: 'Paramètres manquants (token, type).' } },
        { status: 400 }
      );
    }

    if (!TEMPLATE_FILES[docType]) {
      return NextResponse.json(
        { error: { code: 'INVALID_TYPE', message: 'Type de document invalide.' } },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Vérifier ownership
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token) || !uuidRegex.test(inscriptionId)) {
      return NextResponse.json(
        { error: { code: 'INVALID_PARAMS', message: 'Paramètres invalides.' } },
        { status: 400 }
      );
    }

    const { data: sourceRaw } = await supabase
      .from('gd_inscriptions')
      .select('referent_email')
      .eq('suivi_token', token)
      .single();
    const source = sourceRaw as { referent_email: string } | null;
    if (!source) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Token invalide.' } }, { status: 404 });
    }

    const { data: targetRaw } = await supabase
      .from('gd_inscriptions')
      .select('referent_email, jeune_prenom, jeune_nom, jeune_date_naissance, sejour_slug, session_date, referent_nom, organisation, city_departure')
      .eq('id', inscriptionId)
      .single();
    const inscription = targetRaw as Record<string, string> | null;
    if (!inscription || inscription.referent_email !== source.referent_email) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Accès non autorisé.' } }, { status: 403 });
    }

    // Charger le dossier enfant
    const { data: dossierRaw } = await supabase
      .from('gd_dossier_enfant')
      .select('*')
      .eq('inscription_id', inscriptionId)
      .maybeSingle();

    const dossier = dossierRaw as Record<string, unknown> | null;
    if (!dossier) {
      return NextResponse.json(
        { error: { code: 'NO_DATA', message: 'Aucune donnée saisie pour ce dossier.' } },
        { status: 404 }
      );
    }

    // Charger le template PDF
    const templatePath = path.join(process.cwd(), 'public', 'templates', TEMPLATE_FILES[docType]);
    const templateBytes = await readFile(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const fontSize = 9;
    const textColor = rgb(0.1, 0.1, 0.1);

    // Fonction helper pour écrire du texte
    const writeText = (pageIndex: number, x: number, y: number, text: string, options?: { bold?: boolean; size?: number }) => {
      const page = pdfDoc.getPages()[pageIndex];
      if (!page || !text) return;
      const { height } = page.getSize();
      page.drawText(String(text).slice(0, 100), {
        x,
        y: height - y, // Convertir coordonnées top-down en bottom-up PDF
        size: options?.size || fontSize,
        font: options?.bold ? fontBold : font,
        color: textColor,
      });
    };

    // Fonction helper pour checkbox (X ou coche)
    const writeCheck = (pageIndex: number, x: number, y: number, checked: boolean) => {
      if (checked) {
        writeText(pageIndex, x, y, 'X', { bold: true, size: 10 });
      }
    };

    // === Overlay selon le type de document ===
    if (docType === 'bulletin') {
      const d = (dossier.bulletin_complement || {}) as Record<string, unknown>;
      // Coordonnées — Page 1 du bulletin d'inscription
      // Ces coordonnées sont calibrées sur le template GED 2026
      writeText(0, 230, 118, inscription.jeune_prenom);
      writeText(0, 230, 138, inscription.jeune_nom);
      writeText(0, 230, 158, inscription.referent_nom);
      writeText(0, 230, 178, (d.adresse_permanente as string) || '');
      writeText(0, 470, 118, inscription.jeune_date_naissance);
      writeText(0, 470, 158, inscription.referent_email || '');

      // Contact urgence
      writeText(0, 200, 393, (d.contact_urgence_nom as string) || '');
      writeText(0, 460, 393, (d.contact_urgence_adresse as string) || '');
      writeText(0, 200, 413, (d.contact_urgence_lien as string) || '');
      writeText(0, 460, 413, (d.contact_urgence_telephone as string) || '');

    } else if (docType === 'sanitaire') {
      const d = (dossier.fiche_sanitaire || {}) as Record<string, unknown>;
      // Page 1 — L'enfant
      writeText(0, 195, 157, inscription.jeune_nom);
      writeText(0, 195, 177, inscription.jeune_prenom);
      writeText(0, 195, 197, inscription.jeune_date_naissance);
      writeText(0, 455, 140, (d.classe as string) || '');
      writeCheck(0, 430, 162, d.sexe === 'garcon');
      writeCheck(0, 490, 162, d.sexe === 'fille');
      writeCheck(0, 389, 220, !!d.pai);
      writeCheck(0, 454, 220, !!d.aeeh);

      // Responsable 1
      writeText(0, 100, 312, (d.resp1_nom as string) || '');
      writeText(0, 100, 332, (d.resp1_prenom as string) || '');
      writeText(0, 100, 352, (d.resp1_parente as string) || '');
      writeText(0, 100, 372, (d.resp1_adresse as string) || '');
      writeText(0, 100, 422, (d.resp1_profession as string) || '');
      writeText(0, 100, 452, (d.resp1_email as string) || '');
      writeText(0, 100, 482, (d.resp1_tel_domicile as string) || '');
      writeText(0, 100, 502, (d.resp1_tel_portable as string) || '');
      writeText(0, 100, 522, (d.resp1_tel_travail as string) || '');

      // Responsable 2
      writeText(0, 380, 312, (d.resp2_nom as string) || '');
      writeText(0, 380, 332, (d.resp2_prenom as string) || '');
      writeText(0, 380, 352, (d.resp2_parente as string) || '');
      writeText(0, 380, 372, (d.resp2_adresse as string) || '');
      writeText(0, 380, 422, (d.resp2_profession as string) || '');
      writeText(0, 380, 452, (d.resp2_email as string) || '');
      writeText(0, 380, 482, (d.resp2_tel_domicile as string) || '');
      writeText(0, 380, 502, (d.resp2_tel_portable as string) || '');
      writeText(0, 380, 522, (d.resp2_tel_travail as string) || '');

      // CAF
      writeText(0, 230, 542, (d.allocataire_caf_msa as string) || '');
      writeText(0, 460, 542, (d.quotient_familial as string) || '');

      // Page 2 — Médical
      writeText(1, 210, 88, (d.medecin_nom as string) || '');
      writeText(1, 430, 88, (d.medecin_tel as string) || '');
      writeText(1, 80, 280, (d.poids as string) || '');
      writeText(1, 80, 300, (d.taille as string) || '');

      // Recommandations
      writeText(1, 80, 602, (d.recommandations_parents as string) || '');

      // Autorisation
      writeText(1, 140, 680, (d.autorisation_soins_soussigne as string) || '');

    } else if (docType === 'liaison') {
      const d = (dossier.fiche_liaison_jeune || {}) as Record<string, unknown>;
      // Page 1
      writeText(0, 190, 244, inscription.jeune_nom);
      writeText(0, 370, 244, inscription.jeune_prenom);
      writeText(0, 500, 244, inscription.jeune_date_naissance);
      writeText(0, 190, 269, (d.etablissement_nom as string) || '');
      writeText(0, 100, 289, (d.etablissement_adresse as string) || '');
      writeText(0, 200, 309, (d.etablissement_cp as string) || '');
      writeText(0, 330, 309, (d.etablissement_ville as string) || '');

      // Responsable établissement
      writeText(0, 200, 376, (d.resp_etablissement_nom as string) || '');
      writeText(0, 410, 376, (d.resp_etablissement_prenom as string) || '');
      writeText(0, 180, 396, (d.resp_etablissement_tel1 as string) || '');
      writeText(0, 410, 396, (d.resp_etablissement_tel2 as string) || '');

      // Partie jeune
      writeText(0, 80, 530, (d.pourquoi_ce_sejour as string) || '');
    }

    // Générer le PDF final
    const pdfBytes = await pdfDoc.save();

    // Noms de fichier
    const fileNames: Record<DocType, string> = {
      bulletin: `Bulletin_Inscription_${inscription.jeune_prenom}_${inscription.jeune_nom}.pdf`,
      sanitaire: `Fiche_Sanitaire_${inscription.jeune_prenom}_${inscription.jeune_nom}.pdf`,
      liaison: `Fiche_Liaison_${inscription.jeune_prenom}_${inscription.jeune_nom}.pdf`,
    };

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileNames[docType]}"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur de génération PDF.' } },
      { status: 500 }
    );
  }
}
