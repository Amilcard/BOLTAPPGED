export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { isRateLimited, getClientIpFromHeaders } from '@/lib/rate-limit';
import { UUID_RE } from '@/lib/validators';
import { auditLog } from '@/lib/audit-log';

const PRIMARY = rgb(0.165, 0.220, 0.247);   // #2a383f
const SECONDARY = rgb(0.871, 0.451, 0.337);  // #de7356
const GRAY = rgb(0.4, 0.4, 0.4);
const LIGHT_BG = rgb(0.96, 0.96, 0.96);

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function fmtPrice(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' €';
}

// Nettoyage caractères non-WinAnsi (pdf-lib limitation)
function clean(str: unknown): string {
  if (!str) return '';
  return String(str)
    .replace(/[\u2011\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\xFF]/g, '');
}

/**
 * GET /api/inscriptions/[id]/recap-pdf?token=xxx
 *
 * Génère un récapitulatif PDF horodaté de l'inscription.
 * Justificatif pour la hiérarchie (CDS, directeur, inspection).
 * Accès via suivi_token (ownership vérifié).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIpFromHeaders(req.headers);
    if (await isRateLimited('recap-pdf', ip, 5, 5)) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Trop de tentatives. Réessayez dans quelques minutes.' } },
        { status: 429, headers: { 'Retry-After': '300' } }
      );
    }

    const { id } = await params;
    const token = req.nextUrl.searchParams.get('token');

    if (!id || !token) {
      return NextResponse.json(
        { error: { code: 'MISSING_PARAMS', message: 'Paramètres manquants.' } },
        { status: 400 }
      );
    }

    if (!UUID_RE.test(id) || !UUID_RE.test(token)) {
      return NextResponse.json(
        { error: { code: 'INVALID_PARAMS', message: 'Format invalide.' } },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Vérifier ownership via suivi_token
    const { data: inscription, error: err } = await supabase
      .from('gd_inscriptions')
      .select('*, gd_stays!fk_inscriptions_stay(marketing_title, title)')
      .eq('id', id)
      .eq('suivi_token', token)
      .is('deleted_at', null)
      .single();

    if (err || !inscription) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Inscription introuvable ou token invalide.' } },
        { status: 404 }
      );
    }

    // RGPD Art. 9 — tracer génération PDF récap (lecture données enfant)
    await auditLog(supabase, {
      action: 'download',
      resourceType: 'inscription',
      resourceId: id,
      inscriptionId: id,
      actorType: 'referent',
      actorId: token,
      ipAddress: ip === 'unknown' ? undefined : ip,
      metadata: { route: '/api/inscriptions/[id]/recap-pdf' },
    });

    const ins = inscription as Record<string, unknown>;
    const stay = (ins.gd_stays as Record<string, unknown>) || {};

    // ── Génération PDF ──────────────────────────────────────────────────

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(`Récapitulatif inscription - ${clean(ins.dossier_ref)}`);
    pdfDoc.setAuthor('Groupe & Découverte');
    pdfDoc.setCreator('GED App — app.groupeetdecouverte.fr');

    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const LEFT = 50;
    const RIGHT = width - 50;
    let y = height - 50;

    // ── Header ──
    page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: PRIMARY });
    page.drawText('GROUPE & DECOUVERTE', {
      x: LEFT, y: height - 35, size: 16, font: bold, color: rgb(1, 1, 1),
    });
    page.drawText('Recapitulatif d\'inscription', {
      x: LEFT, y: height - 55, size: 11, font: regular, color: rgb(0.8, 0.8, 0.8),
    });
    page.drawText(`Ref : ${clean(ins.dossier_ref || ins.id)}`, {
      x: RIGHT - 180, y: height - 35, size: 9, font: regular, color: rgb(0.8, 0.8, 0.8),
    });
    page.drawText(`Genere le ${fmtDate(new Date().toISOString())}`, {
      x: RIGHT - 180, y: height - 50, size: 8, font: regular, color: rgb(0.6, 0.6, 0.6),
    });

    y = height - 110;

    // ── Séjour ──
    page.drawText('SEJOUR', { x: LEFT, y, size: 10, font: bold, color: SECONDARY });
    y -= 18;
    page.drawText(clean(stay.marketing_title || stay.title || 'Non renseigne'), {
      x: LEFT, y, size: 12, font: bold, color: PRIMARY,
    });
    y -= 30;

    // ── Enfant ──
    page.drawRectangle({ x: LEFT - 5, y: y - 5, width: RIGHT - LEFT + 10, height: 55, color: LIGHT_BG });
    page.drawText('ENFANT', { x: LEFT, y, size: 10, font: bold, color: SECONDARY });
    y -= 16;
    page.drawText(`Prenom : ${clean(ins.jeune_prenom)}`, { x: LEFT, y, size: 10, font: regular, color: PRIMARY });
    page.drawText(`Nom : ${clean(ins.jeune_nom)}`, { x: LEFT + 200, y, size: 10, font: regular, color: PRIMARY });
    y -= 14;
    page.drawText(`Age : ${ins.jeune_age ? `${ins.jeune_age} ans` : 'Non renseigne'}`, {
      x: LEFT, y, size: 10, font: regular, color: GRAY,
    });
    y -= 30;

    // ── Référent ──
    page.drawText('REFERENT / EDUCATEUR', { x: LEFT, y, size: 10, font: bold, color: SECONDARY });
    y -= 16;
    page.drawText(`Nom : ${clean(ins.referent_nom)}`, { x: LEFT, y, size: 10, font: regular, color: PRIMARY });
    y -= 14;
    page.drawText(`Email : ${clean(ins.referent_email)}`, { x: LEFT, y, size: 10, font: regular, color: GRAY });
    y -= 14;
    page.drawText(`Structure : ${clean(ins.organisation || 'Non renseignee')}`, {
      x: LEFT, y, size: 10, font: regular, color: GRAY,
    });
    y -= 30;

    // ── Paiement ──
    page.drawRectangle({ x: LEFT - 5, y: y - 5, width: RIGHT - LEFT + 10, height: 55, color: LIGHT_BG });
    page.drawText('PAIEMENT', { x: LEFT, y, size: 10, font: bold, color: SECONDARY });
    y -= 16;
    const methodLabels: Record<string, string> = {
      card: 'Carte bancaire', bank_transfer: 'Virement', cheque: 'Cheque',
      transfer: 'Virement', check: 'Cheque',
    };
    page.drawText(`Montant : ${fmtPrice(Number(ins.price_total) || 0)}`, {
      x: LEFT, y, size: 10, font: bold, color: PRIMARY,
    });
    page.drawText(`Mode : ${methodLabels[String(ins.payment_method)] || String(ins.payment_method || 'Non renseigne')}`, {
      x: LEFT + 200, y, size: 10, font: regular, color: GRAY,
    });
    y -= 14;
    const paymentLabels: Record<string, string> = {
      pending_payment: 'En attente', paid: 'Regle', failed: 'Echoue',
    };
    page.drawText(`Statut : ${paymentLabels[String(ins.payment_status)] || String(ins.payment_status || 'En attente')}`, {
      x: LEFT, y, size: 10, font: regular, color: GRAY,
    });
    y -= 30;

    // ── Consentement parental ──
    page.drawText('CONSENTEMENT PARENTAL (RGPD Art. 8)', { x: LEFT, y, size: 10, font: bold, color: SECONDARY });
    y -= 16;
    if (ins.parental_consent_at) {
      page.drawText(`Consenti le : ${fmtDate(String(ins.parental_consent_at))}`, {
        x: LEFT, y, size: 10, font: regular, color: PRIMARY,
      });
      page.drawText(`Version : ${clean(ins.parental_consent_version)}`, {
        x: LEFT + 250, y, size: 10, font: regular, color: GRAY,
      });
    } else {
      page.drawText('Non applicable (enfant >= 15 ans) ou non recueilli', {
        x: LEFT, y, size: 10, font: regular, color: GRAY,
      });
    }
    y -= 30;

    // ── Statut inscription ──
    page.drawRectangle({ x: LEFT - 5, y: y - 5, width: RIGHT - LEFT + 10, height: 40, color: LIGHT_BG });
    page.drawText('STATUT INSCRIPTION', { x: LEFT, y, size: 10, font: bold, color: SECONDARY });
    y -= 16;
    const statusLabels: Record<string, string> = {
      en_attente: 'En attente de validation', validee: 'Validee', refusee: 'Refusee', annulee: 'Annulee',
    };
    page.drawText(statusLabels[String(ins.status)] || String(ins.status), {
      x: LEFT, y, size: 11, font: bold, color: PRIMARY,
    });
    page.drawText(`Date inscription : ${fmtDate(String(ins.created_at))}`, {
      x: LEFT + 250, y, size: 9, font: regular, color: GRAY,
    });
    y -= 40;

    // ── Horodatage ──
    page.drawText('HORODATAGE', { x: LEFT, y, size: 10, font: bold, color: SECONDARY });
    y -= 16;
    page.drawText(`Inscription creee le : ${fmtDate(String(ins.created_at))}`, {
      x: LEFT, y, size: 9, font: regular, color: GRAY,
    });
    y -= 12;
    page.drawText(`Document genere le : ${fmtDate(new Date().toISOString())}`, {
      x: LEFT, y, size: 9, font: regular, color: GRAY,
    });
    y -= 12;
    page.drawText(`Reference : ${clean(ins.dossier_ref || ins.id)}`, {
      x: LEFT, y, size: 9, font: regular, color: GRAY,
    });
    y -= 30;

    // ── Footer ──
    page.drawRectangle({ x: 0, y: 0, width, height: 50, color: PRIMARY });
    page.drawText('Groupe & Decouverte — app.groupeetdecouverte.fr — DPO : dpo@groupeetdecouverte.fr', {
      x: LEFT, y: 25, size: 8, font: regular, color: rgb(0.7, 0.7, 0.7),
    });
    page.drawText('Document horodate a valeur de justificatif. Donnees hebergees en France.', {
      x: LEFT, y: 13, size: 7, font: regular, color: rgb(0.5, 0.5, 0.5),
    });

    // ── Sérialiser ──
    const pdfBytes = await pdfDoc.save();
    const filename = `recap-inscription-${clean(ins.dossier_ref || ins.id)}.pdf`;

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('GET /api/inscriptions/[id]/recap-pdf error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur generation PDF.' } },
      { status: 500 }
    );
  }
}
