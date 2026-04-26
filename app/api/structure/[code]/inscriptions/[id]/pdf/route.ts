export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireStructureRole } from '@/lib/structure-guard';
import { requireInscriptionInStructure } from '@/lib/resource-guard';
import { auditLog, getClientIp } from '@/lib/audit-log';
import { captureServerException } from '@/lib/sentry-capture';
import { structureRateLimitGuard } from '@/lib/rate-limit-structure';
import { UUID_RE } from '@/lib/validators';

const ALLOWED_DOC_TYPES = ['bulletin', 'sanitaire', 'liaison'] as const;
type PdfDocType = typeof ALLOWED_DOC_TYPES[number];

/**
 * GET /api/structure/[code]/inscriptions/[id]/pdf?type=bulletin|sanitaire|liaison
 *
 * Téléchargement PDF staff — miroir de `/api/dossier-enfant/[id]/pdf` avec
 * auth JWT session structure au lieu de suivi_token.
 *
 * Implémentation pragmatique : le staff est authentifié et ownership vérifié,
 * on lookup le suivi_token depuis `gd_inscriptions` puis on internal-fetch la
 * route référent existante (pattern identique à pdf-email). Évite la
 * duplication des 490+ lignes de génération PDF + embed signature.
 *
 * Le staff ne voit jamais le token (proxy inverse transparent).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> },
) {
  try {
    const rateLimited = await structureRateLimitGuard(req);
    if (rateLimited) return rateLimited;

    const { code, id: inscriptionId } = await params;

    if (!UUID_RE.test(inscriptionId)) {
      return NextResponse.json(
        { error: { code: 'INVALID_ID', message: 'ID inscription invalide.' } },
        { status: 400 },
      );
    }

    const docType = req.nextUrl.searchParams.get('type');
    if (!docType || !ALLOWED_DOC_TYPES.includes(docType as PdfDocType)) {
      return NextResponse.json(
        { error: { code: 'INVALID_TYPE', message: 'Type invalide.' } },
        { status: 400 },
      );
    }

    const guard = await requireStructureRole(req, code, {
      allowRoles: ['secretariat', 'direction', 'cds', 'cds_delegated'],
      forbiddenMessage: 'Accès réservé au staff structure.',
    });
    if (!guard.ok) return guard.response;
    const resolved = guard.resolved;

    const supabase = getSupabaseAdmin();
    const structureId = resolved.structure.id as string;

    const ownership = await requireInscriptionInStructure({
      supabase,
      inscriptionId,
      structureId,
    });
    if (!ownership.ok) return ownership.response;

    // Lookup suivi_token — staff a droit légitime car ownership structure vérifié
    const { data: inscRaw } = await supabase
      .from('gd_inscriptions')
      .select('suivi_token, jeune_prenom, jeune_nom')
      .eq('id', inscriptionId)
      .single();

    const insc = inscRaw as { suivi_token?: string; jeune_prenom?: string; jeune_nom?: string } | null;
    if (!insc || !insc.suivi_token) {
      return NextResponse.json(
        { error: { code: 'NO_TOKEN', message: "Suivi token manquant — impossible de générer le PDF." } },
        { status: 404 },
      );
    }

    // Internal fetch route référent — timeout 60s (hérité fix P1 #5)
    const INTERNAL_BASE = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || (process.env.NODE_ENV === 'production' ? 'https://app.groupeetdecouverte.fr' : 'http://localhost:3000');
    const pdfUrl = new URL(
      `/api/dossier-enfant/${encodeURIComponent(inscriptionId)}/pdf`,
      INTERNAL_BASE,
    );
    pdfUrl.searchParams.set('token', insc.suivi_token);
    pdfUrl.searchParams.set('type', docType);

    let pdfRes: Response;
    try {
      pdfRes = await fetch(pdfUrl.toString(), { signal: AbortSignal.timeout(60000) });
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      captureServerException(fetchErr, { domain: 'audit', operation: 'structure_pdf_fetch' });
      console.error('[structure/pdf] internal fetch failed:', msg);
      return NextResponse.json(
        { error: 'Service PDF indisponible — réessayez dans quelques minutes.' },
        { status: 504 },
      );
    }

    if (!pdfRes.ok) {
      const bodyText = await pdfRes.text().catch(() => '');
      console.error('[structure/pdf] internal error:', pdfRes.status, bodyText.slice(0, 300));

      // Distinguer 404 "dossier pas encore rempli" (cas nominal) vs 502 crash template
      if (pdfRes.status === 404) {
        let innerCode = 'NOT_FOUND';
        try {
          const parsed = JSON.parse(bodyText) as { error?: { code?: string } };
          innerCode = parsed?.error?.code || 'NOT_FOUND';
        } catch { /* body non-JSON, garder NOT_FOUND */ }

        const uxMessages: Record<string, string> = {
          NO_DATA: "Le dossier enfant n'a pas encore été rempli. Aucun PDF à télécharger pour le moment.",
          NO_TOKEN: 'Token de suivi manquant sur cette inscription — contactez la GED.',
          NOT_FOUND: 'Inscription introuvable.',
          INVALID_TOKEN: 'Lien de suivi invalide ou expiré.',
          EXPIRED_TOKEN: 'Lien de suivi expiré.',
        };

        return NextResponse.json(
          { error: { code: innerCode, message: uxMessages[innerCode] || 'Dossier introuvable.' } },
          { status: 404 },
        );
      }

      return NextResponse.json(
        { error: 'Erreur génération PDF.' },
        { status: 502 },
      );
    }

    // AuditLog RGPD Art.9 — téléchargement PDF par staff
    await auditLog(supabase, {
      action: 'download',
      resourceType: 'document',
      resourceId: inscriptionId,
      inscriptionId,
      actorType: 'staff',
      actorId: resolved.email || undefined,
      ipAddress: getClientIp(req),
      metadata: {
        docType,
        context: 'staff_download_pdf',
        actor_role: resolved.role,
      },
    });

    // Stream PDF au client — passthrough content-type + disposition
    const pdfBuffer = await pdfRes.arrayBuffer();
    const filename = `${docType}_${insc.jeune_prenom || ''}_${insc.jeune_nom || ''}.pdf`
      .replace(/\s+/g, '_');

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    captureServerException(err, { domain: 'audit', operation: 'structure_pdf_get' });
    console.error('GET /api/structure/[code]/inscriptions/[id]/pdf error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 },
    );
  }
}
