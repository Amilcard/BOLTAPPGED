export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireStructureRole } from '@/lib/structure-guard';
import { requireInscriptionInStructure } from '@/lib/resource-guard';
import { auditLog, getClientIp } from '@/lib/audit-log';
import { structureRateLimitGuard } from '@/lib/rate-limit-structure';
import { UUID_RE } from '@/lib/validators';

const ALLOWED_DOC_TYPES = ['bulletin', 'sanitaire', 'liaison'] as const;
type PdfDocType = typeof ALLOWED_DOC_TYPES[number];

/**
 * POST /api/structure/[code]/inscriptions/[id]/pdf-email
 *
 * Envoi PDF par email staff — miroir de `/api/dossier-enfant/[id]/pdf-email`
 * avec auth JWT session structure.
 *
 * Body : { type: 'bulletin'|'sanitaire'|'liaison' }
 *
 * Pattern : internal fetch vers la route référent pdf-email en récupérant
 * le suivi_token côté staff. Evite duplication de la logique envoi Resend.
 *
 * AuditLog tracé côté staff ET côté référent (double trace Art.9).
 */
export async function POST(
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

    const guard = await requireStructureRole(req, code, {
      allowRoles: ['secretariat', 'direction', 'cds', 'cds_delegated'],
      forbiddenMessage: 'Accès réservé au staff structure.',
    });
    if (!guard.ok) return guard.response;
    const resolved = guard.resolved;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 });
    }

    const docType = typeof body.type === 'string' ? body.type : '';
    if (!ALLOWED_DOC_TYPES.includes(docType as PdfDocType)) {
      return NextResponse.json(
        { error: { code: 'INVALID_TYPE', message: 'Type invalide.' } },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const structureId = resolved.structure.id as string;

    const ownership = await requireInscriptionInStructure({
      supabase,
      inscriptionId,
      structureId,
    });
    if (!ownership.ok) return ownership.response;

    // Lookup suivi_token (staff a droit légitime via ownership)
    const { data: inscRaw } = await supabase
      .from('gd_inscriptions')
      .select('suivi_token')
      .eq('id', inscriptionId)
      .single();

    const insc = inscRaw as { suivi_token?: string } | null;
    if (!insc || !insc.suivi_token) {
      return NextResponse.json(
        { error: { code: 'NO_TOKEN', message: 'Suivi token manquant.' } },
        { status: 404 },
      );
    }

    // Internal forward vers route référent pdf-email
    const INTERNAL_BASE = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || (process.env.NODE_ENV === 'production' ? 'https://app.groupeetdecouverte.fr' : 'http://localhost:3000');
    const targetUrl = new URL(
      `/api/dossier-enfant/${encodeURIComponent(inscriptionId)}/pdf-email`,
      INTERNAL_BASE,
    ).toString();

    // BCC staff (preuve d'envoi côté secrétariat/direction/CDS) — forwardé
    // à la route référent qui gère l'inclusion Resend. Ignoré si email staff
    // identique au référent (géré côté route référent).
    const staffBcc = resolved.email || undefined;

    let forwardRes: Response;
    try {
      forwardRes = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: insc.suivi_token,
          type: docType,
          ...(staffBcc ? { bcc: staffBcc } : {}),
        }),
        signal: AbortSignal.timeout(60000),
      });
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error('[structure/pdf-email] internal forward failed:', msg);
      return NextResponse.json(
        { error: 'Service email indisponible — réessayez.' },
        { status: 504 },
      );
    }

    // AuditLog RGPD — tracé côté staff en plus de la trace côté route référent
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
        context: 'staff_email_pdf',
        actor_role: resolved.role,
        channel: 'email',
        bcc_staff: !!staffBcc,
      },
    });

    // Transparence : passthrough status + body JSON de la route référent
    const respBody = await forwardRes.json().catch(() => ({}));
    return NextResponse.json(respBody, { status: forwardRes.status });
  } catch (err) {
    console.error('POST /api/structure/[code]/inscriptions/[id]/pdf-email error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 },
    );
  }
}
