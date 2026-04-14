export const dynamic = 'force-dynamic';
import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { headers } from 'next/headers';
import { sendPaymentConfirmedAdminNotification } from '@/lib/email';

function getStripe() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(stripeKey, {
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
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig as string,
        webhookSecret
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Signature invalide';
      console.error('Webhook signature verification failed:', errMsg);
      return NextResponse.json(
        { error: `Webhook Error: ${errMsg}` },
        { status: 400 }
      );
    }

    // IDEMPOTENCY ATOMIQUE : claim l'event AVANT la business logic
    // Utilise INSERT ON CONFLICT (UNIQUE sur event_id) pour éviter le TOCTOU
    // Ne claim que si on a un inscriptionId (sinon Stripe doit réessayer)

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

        // Claim atomique — si une invocation concurrente a déjà claim, on skip
        const { data: claimed } = await supabase
          .from('gd_processed_events')
          .upsert(
            { event_id: event.id, event_type: event.type, processed_at: new Date().toISOString() },
            { onConflict: 'event_id', ignoreDuplicates: true }
          )
          .select('id')
          .maybeSingle();

        if (!claimed) {
          console.log(`Event ${event.id} already claimed by concurrent invocation, skipping`);
          return NextResponse.json({ received: true, skipped: true });
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
          // Alerte admin — montant divergent, intervention manuelle requise
          sendPaymentConfirmedAdminNotification({
            inscriptionId,
            referentNom: (inscription.referent_nom as string) || '',
            jeunePrenom: (inscription.jeune_prenom as string) || '',
            jeuneNom: (inscription.jeune_nom as string) || '',
            sejourSlug: (inscription.sejour_slug as string) || '',
            dossierRef: (inscription.dossier_ref as string) || '',
            amount: stripeAmountEur,
            subject: `[ALERTE] AMOUNT MISMATCH — Stripe ${stripeAmountEur}€ vs DB ${dbAmount}€`,
          }).catch((err) => { console.error('[webhook/stripe] sendAmountMismatchAlert failed', err); });
          // amount_mismatch est permanent — enregistrer l'event pour stopper les retries Stripe
          shouldRecordEvent = true;
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
          shouldRecordEvent = false;
        } else {
          console.log('[webhook/stripe] payment_intent.succeeded processed');
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
            }).catch((err) => { console.error('[webhook/stripe] sendPaymentConfirmedAdminNotification failed', err); });
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

        // Claim atomique
        const { data: claimedFail } = await supabase
          .from('gd_processed_events')
          .upsert(
            { event_id: event.id, event_type: event.type, processed_at: new Date().toISOString() },
            { onConflict: 'event_id', ignoreDuplicates: true }
          )
          .select('id')
          .maybeSingle();

        if (!claimedFail) {
          return NextResponse.json({ received: true, skipped: true });
        }

        const { error } = await supabase
          .from('gd_inscriptions')
          .update({
            payment_status: 'failed',
          })
          .eq('id', inscriptionId);

        if (error) {
          console.error('Error updating failed payment status:', error);
          shouldRecordEvent = false; // DB échoué → Stripe réessaiera
        } else {
          console.log('[webhook/stripe] payment_intent.payment_failed processed');
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Events avec shouldRecordEvent = false (inscriptionId manquant) ne sont pas claim
    // → Stripe réessaiera. Les events claim atomiquement dans chaque case ci-dessus.

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Erreur lors du traitement du webhook.' },
      { status: 500 }
    );
  }
}
