import { NextResponse } from 'next/server';

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 60 * 60 * 8, // 8h
} as const;

export function setSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set('gd_session', token, SESSION_COOKIE_OPTIONS);
  return response;
}

export function setPendingCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set('gd_pending_2fa', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 5, // 5 min
  });
  return response;
}

export function clearPendingCookie(response: NextResponse): NextResponse {
  response.cookies.delete('gd_pending_2fa');
  return response;
}
