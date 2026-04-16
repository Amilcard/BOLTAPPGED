import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getClientIpFromHeaders } from '@/lib/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase-server';

// ---------------------------------------------------------------------------
// Rate limiter in-memory (Edge-compatible, per warm instance)
// Protège les routes POST publiques contre le spam/abus.
// Note : pas distribué (pas de Redis) — complément aux guards per-route Supabase.
// ---------------------------------------------------------------------------
const rlStore = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  '/api/inscriptions':          { limit: 5,  windowMs: 5 * 60 * 1000 },
  '/api/souhaits':              { limit: 10, windowMs: 5 * 60 * 1000 },
  '/api/payment/create-intent': { limit: 5,  windowMs: 5 * 60 * 1000 },
};

function getClientIp(req: NextRequest): string {
  return getClientIpFromHeaders(req.headers);
}

function checkRateLimit(path: string, ip: string): boolean {
  const cfg = RATE_LIMITS[path];
  if (!cfg) return false;

  const key = `${ip}:${path}`;
  const now = Date.now();
  const entry = rlStore.get(key);

  if (!entry || now > entry.resetAt) {
    rlStore.set(key, { count: 1, resetAt: now + cfg.windowMs });
    return false;
  }

  entry.count++;
  return entry.count >= cfg.limit;
}

// ---------------------------------------------------------------------------
// Auth guard — /admin/*
// ---------------------------------------------------------------------------
async function verifyAdminAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('gd_session')?.value;
  if (!token) return false;
  const rawSecret = process.env.NEXTAUTH_SECRET;
  if (!rawSecret) return false;
  try {
    const secret = new TextEncoder().encode(rawSecret);
    const { payload } = await jwtVerify(token, secret);
    const role = (payload as Record<string, unknown>).role;
    // Seuls ADMIN et EDITOR accèdent à /admin/*
    if (role !== 'ADMIN' && role !== 'EDITOR') return false;
    // Vérification révocation jti
    const jti = payload.jti;
    if (jti) {
      const { data } = await getSupabaseAdmin()
        .from('gd_revoked_tokens')
        .select('jti')
        .eq('jti', jti)
        .maybeSingle();
      if (data) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function verifyProAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('gd_pro_session')?.value;
  if (!token) return false;
  const rawSecret = process.env.NEXTAUTH_SECRET;
  if (!rawSecret) return false;
  try {
    const secret = new TextEncoder().encode(rawSecret);
    const { payload } = await jwtVerify(token, secret);
    if ((payload as Record<string, unknown>).type !== 'pro_session') return false;
    // Vérification révocation jti
    const jti = payload.jti;
    if (jti) {
      const { data } = await getSupabaseAdmin()
        .from('gd_revoked_tokens')
        .select('jti')
        .eq('jti', jti)
        .maybeSingle();
      if (data) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth guard /sejour/[id]/reserver — admin OU pro session
  if (/^\/sejour\/[^/]+\/reserver/.test(pathname)) {
    const isAdmin = await verifyAdminAuth(request);
    const isPro = await verifyProAuth(request);
    if (!isAdmin && !isPro) {
      const redirect = encodeURIComponent(pathname + request.nextUrl.search);
      return NextResponse.redirect(new URL(`/login?context=pro&redirect=${redirect}`, request.url));
    }
    return NextResponse.next();
  }

  // Auth guard admin
  if (pathname.startsWith('/admin')) {
    const ok = await verifyAdminAuth(request);
    if (!ok) return NextResponse.redirect(new URL('/login', request.url));
    return NextResponse.next();
  }

  // Rate limiting POST public routes (désactivé en test — les tests rapides déclenchent le limiter)
  if (request.method === 'POST' && pathname in RATE_LIMITS && process.env.NODE_ENV !== 'test') {
    const ip = getClientIp(request);
    if (checkRateLimit(pathname, ip)) {
      const cfg = RATE_LIMITS[pathname];
      const retryAfter = String(Math.ceil(cfg.windowMs / 1000));
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Trop de requêtes. Réessayez dans quelques minutes.' } },
        { status: 429, headers: { 'Retry-After': retryAfter } }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/sejour/:path*/reserver',
    '/api/inscriptions',
    '/api/souhaits',
    '/api/payment/create-intent',
  ],
};
