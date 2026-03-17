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

    /**
     * Écrire un X pour une checkbox cochée.
     */
    const writeCheck = (pageIndex: number, x: number, y: number, checked: boolean) => {
      if (checked) {
        writeText(pageIndex, x, y, 'X', { bold: true, size: 11 });
      }
    };

    /** Helper pour string safe */
    const s = (val: unknown): string => (typeof val === 'string' ? val : (val ? String(val) : ''));

    // ========================================================================
    // BULLETIN D'INSCRIPTION
    // Calibré sur bulletin-inscription-template.pdf (595.276 x 841.89, 1 page)
    // ========================================================================
    if (docType === 'bulletin') {
      const d = (dossier.bulletin_complement || {}) as Record<string, unknown>;

      // --- COORDONNÉES (haut de page) ---
      // Prénom du participant : ……… | Date de naissance : ………
      writeText(0, 160, 79, inscription.jeune_prenom);
      writeText(0, 416, 79, inscription.jeune_date_naissance);

      // NOM du participant : ……… | Sexe : ………
      writeText(0, 160, 95, inscription.jeune_nom);
      writeText(0, 416, 95, s(d.sexe) || '');

      // Nom du responsable légal : ……… | Téléphone : ………
      writeText(0, 160, 111, inscription.referent_nom);
      writeText(0, 416, 111, s(d.telephone) || inscription.referent_email || '');

      // Adresse permanente : ……… | Mail : ………
      writeText(0, 160, 127, s(d.adresse_permanente));
      writeText(0, 416, 127, s(d.mail) || inscription.referent_email || '');

      // --- SÉJOURS CHOISIS (table, row 1) ---
      // Headers at y≈166 : NOM DU SÉJOUR | DATES | VILLE DE DÉPART | VILLE DE RETOUR
      // Row 1 at y≈180
      writeText(0, 35, 185, inscription.sejour_slug || '', { size: smallFontSize });
      writeText(0, 142, 185, inscription.session_date || '', { size: smallFontSize });
      writeText(0, 250, 185, inscription.city_departure || '', { size: smallFontSize });

      // --- ORGANISATION DU DÉPART ET DU RETOUR ---
      // Adresse de départ
      // Nom : ……… (x=120, y=261.6) | Adresse : ……… (x=376, y=261.6)
      writeText(0, 120, 266, s(d.depart_nom));
      writeText(0, 376, 266, s(d.depart_adresse));
      // Lien avec l'enfant (y=277.7) | Téléphone (y=277.7)
      writeText(0, 120, 282, s(d.depart_lien));
      writeText(0, 376, 282, s(d.depart_telephone));

      // Adresse de retour
      // Nom (y=310) | Adresse (y=310)
      writeText(0, 120, 314, s(d.retour_nom));
      writeText(0, 376, 314, s(d.retour_adresse));
      // Lien (y=326.2) | Téléphone (y=326.2)
      writeText(0, 120, 330, s(d.retour_lien));
      writeText(0, 376, 330, s(d.retour_telephone));

      // --- Documents à envoyer (checkboxes) ---
      // Adresse permanente (y≈371), Adresse de départ (y≈393), Adresse de retour (y≈415)
      // Ces checkboxes sont à x≈150
      writeCheck(0, 150, 375, s(d.envoi_adresse_permanente) === 'true' || d.envoi_adresse_permanente === true);
      writeCheck(0, 150, 397, s(d.envoi_adresse_depart) === 'true' || d.envoi_adresse_depart === true);
      writeCheck(0, 150, 419, s(d.envoi_adresse_retour) === 'true' || d.envoi_adresse_retour === true);

      // --- PERSONNE À CONTACTER EN CAS D'URGENCE ---
      // Nom (x=120, y=464) | Adresse (x=376, y=464)
      writeText(0, 120, 468, s(d.contact_urgence_nom));
      writeText(0, 376, 468, s(d.contact_urgence_adresse));
      // Lien (x=120, y=480.1) | Téléphone (x=376, y=480.1)
      writeText(0, 120, 484, s(d.contact_urgence_lien));
      writeText(0, 376, 484, s(d.contact_urgence_telephone));

      // --- FINANCEMENT ---
      // Checkboxes financement (ASE, établissement, famille, etc.)
      // Positions approximatives : y≈575-620
      writeCheck(0, 35, 580, s(d.financement_ase) === 'true' || d.financement_ase === true);
      writeCheck(0, 35, 596, s(d.financement_etablissement) === 'true' || d.financement_etablissement === true);
      writeCheck(0, 35, 612, s(d.financement_famille) === 'true' || d.financement_famille === true);
      writeCheck(0, 35, 628, s(d.financement_autre) === 'true' || d.financement_autre === true);
      if (s(d.financement_autre_detail)) {
        writeText(0, 100, 628, s(d.financement_autre_detail), { size: smallFontSize });
      }

      // --- AUTORISATION LÉGALE ---
      // Je soussigné (y≈699, x≈102)
      writeText(0, 102, 703, s(d.soussigne_nom));
      // Fait à (y≈739, x≈56)
      writeText(0, 56, 743, s(d.fait_a));
      // Date — à droite du "Fait à"
      writeText(0, 280, 743, s(d.date_signature) || new Date().toLocaleDateString('fr-FR'));

    // ========================================================================
    // FICHE SANITAIRE DE LIAISON
    // Calibré sur fiche-sanitaire-template.pdf (594.96 x 842.25, 2 pages)
    // ========================================================================
    } else if (docType === 'sanitaire') {
      const d = (dossier.fiche_sanitaire || {}) as Record<string, unknown>;

      // ──── PAGE 1 ────

      // 1. L'ENFANT
      // Classe (2025/2026) : x=438, y≈168
      writeText(0, 438, 170, s(d.classe));

      // Nom du mineur : fill at ~x=140, y=183
      writeText(0, 140, 183, inscription.jeune_nom);

      // Sexe : Garçon (checkbox ~x=350, y=187) | Fille (checkbox ~x=412, y=187)
      writeCheck(0, 350, 187, s(d.sexe) === 'garcon');
      writeCheck(0, 412, 187, s(d.sexe) === 'fille');

      // Prénom : fill at ~x=100, y=199
      writeText(0, 100, 199, inscription.jeune_prenom);

      // Date de naissance : fill at ~x=138, y=216
      writeText(0, 138, 216, inscription.jeune_date_naissance);

      // Sieste : OUI (x≈340) / ça dépend / NON
      writeCheck(0, 457, 200, s(d.sieste) === 'oui');
      writeCheck(0, 497, 218, s(d.sieste) === 'non');

      // Enfant détenteur d'un P.A.I. ou bénéficiant de l'AEEH (y≈250)
      // PAI checkbox, AEEH checkbox
      writeCheck(0, 166, 250, s(d.pai) === 'true' || d.pai === true);
      writeCheck(0, 318, 250, s(d.aeeh) === 'true' || d.aeeh === true);

      // 2. LES RESPONSABLES LÉGAUX (y≈303)
      // --- Responsable 1 (payeur) - colonne gauche ---
      writeText(0, 65, 345, s(d.resp1_nom));
      writeText(0, 90, 362, s(d.resp1_prenom));
      writeText(0, 71, 378, s(d.resp1_parente));
      writeText(0, 90, 395, s(d.resp1_adresse), { size: smallFontSize });
      writeText(0, 27, 411, s(d.resp1_adresse_suite), { size: smallFontSize });
      writeText(0, 27, 427, s(d.resp1_cp_ville), { size: smallFontSize });
      writeText(0, 100, 444, s(d.resp1_profession));
      writeText(0, 230, 472, s(d.resp1_email), { size: smallFontSize });
      writeText(0, 27, 490, s(d.resp1_email), { size: smallFontSize }); // continuation si long
      writeText(0, 98, 507, s(d.resp1_tel_domicile));
      writeText(0, 97, 523, s(d.resp1_tel_portable));
      writeText(0, 100, 540, s(d.resp1_tel_travail));

      // --- Responsable 2 - colonne droite ---
      writeText(0, 350, 322, s(d.resp2_nom));
      writeText(0, 370, 336, s(d.resp2_prenom));
      writeText(0, 356, 350, s(d.resp2_parente));
      writeText(0, 370, 364, s(d.resp2_adresse), { size: smallFontSize });
      writeText(0, 309, 392, s(d.resp2_adresse_suite), { size: smallFontSize });
      writeText(0, 309, 420, s(d.resp2_cp_ville), { size: smallFontSize });
      writeText(0, 380, 448, s(d.resp2_profession));
      writeText(0, 345, 462, s(d.resp2_email), { size: smallFontSize });
      writeText(0, 309, 477, s(d.resp2_email), { size: smallFontSize }); // continuation
      writeText(0, 382, 493, s(d.resp2_tel_domicile));
      writeText(0, 381, 510, s(d.resp2_tel_portable));
      writeText(0, 395, 526, s(d.resp2_tel_travail));

      // N° Allocataire CAF/MSA : x≈183, y≈557
      writeText(0, 183, 557, s(d.allocataire_caf_msa));
      // Quotient Familial : x≈415, y≈557
      writeText(0, 415, 557, s(d.quotient_familial));

      // 3. LES DÉLÉGATIONS (y≈578)
      // 3 lignes de délégation : NOM, Prénom, Lien, Tél
      const delegations = [
        { nom: s(d.delegation1_nom), prenom: s(d.delegation1_prenom), lien: s(d.delegation1_lien), tel: s(d.delegation1_tel) },
        { nom: s(d.delegation2_nom), prenom: s(d.delegation2_prenom), lien: s(d.delegation2_lien), tel: s(d.delegation2_tel) },
        { nom: s(d.delegation3_nom), prenom: s(d.delegation3_prenom), lien: s(d.delegation3_lien), tel: s(d.delegation3_tel) },
      ];
      // Table rows at approximately y=650, 665, 680
      delegations.forEach((del, i) => {
        const rowY = 656 + i * 16;
        writeText(0, 35, rowY, del.nom, { size: smallFontSize });
        writeText(0, 155, rowY, del.prenom, { size: smallFontSize });
        writeText(0, 300, rowY, del.lien, { size: smallFontSize });
        writeText(0, 420, rowY, del.tel, { size: smallFontSize });
      });

      // ──── PAGE 2 ────

      // 4. LES VACCINATIONS
      // Nom du médecin traitant : x≈173, y≈46
      writeText(1, 173, 46, s(d.medecin_nom));
      // Tél : x≈374, y≈46
      writeText(1, 374, 46, s(d.medecin_tel));

      // Table de vaccins — 9 vaccins avec OUI/NON et date
      // Les lignes commencent ~y=70 avec un espacement de ~13pt
      const vaccins = [
        { key: 'diphterie', label: 'Diphtérie' },
        { key: 'tetanos', label: 'Tétanos' },
        { key: 'polio', label: 'Poliomyélite' },
        { key: 'coqueluche', label: 'Coqueluche' },
        { key: 'hib', label: 'Haemophilus B' },
        { key: 'hepatite_b', label: 'Hépatite B' },
        { key: 'rougeole', label: 'Rougeole' },
        { key: 'oreillons', label: 'Oreillons' },
        { key: 'rubeole', label: 'Rubéole' },
        { key: 'meningocoque_c', label: 'Méningocoque C' },
        { key: 'pneumocoque', label: 'Pneumocoque' },
      ];

      vaccins.forEach((v, i) => {
        const rowY = 80 + i * 9;
        const val = s(d[`vaccin_${v.key}`]);
        const date = s(d[`vaccin_${v.key}_date`]);
        // OUI checkbox ~x=260, NON ~x=340, Date ~x=430
        writeCheck(1, 260, rowY, val === 'oui');
        writeCheck(1, 340, rowY, val === 'non');
        if (date) writeText(1, 430, rowY, date, { size: 7 });
      });

      // 5. RENSEIGNEMENTS MÉDICAUX (y≈221 page 2)
      // Poids : x≈74, y≈247
      writeText(1, 74, 247, s(d.poids));
      // Taille : x≈72, y≈267
      writeText(1, 72, 267, s(d.taille));

      // Traitement médical OUI (x≈450) / NON (x≈517) at y≈258
      writeCheck(1, 472, 258, s(d.traitement_en_cours) === 'true' || d.traitement_en_cours === true);
      writeCheck(1, 520, 258, s(d.traitement_en_cours) === 'false' || d.traitement_en_cours === false);

      // Allergies connues — zone texte ~y=320
      if (s(d.allergies)) {
        writeText(1, 35, 330, s(d.allergies), { size: smallFontSize });
      }

      // Antécédents médicaux / chirurgicaux — zone ~y=380
      if (s(d.antecedents)) {
        writeText(1, 35, 390, s(d.antecedents), { size: smallFontSize });
      }

      // Recommandations des parents — zone ~y=480
      if (s(d.recommandations_parents)) {
        writeText(1, 35, 490, s(d.recommandations_parents), { size: smallFontSize });
      }

      // Remarques complémentaires — zone ~y=540
      if (s(d.remarques)) {
        writeText(1, 35, 550, s(d.remarques), { size: smallFontSize });
      }

      // Autorisation de soins
      // "Je soussigné" : x≈102, y≈727
      writeText(1, 102, 727, s(d.autorisation_soins_soussigne));
      // "Fait à" — approximation
      writeText(1, 100, 755, s(d.fait_a));
      writeText(1, 300, 755, s(d.date_signature) || new Date().toLocaleDateString('fr-FR'));

    // ========================================================================
    // FICHE DE LIAISON — PAGE 1 (Jeune / Éducateur)
    // Calibré sur fiche-liaison-template.pdf (595.32 x 841.92, 3 pages)
    // Pages 2-3 sont internes GED, non remplies en ligne.
    // ========================================================================
    } else if (docType === 'liaison') {
      const d = (dossier.fiche_liaison_jeune || {}) as Record<string, unknown>;

      // RENSEIGNEMENTS CONCERNANT LE JEUNE
      // Nom du jeune : x≈115, y≈213
      writeText(0, 115, 213, inscription.jeune_nom);
      // Prénom : x≈290, y≈213
      writeText(0, 290, 213, inscription.jeune_prenom);
      // Date de naissance : x≈494, y≈213
      writeText(0, 494, 213, inscription.jeune_date_naissance, { size: smallFontSize });

      // Nom de l'établissement : x≈159, y≈237
      writeText(0, 159, 237, s(d.etablissement_nom));
      // Adresse : x≈87, y≈261
      writeText(0, 87, 261, s(d.etablissement_adresse));
      // Code Postal : x≈105, y≈285 | Ville : x≈233, y≈285
      writeText(0, 105, 285, s(d.etablissement_cp));
      writeText(0, 233, 285, s(d.etablissement_ville));

      // Centre et nom du séjour : x≈163, y≈332
      writeText(0, 163, 332, inscription.sejour_slug || '');
      // Dates du séjour : x≈123, y≈356
      writeText(0, 123, 356, inscription.session_date || '');

      // Responsable de l'établissement joignable
      // Nom : x≈74, y≈416 | Prénom : x≈369, y≈416
      writeText(0, 74, 416, s(d.resp_etablissement_nom));
      writeText(0, 369, 416, s(d.resp_etablissement_prenom));
      // Tél portable 1 : x≈121, y≈440 | Tél portable 2 : x≈366, y≈440
      writeText(0, 121, 440, s(d.resp_etablissement_tel1));
      writeText(0, 366, 440, s(d.resp_etablissement_tel2));

      // PARTIE A REMPLIR PAR LE JEUNE
      // Comment as-tu choisi ton séjour ? (y≈488)
      // Seul/e : oui ☐ x≈76, y≈511 | non ☐ x≈106
      writeCheck(0, 76, 511, s(d.choix_seul) === 'oui');
      writeCheck(0, 106, 511, s(d.choix_seul) === 'non');
      // Avec un/e ami/e : oui ☐ x≈245, y≈511 | non ☐ x≈274
      writeCheck(0, 245, 511, s(d.choix_ami) === 'oui');
      writeCheck(0, 274, 511, s(d.choix_ami) === 'non');
      // Avec l'aide d'un/e éducateur/trice : oui ☐ x≈496, y≈511 | non ☐ x≈526
      writeCheck(0, 496, 511, s(d.choix_educateur) === 'oui');
      writeCheck(0, 526, 511, s(d.choix_educateur) === 'non');

      // Es-tu déjà parti/e en séjour de vacances ? oui ☐ x≈230, y≈530 | non ☐ x≈259
      writeCheck(0, 230, 530, s(d.deja_parti) === 'oui');
      writeCheck(0, 259, 530, s(d.deja_parti) === 'non');

      // Si oui, où et quand ? x≈131, y≈547
      if (s(d.deja_parti_detail)) {
        writeText(0, 131, 547, s(d.deja_parti_detail), { size: smallFontSize });
      }

      // Pourquoi as-tu choisi ce séjour ? (y≈559)
      // Réponse sur lignes : x≈37, y≈581
      if (s(d.pourquoi_ce_sejour)) {
        const text = s(d.pourquoi_ce_sejour);
        // Découper le texte en lignes de ~85 caractères max
        const maxChars = 85;
        const line1 = text.slice(0, maxChars);
        const line2 = text.slice(maxChars, maxChars * 2);
        writeText(0, 37, 581, line1, { size: smallFontSize });
        if (line2) writeText(0, 37, 598, line2, { size: smallFontSize });
      }

      // As-tu pris connaissance de la fiche technique ? oui ☐ x≈303, y≈617 | non ☐ x≈333
      writeCheck(0, 303, 617, s(d.fiche_technique_lue) === 'oui');
      writeCheck(0, 333, 617, s(d.fiche_technique_lue) === 'non');

      // ENGAGEMENT (y≈649)
      // "Fait à" : x≈80, y≈740
      writeText(0, 80, 740, s(d.signature_fait_a));
      // Date : x≈280, y≈740
      writeText(0, 280, 740, new Date().toLocaleDateString('fr-FR'));
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
