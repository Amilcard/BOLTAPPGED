export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  const sk = process.env.STRIPE_SECRET_KEY || '';

  // Check for invisible characters
  const hasInvisible = /[^\x20-\x7E]/.test(key);
  const skHasInvisible = /[^\x20-\x7E]/.test(sk);

  // Check each char code for first/last 15 chars
  const firstChars = Array.from(key.slice(0, 20)).map((c, i) => ({ pos: i, char: c, code: c.charCodeAt(0) }));
  const lastChars = Array.from(key.slice(-15)).map((c, i) => ({ pos: key.length - 15 + i, char: c, code: c.charCodeAt(0) }));

  return NextResponse.json({
    pk: {
      length: key.length,
      first20: key.substring(0, 20),
      last10: key.substring(key.length - 10),
      hasInvisibleChars: hasInvisible,
      startsWithPkTest: key.startsWith('pk_test_'),
      firstCharCodes: firstChars,
      lastCharCodes: lastChars,
    },
    sk: {
      length: sk.length,
      first20: sk.substring(0, 20),
      last10: sk.substring(sk.length - 10),
      hasInvisibleChars: skHasInvisible,
      startsWithSkTest: sk.startsWith('sk_test_'),
    },
    env: process.env.NODE_ENV,
  });
}
