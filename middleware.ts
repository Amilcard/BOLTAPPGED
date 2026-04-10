import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

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
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
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
  return entry.count > cfg.limit;
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
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth guard admin
  if (pathname.startsWith('/admin')) {
    const ok = await verifyAdminAuth(request);
    if (!ok) return NextResponse.redirect(new URL('/login', request.url));
    return NextResponse.next();
  }

  // Rate limiting POST public routes
  if (request.method === 'POST' && pathname in RATE_LIMITS) {
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
    '/api/inscriptions',
    '/api/souhaits',
    '/api/payment/create-intent',
  ],
};
