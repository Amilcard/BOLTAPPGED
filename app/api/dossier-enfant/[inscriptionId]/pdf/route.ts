export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { verifyOwnership } from '@/lib/verify-ownership';
import { auditLog } from '@/lib/audit-log';
import { captureServerException } from '@/lib/sentry-capture';
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

    const supabase = getSupabaseAdmin();

    // Vérifier ownership (centralisé — inclut expiration token RGPD)
    const ownership = await verifyOwnership(supabase, token, inscriptionId);
    if (!ownership.ok) {
      return NextResponse.json(
        { error: { code: ownership.code, message: ownership.message } },
        { status: ownership.status }
      );
    }

    // Données inscription pour le PDF
    const { data: targetRaw } = await supabase
      .from('gd_inscriptions')
      .select('referent_email, jeune_prenom, jeune_nom, jeune_date_naissance, jeune_sexe, sejour_slug, session_date, referent_nom, organisation, city_departure')
      .eq('id', inscriptionId)
      .single();
    const inscription = targetRaw as Record<string, string> | null;
    if (!inscription) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Inscription introuvable.' } }, { status: 404 });
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

    // Option C (2026-04-21) : priorité au nom saisi dans le dossier
    // (bulletin_complement.nom_famille) — fallback colonne inscription si
    // le responsable légal n'a pas encore rempli cette étape.
    const bulletinData = (dossier.bulletin_complement || {}) as Record<string, unknown>;
    const nomFromDossier = typeof bulletinData.nom_famille === 'string'
      ? bulletinData.nom_famille.trim()
      : '';
    const rawFallback = inscription.jeune_nom || '';
    const jeuneNomDisplay = nomFromDossier
      || (rawFallback === 'À RENSEIGNER' ? '' : rawFallback);

    // Résoudre le nom commercial du séjour (marketing_title > slug)
    const { data: stayRaw } = await supabase
      .from('gd_stays')
      .select('marketing_title')
      .eq('slug', inscription.sejour_slug)
      .maybeSingle();
    const sejourNom = (stayRaw as { marketing_title?: string } | null)?.marketing_title
      || inscription.sejour_slug
      || '';

    // Charger le template PDF — docType est déjà validé par whitelist TEMPLATE_FILES ci-dessus
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal -- static whitelist
    const baseDir = path.resolve(process.cwd(), 'public', 'templates');
    const resolvedPath = path.resolve(baseDir, TEMPLATE_FILES[docType]);
    if (!resolvedPath.startsWith(baseDir + path.sep)) {
      return NextResponse.json(
        { error: { code: 'INVALID_PATH', message: 'Chemin de template invalide.' } },
        { status: 400 }
      );
    }
    const templateBytes = await readFile(resolvedPath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const fontSize = 9;
    const smallFontSize = 8;
    const textColor = rgb(0.1, 0.1, 0.1);

    // Date de référence pour les signatures : date de création du dossier (fallback: aujourd'hui)
    const dossierDate = dossier.created_at
      ? new Date(dossier.created_at as string).toLocaleDateString('fr-FR')
      : new Date().toLocaleDateString('fr-FR');

    /**
     * Écrire du texte sur le PDF.
     * Les coordonnées (x, y) sont en top-down (origine en haut à gauche),
     * converties en bottom-up pour pdf-lib.
     *
     * P2.3 — skip cohérent sur valeurs vides :
     *   - null / undefined / '' → skip silencieux (comportement existant)
     *   - littéraux 'null' / 'undefined' (data legacy bogue) → skip aussi
     *   - inputs non-string (number, boolean, objet) → coercition sûre via String()
     * Évite l'affichage de "null" / "undefined" dans les PDF dossier enfant (Art.9).
     */
    const writeText = (
      pageIndex: number,
      x: number,
      y: number,
      text: unknown,
      options?: { bold?: boolean; size?: number; maxLength?: number }
    ) => {
      const page = pdfDoc.getPages()[pageIndex];
      if (!page) return;
      if (text === null || text === undefined) return;
      const str = typeof text === 'string' ? text : String(text);
      const trimmed = str.trim();
      if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return;
      const { height } = page.getSize();
      const maxLength = options?.maxLength ?? 120;
      page.drawText(str.slice(0, maxLength), {
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

    const getDateParts = (value: string): [string, string, string] | null => {
      const formatted = formatDate(value);
      const match = formatted.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      return match ? [match[1], match[2], match[3]] : null;
    };

    const writeDateTriplet = (
      pageIndex: number,
      coords: { dayX: number; monthX: number; yearX: number; y: number },
      value: string
    ) => {
      const parts = getDateParts(value);
      if (!parts) {
        writeText(pageIndex, coords.dayX, coords.y, value);
        return;
      }
      writeText(pageIndex, coords.dayX, coords.y, parts[0], { maxLength: 2 });
      writeText(pageIndex, coords.monthX, coords.y, parts[1], { maxLength: 2 });
      writeText(pageIndex, coords.yearX, coords.y, parts[2], { maxLength: 4 });
    };

    const measureText = (content: string, size: number, bold = false): number => {
      const activeFont = bold ? fontBold : font;
      if (typeof (activeFont as { widthOfTextAtSize?: unknown }).widthOfTextAtSize === 'function') {
        return (activeFont as { widthOfTextAtSize: (text: string, size: number) => number }).widthOfTextAtSize(content, size);
      }
      return content.length * size * 0.55;
    };

    const splitLinesToWidth = (content: string, maxWidth: number, size: number): string[] => {
      const trimmed = content.trim();
      if (!trimmed) return [];
      const words = trimmed.split(/\s+/);
      const lines: string[] = [];
      let current = '';

      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (!current || measureText(candidate, size) <= maxWidth) {
          current = candidate;
          continue;
        }
        lines.push(current);
        current = word;
      }

      if (current) lines.push(current);
      return lines;
    };

    const writeWrappedText = (
      pageIndex: number,
      x: number,
      y: number,
      text: unknown,
      options: { size?: number; maxWidth: number; lineHeight?: number; maxLines?: number; bold?: boolean }
    ) => {
      const value = s(text).trim();
      if (!value || value === 'null' || value === 'undefined') return;
      const size = options.size || fontSize;
      const lineHeight = options.lineHeight || size + 4;
      const lines = splitLinesToWidth(value, options.maxWidth, size).slice(0, options.maxLines || 3);
      lines.forEach((line, index) => {
        writeText(pageIndex, x, y + index * lineHeight, line, {
          size,
          bold: options.bold,
          maxLength: line.length,
        });
      });
    };

    /**
     * D5 fix (2026-04-21) — normalisation sexe cohérente sur le PDF.
     * gd_inscriptions.jeune_sexe stocke 'M' | 'F' (code court).
     * gd_dossier_enfant.fiche_sanitaire.sexe stocke 'garcon' | 'fille' (forme longue).
     * Le PDF préfère la forme longue (fiche sanitaire = source de vérité
     * saisie par le responsable légal). Fallback sur le code inscription
     * normalisé si la fiche sanitaire n'est pas encore remplie.
     */
    const mapSexeLong = (short: string | undefined): string => {
      if (!short) return '';
      const up = short.toUpperCase();
      if (up === 'F') return 'fille';
      if (up === 'M') return 'garcon';
      return '';
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

      writeText(0, 160, 95,  jeuneNomDisplay);
      writeText(0, 416, 95,  s(san.sexe) || mapSexeLong(inscription.jeune_sexe));  // sexe → fiche_sanitaire (fallback code inscription M/F)

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
      writeCheck(0, 265, 375, envoiFicheLiaison === 'permanente');
      writeCheck(0, 265, 397, envoiFicheLiaison === 'depart');
      writeCheck(0, 265, 419, envoiFicheLiaison === 'retour');

      // --- PERSONNE À CONTACTER EN CAS D'URGENCE ---
      writeText(0, 120, 468, s(d.contact_urgence_nom));
      writeText(0, 376, 468, s(d.contact_urgence_adresse));
      writeText(0, 120, 484, s(d.contact_urgence_lien));
      writeText(0, 376, 484, s(d.contact_urgence_telephone));

      // --- FINANCEMENT ---
      writeCheck(0, 175, 636, s(d.financement_ase)           === 'true' || d.financement_ase           === true);
      writeCheck(0, 285, 636, s(d.financement_etablissement) === 'true' || d.financement_etablissement === true);
      writeCheck(0, 395, 636, s(d.financement_famille)       === 'true' || d.financement_famille       === true);
      writeCheck(0, 505, 636, s(d.financement_autres)        === 'true' || d.financement_autres        === true);
      if (s(d.financement_montants)) {
        writeText(0, 175, 660, s(d.financement_montants), { size: smallFontSize, maxLength: 20 });
      }

      // --- AUTORISATION LÉGALE ---
      writeText(0, 102, 703, s(d.soussigne_nom) || inscription.referent_nom);
      writeText(0, 370, 703, `${inscription.jeune_prenom || ''} ${jeuneNomDisplay}`.trim(), { maxLength: 40 });
      writeText(0, 56,  743, s(d.autorisation_fait_a));
      // Le template a déjà "/ 2026" imprimé → on n'écrit que jour + mois
      {
        const parts = getDateParts(s(d.date_signature) || dossierDate);
        if (parts) {
          writeText(0, 280, 743, parts[0], { maxLength: 2 });
          writeText(0, 333, 743, parts[1], { maxLength: 2 });
        }
      }

    // ========================================================================
    // FICHE SANITAIRE DE LIAISON
    // Calibré sur fiche-sanitaire-template.pdf (594.96 x 842.25, 2 pages)
    // ========================================================================
    } else if (docType === 'sanitaire') {
      const d = (dossier.fiche_sanitaire || {}) as Record<string, unknown>;

      // ──── PAGE 1 ────

      // 1. L'ENFANT
      writeText(0, 438, 170, s(d.classe));
      writeText(0, 140, 183, jeuneNomDisplay);
      writeCheck(0, 350, 187, s(d.sexe) === 'garcon');
      writeCheck(0, 412, 187, s(d.sexe) === 'fille');
      writeText(0, 100, 199, inscription.jeune_prenom);
      writeDateTriplet(0, { dayX: 138, monthX: 234, yearX: 332, y: 216 }, inscription.jeune_date_naissance);

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
      const email1 = s(d.resp1_email);
      writeWrappedText(0, 230, 472, email1, { size: smallFontSize, maxWidth: 320, lineHeight: 18, maxLines: 2 });
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
      const email2 = s(d.resp2_email);
      writeWrappedText(0, 345, 462, email2, { size: smallFontSize, maxWidth: 220, lineHeight: 15, maxLines: 2 });
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

      const vaccineColumns = {
        left: { yesX: 150, noX: 165, dateX: 200 },
        middle: { yesX: 380, noX: 395, dateX: 425 }, // Phase2: recalibré estimation visuelle (bbox vectoriel) — à vérifier sur capture
        right: { yesX: 507, noX: 521, dateX: 552 },
      };

      // Layout 3 colonnes × 3-4 lignes : col gauche (i=0..2), col milieu (i=3..7 incl. ROR x3), col droite (i=8..10)
      // baseY = première ligne réelle "Diphtérie/Coqueluche/HépatiteB", pitch = hauteur d'une rangée du tableau
      const VACCINE_BASE_Y = 100;
      const VACCINE_ROW_PITCH = 18;
      vaccins.forEach((v, i) => {
        const colIndex = i <= 2 ? 0 : i <= 7 ? 1 : 2;
        const rowInCol = i <= 2 ? i : i <= 7 ? i - 3 : i - 8;
        const rowY = VACCINE_BASE_Y + rowInCol * VACCINE_ROW_PITCH;
        const val  = v.ror ? rorVal  : s(d[`vaccin_${v.key}`]);
        const date = v.ror ? rorDate : s(d[`vaccin_${v.key}_date`]);
        const columnSet = colIndex === 0 ? vaccineColumns.left : colIndex === 1 ? vaccineColumns.middle : vaccineColumns.right;
        writeCheck(1, columnSet.yesX, rowY, val === 'oui');
        writeCheck(1, columnSet.noX, rowY, val === 'non');
        if (date) writeText(1, columnSet.dateX, rowY, date, { size: 7, maxLength: 12 });
      });

      // 5. RENSEIGNEMENTS MÉDICAUX
      writeText(1, 74, 247, s(d.poids));
      writeText(1, 72, 267, s(d.taille));

      writeCheck(1, 437, 258, s(d.traitement_en_cours) === 'true' || d.traitement_en_cours === true);
      writeCheck(1, 505, 258, s(d.traitement_en_cours) === 'false' || d.traitement_en_cours === false);
      if (s(d.traitement_detail)) {
        writeWrappedText(1, 35, 278, s(d.traitement_detail), { size: smallFontSize, maxWidth: 520, lineHeight: 13, maxLines: 2 });
      }

      writeCheck(1, 181, 398, s(d.allergie_asthme) === 'oui');
      writeCheck(1, 235, 398, s(d.allergie_asthme) === 'non');
      writeCheck(1, 181, 420, s(d.allergie_alimentaire) === 'oui');
      writeCheck(1, 235, 420, s(d.allergie_alimentaire) === 'non');
      writeCheck(1, 503, 396, s(d.allergie_medicamenteuse) === 'oui');
      writeCheck(1, 556, 396, s(d.allergie_medicamenteuse) === 'non');
      writeText(1, 308, 430, s(d.allergie_autres), { size: smallFontSize, maxLength: 60 });
      writeWrappedText(1, 35, 498, s(d.allergie_detail), { size: smallFontSize, maxWidth: 520, lineHeight: 18, maxLines: 3 });

      // Antécédents médicaux / chirurgicaux
      if (s(d.probleme_sante_detail)) {
        writeWrappedText(1, 35, 560, s(d.probleme_sante_detail), { size: smallFontSize, maxWidth: 500, lineHeight: 18, maxLines: 3 });
      }

      // Recommandations des parents
      if (s(d.recommandations_parents)) {
        writeWrappedText(1, 35, 648, s(d.recommandations_parents), { size: smallFontSize, maxWidth: 520, lineHeight: 18, maxLines: 3 });
      }

      // Remarques complémentaires
      if (s(d.remarques)) {
        writeWrappedText(1, 35, 704, s(d.remarques), { size: smallFontSize, maxWidth: 520, lineHeight: 16, maxLines: 2 });
      }

      // Autorisation de soins
      writeText(1, 102, 727, s(d.autorisation_soins_soussigne));
      writeText(1, 86,  793, s(d.fait_a));
      writeText(1, 145, 793, s(d.date_signature) || dossierDate);

    // ========================================================================
    // FICHE DE LIAISON — PAGE 1 (Jeune / Éducateur/trice)
    // Calibré sur fiche-liaison-template.pdf (595.32 x 841.92, 3 pages)
    // Pages 2-3 (avant-séjour, compte rendu) : usage interne GED, non remplies en ligne.
    // ========================================================================
    } else if (docType === 'liaison') {
      const d = (dossier.fiche_liaison_jeune || {}) as Record<string, unknown>;

      // RENSEIGNEMENTS CONCERNANT LE JEUNE
      writeText(0, 115, 213, jeuneNomDisplay);
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
      writeCheck(0, 90,  511, s(d.choix_seul)      === 'oui');
      writeCheck(0, 118, 511, s(d.choix_seul)      === 'non');
      writeCheck(0, 262, 511, s(d.choix_ami)       === 'oui');
      writeCheck(0, 290, 511, s(d.choix_ami)       === 'non');
      writeCheck(0, 524, 511, s(d.choix_educateur) === 'oui');
      writeCheck(0, 552, 511, s(d.choix_educateur) === 'non');

      writeCheck(0, 244, 530, s(d.deja_parti) === 'oui');
      writeCheck(0, 273, 530, s(d.deja_parti) === 'non');

      if (s(d.deja_parti_detail)) {
        writeText(0, 131, 547, s(d.deja_parti_detail), { size: smallFontSize });
      }

      if (s(d.pourquoi_ce_sejour)) {
        const text = s(d.pourquoi_ce_sejour);
        const maxChars = 85;
          writeWrappedText(0, 37, 581, text.slice(0, maxChars * 2), { size: smallFontSize, maxWidth: 520, lineHeight: 17, maxLines: 2 });
      }

      writeCheck(0, 375, 617, s(d.fiche_technique_lue) === 'oui');
      writeCheck(0, 404, 617, s(d.fiche_technique_lue) === 'non');

      // ENGAGEMENT
      writeText(0, 80,  776, s(d.signature_fait_a));
      writeText(0, 280, 776, s(d.date_signature) || dossierDate);
    }

    // Embedding signature parentale (base64 stocké dans le JSONB du formulaire)
    const sigDataByType: Record<string, unknown> = {
      bulletin:  dossier.bulletin_complement,
      sanitaire: dossier.fiche_sanitaire,
      liaison:   dossier.fiche_liaison_jeune,
    };
    const sigData = (sigDataByType[docType] ?? {}) as Record<string, unknown>;
    const signatureDataUrl = typeof sigData.signature_image_url === 'string' ? sigData.signature_image_url : '';

    if (signatureDataUrl.startsWith('data:image/png;base64,')) {
      try {
        const base64Data = signatureDataUrl.split(',')[1];
        const imgBytes = Buffer.from(base64Data, 'base64');
        const sigImage = await pdfDoc.embedPng(imgBytes);
        const sigCoords: Record<string, { page: number; x: number; y: number; w: number; h: number }> = {
          bulletin:  { page: 0, x: 350, y: 795, w: 120, h: 25 },
          sanitaire: { page: 1, x: 350, y: 800, w: 120, h: 25 },
          liaison:   { page: 0, x: 410, y: 805, w: 120, h: 25 },
        };
        const coords = sigCoords[docType];
        if (coords) {
          const targetPage = pdfDoc.getPages()[coords.page];
          if (targetPage) {
            const { height } = targetPage.getSize();
            const rawY = height - coords.y - coords.h;
            const safeY = Math.max(rawY, 30); // min 30pt (~10mm) du bord bas — évite clipping imprimante
            targetPage.drawImage(sigImage, {
              x: coords.x,
              y: safeY,
              width: coords.w,
              height: coords.h,
              opacity: 1,
            });
          }
        }
      } catch (sigErr) {
        // Non-bloquant : signature optionnelle dans le PDF
        console.warn('[pdf GET] signature embed skipped:', (sigErr as Error)?.message || sigErr);
      }
    }

    // Générer le PDF final
    const pdfBytes = await pdfDoc.save();

    // D9 — fallback prénom + nettoyage legacy "À RENSEIGNER" (déjà fait pour nom ligne 89-90)
    const rawPrenom = (inscription.jeune_prenom || '').trim();
    const jeunePrenomDisplay = (!rawPrenom || rawPrenom === 'À RENSEIGNER') ? 'sans-prenom' : rawPrenom;
    const jeuneNomFile = jeuneNomDisplay || 'sans-nom';

    const fileNames: Record<DocType, string> = {
      bulletin: `Bulletin_Inscription_${jeunePrenomDisplay}_${jeuneNomFile}.pdf`,
      sanitaire: `Fiche_Sanitaire_${jeunePrenomDisplay}_${jeuneNomFile}.pdf`,
      liaison: `Fiche_Liaison_${jeunePrenomDisplay}_${jeuneNomFile}.pdf`,
    };

    const fileName = Object.prototype.hasOwnProperty.call(fileNames, docType) ? fileNames[docType] : `document_${jeunePrenomDisplay}_${jeuneNomFile}.pdf`;

    // Audit RGPD Art. 9 — tracer chaque téléchargement de document contenant des données sensibles
    await auditLog(supabase, {
      action: 'download',
      resourceType: 'document',
      resourceId: inscriptionId,
      inscriptionId,
      actorType: 'referent',
      actorId: ownership.referentEmail,
      metadata: { type: docType, channel: 'direct' },
    }).catch((err) => { console.error('[pdf GET] auditLog failed:', err); });

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error) {
    captureServerException(error, { domain: 'audit', operation: 'dossier_pdf_generation' });
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur de génération PDF.' } },
      { status: 500 }
    );
  }
}
