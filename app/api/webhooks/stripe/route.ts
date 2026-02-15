import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const headersList = await headers();
    const sig = headersList.get('stripe-signature');

    if (!sig) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // ✅ CRITIQUE : Vérifier la signature Stripe
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
        { status: 400 }
      );
    }

    // Traiter les événements
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const inscriptionId = paymentIntent.metadata.inscriptionId;

        if (!inscriptionId) {
          console.error('Missing inscriptionId in payment intent metadata');
          break;
        }

        // ✅ SEUL endroit où payment_status devient 'paid'
        const { error } = await supabase
          .from('gd_inscriptions')
          .update({
            payment_status: 'paid',
            payment_validated_at: new Date().toISOString(),
          })
          .eq('id', inscriptionId);

        if (error) {
          console.error('Error updating payment status:', error);
        } else {
          console.log(`✅ Payment succeeded for inscription ${inscriptionId}`);

          // TODO: Trigger email confirmation
          // await sendPaymentSuccessEmail(inscriptionId);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const inscriptionId = paymentIntent.metadata.inscriptionId;

        if (!inscriptionId) break;

        const { error } = await supabase
          .from('gd_inscriptions')
          .update({
            payment_status: 'failed',
          })
          .eq('id', inscriptionId);

        if (error) {
          console.error('Error updating failed payment status:', error);
        } else {
          console.log(`❌ Payment failed for inscription ${inscriptionId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
