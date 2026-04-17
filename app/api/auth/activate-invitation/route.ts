export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { hashPassword, isPasswordStrong } from '@/lib/password';
import { isInvitationExpired } from '@/lib/invitation-token';
import { auditLog } from '@/lib/audit-log';
import { isRateLimited, getClientIpFromHeaders } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIpFromHeaders(req.headers);
    if (await isRateLimited('activate', ip, 10, 10)) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Trop de tentatives.' } },
        { status: 429, headers: { 'Retry-After': '600' } }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: { code: 'INVALID_BODY' } }, { status: 400 });

    const { token, password, prenom, nom } = body as {
      token?: string; password?: string; prenom?: string; nom?: string;
    };

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!token || typeof token !== 'string' || !UUID_RE.test(token)) {
      return NextResponse.json({ error: { code: 'INVALID_TOKEN' } }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: { code: 'PASSWORD_REQUIRED' } }, { status: 400 });
    }

    const strength = isPasswordStrong(password);
    if (!strength.ok) {
      return NextResponse.json({ error: { code: 'WEAK_PASSWORD', message: strength.reason } }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: member } = await supabase
      .from('gd_structure_access_codes')
      .select('id, email, role, invitation_expires_at, activated_at, structure_id, gd_structures!inner(status)')
      .eq('invitation_token', token)
      .maybeSingle();

    if (!member) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

    const structureStatus = (member as unknown as { gd_structures?: { status: string } }).gd_structures?.status;
    if (structureStatus !== 'active') {
      return NextResponse.json(
        { error: { code: 'STRUCTURE_INACTIVE', message: 'La structure associée n\'est plus active.' } },
        { status: 403 }
      );
    }

    if (member.activated_at) {
      return NextResponse.json({ error: { code: 'ALREADY_ACTIVATED' } }, { status: 409 });
    }

    if (isInvitationExpired(member.invitation_expires_at as string | null)) {
      return NextResponse.json(
        { error: { code: 'TOKEN_EXPIRED', message: 'Invitation expirée. Demandez une réinvitation à la direction.' } },
        { status: 410 }
      );
    }

    const passwordHash = await hashPassword(password);

    // UPDATE atomique : .eq('invitation_token', token) garantit qu'une requête concurrente
    // ayant déjà consommé le token ne puisse pas re-activer. count === 0 si token déjà null.
    const { data: updated, error: updateErr } = await supabase
      .from('gd_structure_access_codes')
      .update({
        password_hash: passwordHash,
        activated_at: new Date().toISOString(),
        active: true,
        invitation_token: null,
        invitation_expires_at: null,
        prenom: prenom?.trim() || null,
        nom: nom?.trim() || null,
      })
      .eq('id', member.id)
      .eq('invitation_token', token)
      .select('id');

    if (updateErr) {
      console.error('[activate] update error:', updateErr.message);
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: { code: 'TOKEN_ALREADY_CONSUMED', message: 'Cette invitation a déjà été utilisée.' } },
        { status: 409 }
      );
    }

    await auditLog(supabase, {
      action: 'update',
      resourceType: 'structure',
      resourceId: member.structure_id as string,
      actorType: 'referent',
      actorId: member.email as string,
      ipAddress: ip,
      metadata: { type: 'team_activate', actor_role: member.role },
    });

    return NextResponse.json({ ok: true, email: member.email });
  } catch (err) {
    console.error('POST activate-invitation error:', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
