export const dynamic = 'force-dynamic';
import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { headers } from 'next/headers';
import { sendPaymentConfirmedAdminNotification } from '@/lib/email';
import { errorResponse } from '@/lib/auth-middleware';

// ── Helpers idempotency ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function claimEvent(supabase: any, eventId: string, eventType: string): Promise<boolean> {
  const { data } = await supabase
    .from('gd_processed_events')
    .upsert(
      { event_id: eventId, event_type: eventType, processed_at: new Date().toISOString() },
      { onConflict: 'event_id', ignoreDuplicates: true }
    )
    .select('id')
    .maybeSingle();
  return !!data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rollbackClaim(supabase: any, eventId: string): Promise<void> {
  await supabase.from('gd_processed_events').delete().eq('event_id', eventId);
}

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
    const supabase = getSupabaseAdmin();
    const body = await req.text();
    const headersList = await headers();
    const sig = headersList.get('stripe-signature');

    if (!sig) {
      return errorResponse('MISSING_SIGNATURE', 'Header stripe-signature manquant.', 400);
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
      return errorResponse('INVALID_SIGNATURE', `Webhook Error: ${errMsg}`, 400);
    }

    // IDEMPOTENCY ATOMIQUE : claim l'event AVANT la business logic
    // Utilise INSERT ON CONFLICT (UNIQUE sur event_id) pour éviter le TOCTOU
    // Ne claim que si on a un inscriptionId (sinon Stripe doit réessayer)

    // Idempotency : chaque case fait un upsert-claim atomique AVANT la business logic.
    // Si la business logic échoue post-claim, le claim est rollback + retour 500 → Stripe retry.

    // Traiter les événements
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const inscriptionId = paymentIntent.metadata.inscriptionId;

        if (!inscriptionId) {
          console.error('Missing inscriptionId in payment intent metadata — Stripe réessaiera');
          // Pas de claim → Stripe réessaiera
          break;
        }

        // Claim atomique
        if (!(await claimEvent(supabase, event.id, event.type))) {
          return NextResponse.json({ received: true, skipped: true });
        }

        // VÉRIFICATION MONTANT : comparer Stripe vs DB
        const { data: inscription } = await supabase
          .from('gd_inscriptions')
          .select('price_total, referent_nom, referent_email, jeune_prenom, jeune_nom, sejour_slug, dossier_ref')
          .eq('id', inscriptionId)
          .single();

        if (!inscription) {
          console.error('webhook: inscription not found for payment intent — rollback claim, Stripe réessaiera', { inscriptionId, eventId: event.id });
          // Rollback claim pour permettre le retry Stripe
          await rollbackClaim(supabase, event.id);
          return errorResponse('INSCRIPTION_NOT_FOUND', 'Inscription introuvable.', 500);
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
          // amount_mismatch est permanent — claim déjà fait, Stripe ne réessaiera pas
          break;
        }

        // Montant vérifié, marquer comme payé (guard: seulement depuis pending_payment ou failed)
        const { error, count } = await supabase
          .from('gd_inscriptions')
          .update({
            payment_status: 'paid',
            payment_validated_at: new Date().toISOString(),
          })
          .eq('id', inscriptionId)
          .in('payment_status', ['pending_payment', 'failed']);

        if (!error && count === 0) {
          console.warn('[webhook/stripe] succeeded but inscription not in expected state, skipping update', { inscriptionId });
        }

        if (error) {
          console.error('Error updating payment status — rollback claim:', error);
          await rollbackClaim(supabase, event.id);
          return errorResponse('DB_UPDATE_FAILED', 'Échec mise à jour paiement.', 500);
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
          break;
        }

        // Claim atomique
        if (!(await claimEvent(supabase, event.id, event.type))) {
          return NextResponse.json({ received: true, skipped: true });
        }

        // UPDATE atomique avec RETURNING session_id — évite le TOCTOU SELECT+UPDATE séparé
        const { data: failedInsc, error } = await supabase
          .from('gd_inscriptions')
          .update({ payment_status: 'failed' })
          .eq('id', inscriptionId)
          .in('payment_status', ['pending_payment'])
          .select('session_id')
          .single();

        if (error) {
          console.error('Error updating failed payment status — rollback claim:', error);
          await rollbackClaim(supabase, event.id);
          return errorResponse('DB_UPDATE_FAILED', 'Échec mise à jour statut paiement.', 500);
        } else {
          console.log('[webhook/stripe] payment_intent.payment_failed processed');
          // Rollback capacité — restituer le siège consommé lors de l'inscription
          if (failedInsc?.session_id) {
            const { data: sess } = await supabase
              .from('gd_stay_sessions')
              .select('seats_left')
              .eq('id', failedInsc.session_id)
              .single();
            if (sess && sess.seats_left !== null && sess.seats_left >= 0) {
              const { error: seatErr } = await supabase
                .from('gd_stay_sessions')
                .update({ seats_left: sess.seats_left + 1 })
                .eq('id', failedInsc.session_id)
                .eq('seats_left', sess.seats_left); // guard optimiste contre race
              if (seatErr) {
                console.error('[webhook/stripe] seat rollback failed:', seatErr.message);
              } else {
                console.log('[webhook/stripe] seat rolled back for session', failedInsc.session_id);
              }
            }
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Events sans inscriptionId ne sont pas claim → Stripe réessaiera.
    // Events avec business logic failure → claim rollback + 500 → Stripe réessaiera.

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error('Webhook error:', error);
    return errorResponse('INTERNAL_ERROR', 'Erreur lors du traitement du webhook.', 500);
  }
}
