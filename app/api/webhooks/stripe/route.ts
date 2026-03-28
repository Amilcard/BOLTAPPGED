export const dynamic = 'force-dynamic';
import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { headers } from 'next/headers';
import { sendPaymentConfirmedAdminNotification } from '@/lib/email';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-01-28.clover',
  });
}
export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const supabase = getSupabase();
    const body = await req.text();
    const headersList = await headers();
    const sig = headersList.get('stripe-signature');

    if (!sig) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Vérifier la signature Stripe
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig as string,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
        { status: 400 }
      );
    }

    // IDEMPOTENCY : vérifier si cet event a déjà été traité
    const { data: existingEvent } = await supabase
      .from('gd_processed_events')
      .select('id')
      .eq('event_id', event.id)
      .single();

    if (existingEvent) {
      console.log(`Event ${event.id} already processed, skipping`);
      return NextResponse.json({ received: true, skipped: true });
    }

    // Flag : ne marquer comme traité que si le traitement est complet
    let shouldRecordEvent = true;

    // Traiter les événements
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const inscriptionId = paymentIntent.metadata.inscriptionId;

        if (!inscriptionId) {
          console.error('Missing inscriptionId in payment intent metadata — Stripe réessaiera');
          shouldRecordEvent = false; // Ne PAS enregistrer → Stripe réessaiera
          break;
        }

        // VÉRIFICATION MONTANT : comparer Stripe vs DB
        const { data: inscription } = await supabase
          .from('gd_inscriptions')
          .select('price_total, referent_nom, referent_email, jeune_prenom, jeune_nom, sejour_slug, dossier_ref')
          .eq('id', inscriptionId)
          .single();

        if (!inscription) {
          console.error('webhook: inscription not found for payment intent — Stripe réessaiera', { inscriptionId, eventId: event.id });
          shouldRecordEvent = false; // Race condition possible → Stripe réessaiera
          break;
        }

        const stripeAmountEur = paymentIntent.amount / 100;
        const dbAmount = inscription.price_total ?? 0;
        if (Math.abs(stripeAmountEur - dbAmount) > 1) {
          console.error('AMOUNT_MISMATCH in webhook:', {
            stripe: stripeAmountEur,
            db: dbAmount,
            inscriptionId,
            eventId: event.id,
          });
          await supabase
            .from('gd_inscriptions')
            .update({ payment_status: 'amount_mismatch' })
            .eq('id', inscriptionId);
          break;
        }

        // Montant vérifié, marquer comme payé
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
          console.log(`Payment succeeded for inscription ${inscriptionId}`);
          // Notification admin non-bloquante
          if (inscription) {
            const rec = inscription as Record<string, unknown>;
            sendPaymentConfirmedAdminNotification({
              inscriptionId,
              referentNom: (rec.referent_nom as string) || '',
              jeunePrenom: (rec.jeune_prenom as string) || '',
              jeuneNom: (rec.jeune_nom as string) || '',
              sejourSlug: (rec.sejour_slug as string) || '',
              dossierRef: (rec.dossier_ref as string) || '',
              amount: paymentIntent.amount / 100,
            }).catch(() => {});
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const inscriptionId = paymentIntent.metadata.inscriptionId;

        if (!inscriptionId) {
          shouldRecordEvent = false;
          break;
        }

        const { error } = await supabase
          .from('gd_inscriptions')
          .update({
            payment_status: 'failed',
          })
          .eq('id', inscriptionId);

        if (error) {
          console.error('Error updating failed payment status:', error);
        } else {
          console.log(`Payment failed for inscription ${inscriptionId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // IDEMPOTENCY : enregistrer l'event comme traité SEULEMENT si le traitement est complet
    // Si shouldRecordEvent = false → Stripe réessaiera (metadata manquant, inscription pas encore créée)
    if (shouldRecordEvent) {
      await supabase
        .from('gd_processed_events')
        .upsert(
          {
            event_id: event.id,
            event_type: event.type,
            processed_at: new Date().toISOString(),
          },
          { onConflict: 'event_id', ignoreDuplicates: true }
        );
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
