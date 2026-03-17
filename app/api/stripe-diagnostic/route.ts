export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  const sk = process.env.STRIPE_SECRET_KEY || '';

  // Test 1: Try creating a token with the publishable key (like Stripe.js does)
  let pkTest: any = null;
  try {
    const res = await fetch('https://api.stripe.com/v1/tokens', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pk}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'card[number]=4242424242424242&card[exp_month]=12&card[exp_year]=2027&card[cvc]=123',
    });
    pkTest = { status: res.status, body: await res.json() };
  } catch (e: any) {
    pkTest = { error: e.message };
  }

  // Test 2: Try listing payment methods with the secret key
  let skTest: any = null;
  try {
    const res = await fetch('https://api.stripe.com/v1/payment_methods?type=card&limit=1', {
      headers: { 'Authorization': `Bearer ${sk}` },
    });
    skTest = { status: res.status, body: await res.json() };
  } catch (e: any) {
    skTest = { error: e.message };
  }

  return NextResponse.json({
    pk: { length: pk.length, first20: pk.substring(0, 20), last10: pk.substring(pk.length - 10) },
    sk: { length: sk.length, first20: sk.substring(0, 20), last10: sk.substring(sk.length - 10) },
    pkTest,
    skTest,
  });
}
