export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { resolveCodeToStructure } from '@/lib/structure';
import { auditLog } from '@/lib/audit-log';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * PATCH /api/structure/[code]/settings
 * Permet au directeur (code 10 chars) de modifier l'email de contact de la structure.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  // Validation format : directeur uniquement (10 chars)
  if (!code || !/^[A-Z0-9]{10}$/i.test(code)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Accès réservé au directeur (code 10 caractères).' } },
      { status: 403 }
    );
  }

  const resolved = await resolveCodeToStructure(code);
  if (!resolved || resolved.role !== 'direction') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Accès réservé au directeur.' } },
      { status: 403 }
    );
  }

  const { structure } = resolved;

  // Parser body
  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Corps de requête invalide.' } },
      { status: 400 }
    );
  }

  // Valider email
  const email = body.email;
  if (!email || typeof email !== 'string') {
    return NextResponse.json(
      { error: { code: 'MISSING_EMAIL', message: 'Email requis.' } },
      { status: 400 }
    );
  }
  if (email.length > 255) {
    return NextResponse.json(
      { error: { code: 'EMAIL_TOO_LONG', message: 'Email trop long (255 caractères max).' } },
      { status: 400 }
    );
  }
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { error: { code: 'INVALID_EMAIL', message: 'Format d\'email invalide.' } },
      { status: 400 }
    );
  }

  const supabase = getSupabase();
  const structureId = structure.id as string;

  const { error: dbErr } = await supabase
    .from('gd_structures')
    .update({ email })
    .eq('id', structureId);

  if (dbErr) {
    console.error('[api/structure/[code]/settings] update email error:', dbErr.message);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur.' } },
      { status: 500 }
    );
  }

  await auditLog(supabase, {
    action: 'update',
    resourceType: 'inscription',
    resourceId: structureId,
    actorType: 'referent',
    metadata: { field: 'email', role: 'directeur' },
  });

  return NextResponse.json({ updated: true, email });
}
