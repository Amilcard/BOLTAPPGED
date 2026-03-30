export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readFile } from 'fs/promises';
import path from 'path';
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
  { params }: { params: Promise<{ inscriptionId: string }> }
) {
  try {
    const { inscriptionId } = await params;
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

    // Résoudre le nom commercial du séjour (marketing_title > slug)
    const { data: stayRaw } = await supabase
      .from('gd_stays')
      .select('marketing_title')
      .eq('slug', inscription.sejour_slug)
      .maybeSingle();
    const sejourNom = (stayRaw as { marketing_title?: string } | null)?.marketing_title
      || inscription.sejour_slug
      || '';

    // Charger le template PDF — path traversal guard
    const baseDir = path.resolve(process.cwd(), 'public', 'templates');
    const templateFilename = TEMPLATE_FILES[docType]; // static lookup — docType already validated via whitelist above
    const resolvedPath = path.normalize(path.join(baseDir, templateFilename));
    if (!resolvedPath.startsWith(baseDir + path.sep)) {
      return NextResponse.json(
        { error: { code: 'INVALID_PATH', message: 'Chemin de template invalide.' } },
        { status: 400 }
      );
    }
    const safePath = resolvedPath; // guard confirmed above
    const templateBytes = await readFile(safePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const fontSize = 9;
    const smallFontSize = 8;
    const textColor = rgb(0.1, 0.1, 0.1);

    /**
     * Écrire du texte sur le PDF.
     * Les coordonnées (x, y) sont en top-down (origine en haut à gauche),
     * converties en bottom-up pour pdf-lib.
     */
    const writeText = (pageIndex: number, x: number, y: number, text: string, options?: { bold?: boolean; size?: number }) => {
      const page = pdfDoc.getPages()[pageIndex];
      if (!page || !text) return;
      const { height } = page.getSize();
      page.drawText(String(text).slice(0, 120), {
        x,
        y: height - y,
        size: options?.size || fontSize,
        font: options?.bold ? fontBold : font,
        color: textColor,
      });
    };

    /** Écrire un X pour une checkbox cochée. */
    const writeCheck = (pageIndex: number, x: number, y: number, checked: boolean) => {
      if (checked) {
        writeText(pageIndex, x, y, 'X', { bold: true, size: 11 });
      }
    };

    /** Helper pour string safe */
    const s = (val: unknown): string => (typeof val === 'string' ? val : (val ? String(val) : ''));

    /** Formater une date ISO (YYYY-MM-DD ou YYYY-MM-DDThh…) en DD/MM/YYYY */
    const formatDate = (iso: string): string => {
      if (!iso) return '';
      const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!match) return iso;
      return `${match[3]}/${match[2]}/${match[1]}`;
    };

    // ========================================================================
    // BULLETIN D'INSCRIPTION
    // Calibré sur bulletin-inscription-template.pdf (595.276 x 841.89, 1 page)
    // ========================================================================
    if (docType === 'bulletin') {
      const d   = (dossier.bulletin_complement || {}) as Record<string, unknown>;
      const san = (dossier.fiche_sanitaire    || {}) as Record<string, unknown>;

      // --- COORDONNÉES (haut de page) ---
      writeText(0, 160, 79,  inscription.jeune_prenom);
      writeText(0, 416, 79,  formatDate(inscription.jeune_date_naissance));

      writeText(0, 160, 95,  inscription.jeune_nom);
      writeText(0, 416, 95,  s(san.sexe));                         // sexe → fiche_sanitaire

      writeText(0, 160, 111, inscription.referent_nom);
      writeText(0, 416, 111, s(san.resp1_tel_portable) || '');     // tél responsable → fiche_sanitaire

      writeText(0, 160, 127, s(d.adresse_permanente));
      writeText(0, 416, 127, s(d.mail) || inscription.referent_email || '');

      // --- SÉJOURS CHOISIS ---
      writeText(0, 35,  185, sejourNom,                            { size: smallFontSize });
      writeText(0, 142, 185, formatDate(inscription.session_date), { size: smallFontSize });
      writeText(0, 250, 185, inscription.city_departure || '',     { size: smallFontSize });

      // --- ORGANISATION DU DÉPART ET DU RETOUR ---
      writeText(0, 120, 266, s(d.adresse_depart_nom));
      writeText(0, 376, 266, s(d.adresse_depart_adresse));
      writeText(0, 120, 282, s(d.adresse_depart_lien));
      writeText(0, 376, 282, s(d.adresse_depart_telephone));

      writeText(0, 120, 314, s(d.adresse_retour_nom));
      writeText(0, 376, 314, s(d.adresse_retour_adresse));
      writeText(0, 120, 330, s(d.adresse_retour_lien));
      writeText(0, 376, 330, s(d.adresse_retour_telephone));

      // --- ENVOI DE LA FICHE DE LIAISON (choix utilisateur) ---
      // La convocation est gérée par GED après validation du dossier, hors périmètre ici.
      const envoiFicheLiaison = s(d.envoi_fiche_liaison);
      writeCheck(0, 150, 375, envoiFicheLiaison === 'permanente');
      writeCheck(0, 150, 397, envoiFicheLiaison === 'depart');
      writeCheck(0, 150, 419, envoiFicheLiaison === 'retour');

      // --- PERSONNE À CONTACTER EN CAS D'URGENCE ---
      writeText(0, 120, 468, s(d.contact_urgence_nom));
      writeText(0, 376, 468, s(d.contact_urgence_adresse));
      writeText(0, 120, 484, s(d.contact_urgence_lien));
      writeText(0, 376, 484, s(d.contact_urgence_telephone));

      // --- FINANCEMENT ---
      writeCheck(0, 35, 580, s(d.financement_ase)           === 'true' || d.financement_ase           === true);
      writeCheck(0, 35, 596, s(d.financement_etablissement) === 'true' || d.financement_etablissement === true);
      writeCheck(0, 35, 612, s(d.financement_famille)       === 'true' || d.financement_famille       === true);
      writeCheck(0, 35, 628, s(d.financement_autres)        === 'true' || d.financement_autres        === true);
      if (s(d.financement_montants)) {
        writeText(0, 100, 628, s(d.financement_montants), { size: smallFontSize });
      }

      // --- AUTORISATION LÉGALE ---
      writeText(0, 102, 703, s(d.soussigne_nom) || inscription.referent_nom);
      writeText(0, 56,  743, s(d.autorisation_fait_a));
      writeText(0, 280, 743, s(d.date_signature) || new Date().toLocaleDateString('fr-FR'));

    // ========================================================================
    // FICHE SANITAIRE DE LIAISON
    // Calibré sur fiche-sanitaire-template.pdf (594.96 x 842.25, 2 pages)
    // ========================================================================
    } else if (docType === 'sanitaire') {
      const d = (dossier.fiche_sanitaire || {}) as Record<string, unknown>;

      // ──── PAGE 1 ────

      // 1. L'ENFANT
      writeText(0, 438, 170, s(d.classe));
      writeText(0, 140, 183, inscription.jeune_nom);
      writeCheck(0, 350, 187, s(d.sexe) === 'garcon');
      writeCheck(0, 412, 187, s(d.sexe) === 'fille');
      writeText(0, 100, 199, inscription.jeune_prenom);
      writeText(0, 138, 216, formatDate(inscription.jeune_date_naissance));

      writeCheck(0, 457, 200, s(d.sieste) === 'oui');
      writeCheck(0, 497, 218, s(d.sieste) === 'non');

      writeCheck(0, 166, 250, s(d.pai)  === 'true' || d.pai  === true);
      writeCheck(0, 318, 250, s(d.aeeh) === 'true' || d.aeeh === true);

      // 2. LES RESPONSABLES LÉGAUX
      writeText(0, 65,  345, s(d.resp1_nom));
      writeText(0, 90,  362, s(d.resp1_prenom));
      writeText(0, 71,  378, s(d.resp1_parente));
      writeText(0, 90,  395, s(d.resp1_adresse),       { size: smallFontSize });
      writeText(0, 27,  411, s(d.resp1_adresse_suite),  { size: smallFontSize });
      writeText(0, 27,  427, s(d.resp1_cp_ville),       { size: smallFontSize });
      writeText(0, 100, 444, s(d.resp1_profession));
      writeText(0, 230, 472, s(d.resp1_email),          { size: smallFontSize });
      writeText(0, 27,  490, s(d.resp1_email),          { size: smallFontSize }); // continuation si long
      writeText(0, 98,  507, s(d.resp1_tel_domicile));
      writeText(0, 97,  523, s(d.resp1_tel_portable));
      writeText(0, 100, 540, s(d.resp1_tel_travail));

      writeText(0, 350, 322, s(d.resp2_nom));
      writeText(0, 370, 336, s(d.resp2_prenom));
      writeText(0, 356, 350, s(d.resp2_parente));
      writeText(0, 370, 364, s(d.resp2_adresse),       { size: smallFontSize });
      writeText(0, 309, 392, s(d.resp2_adresse_suite),  { size: smallFontSize });
      writeText(0, 309, 420, s(d.resp2_cp_ville),       { size: smallFontSize });
      writeText(0, 380, 448, s(d.resp2_profession));
      writeText(0, 345, 462, s(d.resp2_email),          { size: smallFontSize });
      writeText(0, 309, 477, s(d.resp2_email),          { size: smallFontSize }); // continuation
      writeText(0, 382, 493, s(d.resp2_tel_domicile));
      writeText(0, 381, 510, s(d.resp2_tel_portable));
      writeText(0, 395, 526, s(d.resp2_tel_travail));

      writeText(0, 183, 557, s(d.allocataire_caf_msa));
      writeText(0, 415, 557, s(d.quotient_familial));

      // 3. LES DÉLÉGATIONS
      const delegations = [
        { nom: s(d.delegation_1_nom), prenom: s(d.delegation_1_prenom), lien: s(d.delegation_1_lien), tel: s(d.delegation_1_tel) },
        { nom: s(d.delegation_2_nom), prenom: s(d.delegation_2_prenom), lien: s(d.delegation_2_lien), tel: s(d.delegation_2_tel) },
        { nom: s(d.delegation_3_nom), prenom: s(d.delegation_3_prenom), lien: s(d.delegation_3_lien), tel: s(d.delegation_3_tel) },
      ];
      delegations.forEach((del, i) => {
        const rowY = 656 + i * 16;
        writeText(0, 35,  rowY, del.nom,    { size: smallFontSize });
        writeText(0, 155, rowY, del.prenom, { size: smallFontSize });
        writeText(0, 300, rowY, del.lien,   { size: smallFontSize });
        writeText(0, 420, rowY, del.tel,    { size: smallFontSize });
      });

      // ──── PAGE 2 ────

      // 4. LES VACCINATIONS
      writeText(1, 173, 46, s(d.medecin_nom));
      writeText(1, 374, 46, s(d.medecin_tel));

      // ROR : le formulaire groupe Rubéole/Oreillons/Rougeole en une clé unique.
      // Le template GED a 3 lignes séparées → on reporte la même valeur OUI/NON + date.
      const rorVal  = s(d.vaccin_rubeole_oreillons_rougeole);
      const rorDate = s(d.vaccin_rubeole_oreillons_rougeole_date);

      const vaccins: { key: string; ror?: true }[] = [
        { key: 'diphterie' },
        { key: 'tetanos' },
        { key: 'poliomyelite' },
        { key: 'coqueluche' },
        { key: 'haemophilus' },
        { key: 'hepatite_b' },
        { key: 'rougeole',  ror: true },
        { key: 'oreillons', ror: true },
        { key: 'rubeole',   ror: true },
        { key: 'meningocoque_c' },
        { key: 'pneumocoque' },
      ];

      vaccins.forEach((v, i) => {
        const rowY = 80 + i * 9;
        const val  = v.ror ? rorVal  : s(d[`vaccin_${v.key}`]);
        const date = v.ror ? rorDate : s(d[`vaccin_${v.key}_date`]);
        writeCheck(1, 260, rowY, val === 'oui');
        writeCheck(1, 340, rowY, val === 'non');
        if (date) writeText(1, 430, rowY, date, { size: 7 });
      });

      // 5. RENSEIGNEMENTS MÉDICAUX
      writeText(1, 74, 247, s(d.poids));
      writeText(1, 72, 267, s(d.taille));

      writeCheck(1, 472, 258, s(d.traitement_en_cours) === 'true' || d.traitement_en_cours === true);
      writeCheck(1, 520, 258, s(d.traitement_en_cours) === 'false' || d.traitement_en_cours === false);
      if (s(d.traitement_detail)) {
        writeText(1, 35, 278, s(d.traitement_detail), { size: smallFontSize });
      }

      // Allergies — construire depuis les clés distinctes du formulaire
      const allergiesParts: string[] = [];
      if (s(d.allergie_asthme)         === 'oui') allergiesParts.push('Asthme');
      if (s(d.allergie_alimentaire)    === 'oui') allergiesParts.push('Alimentaire');
      if (s(d.allergie_medicamenteuse) === 'oui') allergiesParts.push('Médicamenteuse');
      if (s(d.allergie_autres))                   allergiesParts.push(s(d.allergie_autres));
      if (s(d.allergie_detail))                   allergiesParts.push(s(d.allergie_detail));
      const allergiesText = allergiesParts.join(' — ');
      if (allergiesText) {
        writeText(1, 35, 330, allergiesText, { size: smallFontSize });
      }

      // Antécédents médicaux / chirurgicaux
      if (s(d.probleme_sante_detail)) {
        writeText(1, 35, 390, s(d.probleme_sante_detail), { size: smallFontSize });
      }

      // Recommandations des parents
      if (s(d.recommandations_parents)) {
        writeText(1, 35, 490, s(d.recommandations_parents), { size: smallFontSize });
      }

      // Remarques complémentaires
      if (s(d.remarques)) {
        writeText(1, 35, 550, s(d.remarques), { size: smallFontSize });
      }

      // Autorisation de soins
      writeText(1, 102, 727, s(d.autorisation_soins_soussigne));
      writeText(1, 100, 755, s(d.fait_a));
      writeText(1, 300, 755, s(d.date_signature) || new Date().toLocaleDateString('fr-FR'));

    // ========================================================================
    // FICHE DE LIAISON — PAGE 1 (Jeune / Éducateur/trice)
    // Calibré sur fiche-liaison-template.pdf (595.32 x 841.92, 3 pages)
    // Pages 2-3 (avant-séjour, compte rendu) : usage interne GED, non remplies en ligne.
    // ========================================================================
    } else if (docType === 'liaison') {
      const d = (dossier.fiche_liaison_jeune || {}) as Record<string, unknown>;

      // RENSEIGNEMENTS CONCERNANT LE JEUNE
      writeText(0, 115, 213, inscription.jeune_nom);
      writeText(0, 290, 213, inscription.jeune_prenom);
      writeText(0, 494, 213, formatDate(inscription.jeune_date_naissance), { size: smallFontSize });

      writeText(0, 159, 237, s(d.etablissement_nom));
      writeText(0, 87,  261, s(d.etablissement_adresse));
      writeText(0, 105, 285, s(d.etablissement_cp));
      writeText(0, 233, 285, s(d.etablissement_ville));

      writeText(0, 163, 332, sejourNom);
      writeText(0, 123, 356, formatDate(inscription.session_date));

      writeText(0, 74,  416, s(d.resp_etablissement_nom));
      writeText(0, 369, 416, s(d.resp_etablissement_prenom));
      writeText(0, 121, 440, s(d.resp_etablissement_tel1));
      writeText(0, 366, 440, s(d.resp_etablissement_tel2));

      // PARTIE À REMPLIR PAR LE JEUNE
      writeCheck(0, 76,  511, s(d.choix_seul)      === 'oui');
      writeCheck(0, 106, 511, s(d.choix_seul)      === 'non');
      writeCheck(0, 245, 511, s(d.choix_ami)       === 'oui');
      writeCheck(0, 274, 511, s(d.choix_ami)       === 'non');
      writeCheck(0, 496, 511, s(d.choix_educateur) === 'oui');
      writeCheck(0, 526, 511, s(d.choix_educateur) === 'non');

      writeCheck(0, 230, 530, s(d.deja_parti) === 'oui');
      writeCheck(0, 259, 530, s(d.deja_parti) === 'non');

      if (s(d.deja_parti_detail)) {
        writeText(0, 131, 547, s(d.deja_parti_detail), { size: smallFontSize });
      }

      if (s(d.pourquoi_ce_sejour)) {
        const text = s(d.pourquoi_ce_sejour);
        const maxChars = 85;
        writeText(0, 37, 581, text.slice(0, maxChars),           { size: smallFontSize });
        if (text.length > maxChars) {
          writeText(0, 37, 598, text.slice(maxChars, maxChars * 2), { size: smallFontSize });
        }
      }

      writeCheck(0, 303, 617, s(d.fiche_technique_lue) === 'oui');
      writeCheck(0, 333, 617, s(d.fiche_technique_lue) === 'non');

      // ENGAGEMENT
      writeText(0, 80,  740, s(d.signature_fait_a));
      writeText(0, 280, 740, new Date().toLocaleDateString('fr-FR'));
    }

    // Générer le PDF final
    const pdfBytes = await pdfDoc.save();

    const fileNames: Record<DocType, string> = {
      bulletin: `Bulletin_Inscription_${inscription.jeune_prenom}_${inscription.jeune_nom}.pdf`,
      sanitaire: `Fiche_Sanitaire_${inscription.jeune_prenom}_${inscription.jeune_nom}.pdf`,
      liaison: `Fiche_Liaison_${inscription.jeune_prenom}_${inscription.jeune_nom}.pdf`,
    };

    const fileName = Object.prototype.hasOwnProperty.call(fileNames, docType) ? fileNames[docType] : `document_${inscription.jeune_prenom}_${inscription.jeune_nom}.pdf`;

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
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
