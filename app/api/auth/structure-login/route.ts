export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { verifyPassword } from '@/lib/password';
import { auditLog } from '@/lib/audit-log';
import { isRateLimited, getClientIpFromHeaders } from '@/lib/rate-limit';
import { buildProSessionToken, type ProStructureRole } from '@/lib/auth-middleware';
import { EMAIL_REGEX } from '@/lib/validators';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: { code: 'INVALID_BODY' } }, { status: 400 });

    const { email, password } = body as { email?: string; password?: string };
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json({ error: { code: 'INVALID_EMAIL' } }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: { code: 'PASSWORD_REQUIRED' } }, { status: 400 });
    }

    const emailNorm = email.trim().toLowerCase();
    const ip = getClientIpFromHeaders(req.headers);

    // Dual-key rate limit : IP tolérante (NAT partagé) + email strict (credential stuffing cible)
    const [ipBlocked, emailBlocked] = await Promise.all([
      isRateLimited('struct-login-ip', ip, 10, 15),
      isRateLimited('struct-login-email', emailNorm, 5, 15),
    ]);
    if (ipBlocked || emailBlocked) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Trop de tentatives. Réessayez dans 15 minutes.' } },
        { status: 429, headers: { 'Retry-After': '900' } }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: member } = await supabase
      .from('gd_structure_access_codes')
      .select('id, email, role, code, password_hash, activated_at, active, structure_id, gd_structures!inner(id, name, status, code)')
      .eq('email', emailNorm)
      .eq('active', true)
      .maybeSingle();

    const memberWithStructure = member as {
      id: string; email: string; role: string; code: string; password_hash: string | null;
      activated_at: string | null; active: boolean; structure_id: string;
      gd_structures: { id: string; name: string; status: string; code: string };
    } | null;

    if (!memberWithStructure || !memberWithStructure.activated_at || memberWithStructure.gd_structures?.status !== 'active') {
      return NextResponse.json({ error: { code: 'INVALID_CREDENTIALS' } }, { status: 401 });
    }

    const passwordOk = await verifyPassword(password, memberWithStructure.password_hash);
    if (!passwordOk) {
      // RGPD #1 : pas d'email en clair dans metadata. Hash partiel pour corrélation IP-aware.
      const { createHash } = await import('crypto');
      const emailHash = createHash('sha256').update(emailNorm).digest('hex').slice(0, 16);
      await auditLog(supabase, {
        action: 'update',
        resourceType: 'session',
        resourceId: memberWithStructure.structure_id,
        actorType: 'system',
        ipAddress: ip,
        metadata: { type: 'structure_login_failed', actor_role: memberWithStructure.role, email_hash: emailHash },
      });
      return NextResponse.json({ error: { code: 'INVALID_CREDENTIALS' } }, { status: 401 });
    }

    // structureCode : code structure (pas code personnel) pour compat ProSessionPayload
    // utilisé par /api/inscriptions et /api/pro/propositions (callers existants).
    const structureCode = memberWithStructure.gd_structures.code;

    const jwtResult = await buildProSessionToken({
      email: memberWithStructure.email,
      structureCode,
      structureName: memberWithStructure.gd_structures.name,
      structureRole: memberWithStructure.role as ProStructureRole,
      structureId: memberWithStructure.structure_id,
      expiresIn: '8h',
    });
    if (!jwtResult) {
      return NextResponse.json({ error: { code: 'CONFIG_ERROR' } }, { status: 500 });
    }
    const { token, jti, expiresAt: jtiExp } = jwtResult;

    // Stocker jti + exp pour révocation immédiate via /revoke
    await supabase
      .from('gd_structure_access_codes')
      .update({ last_jti: jti, last_jti_exp: jtiExp })
      .eq('id', memberWithStructure.id);

    const response = NextResponse.json({
      ok: true,
      email: memberWithStructure.email,
      role: memberWithStructure.role,
      structureName: memberWithStructure.gd_structures.name,
    });

    response.cookies.set('gd_pro_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 8 * 3600,
    });

    await auditLog(supabase, {
      action: 'update',
      resourceType: 'session',
      resourceId: memberWithStructure.structure_id,
      actorType: 'referent',
      actorId: memberWithStructure.email,
      ipAddress: ip,
      metadata: { type: 'structure_login_success', actor_role: memberWithStructure.role },
    });

    return response;
  } catch (err) {
    console.error('POST structure-login error:', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
