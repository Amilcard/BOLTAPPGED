import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('gd_session');
  // Vérifier que le cookie contient un JWT bien formé (3 segments séparés par '.')
  const isJwtShaped = (session?.value ?? '').split('.').length === 3;
  if (!isJwtShaped) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
