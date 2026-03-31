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
