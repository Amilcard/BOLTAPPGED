export const dynamic = 'force-dynamic';
import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

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
    const { inscriptionId, suivi_token } = await req.json();

    if (!inscriptionId || !suivi_token) {
      return NextResponse.json(
        { error: 'Missing inscriptionId or suivi_token' },
        { status: 400 }
      );
    }

    // Récupérer l'inscription ET son price_total vérifié en DB
    // Vérification ownership : suivi_token doit correspondre à l'inscription
    const { data: inscription, error: fetchError } = await supabase
      .from('gd_inscriptions')
      .select('id, price_total, stripe_payment_intent_id, suivi_token, jeune_prenom, sejour_slug, payment_status, payment_method')
      .eq('id', inscriptionId)
      .eq('suivi_token', suivi_token)
      .single();

    if (fetchError || !inscription) {
      return NextResponse.json(
        { error: 'Inscription not found' },
        { status: 404 }
      );
    }

    // SÉCURITÉ : utiliser le price_total de la DB (vérifié par /api/inscriptions)
    // Ne JAMAIS faire confiance au montant envoyé par le frontend
    const verifiedAmount = inscription.price_total;
    if (!verifiedAmount || verifiedAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid price in inscription record' },
        { status: 400 }
      );
    }

    // Réutiliser le PaymentIntent existant si déjà créé — évite les intents orphelins sur retry
    if (inscription.stripe_payment_intent_id) {
      const existing = await stripe.paymentIntents.retrieve(inscription.stripe_payment_intent_id);
      if (existing.status !== 'canceled' && existing.status !== 'succeeded') {
        return NextResponse.json({
          clientSecret: existing.client_secret,
          paymentIntentId: existing.id,
        });
      }
    }

    // Créer Payment Intent Stripe avec le montant vérifié
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(verifiedAmount * 100),
      currency: 'eur',
      payment_method_types: ['card'],
      metadata: {
        inscriptionId,
        jeune_prenom: inscription.jeune_prenom,
        sejour_slug: inscription.sejour_slug,
      },
    });

    // Sauvegarder Payment Intent ID en DB — atomique : WHERE stripe_payment_intent_id IS NULL
    // Évite la race condition si deux requêtes simultanées créent deux intents
    const { data: updatedRows, error: updateError } = await supabase
      .from('gd_inscriptions')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        payment_method: 'stripe',
        payment_status: 'pending_payment',
      })
      .eq('id', inscriptionId)
      .is('stripe_payment_intent_id', null)
      .select('stripe_payment_intent_id');

    if (updateError) {
      console.error('Error updating inscription:', updateError);
      return NextResponse.json(
        { error: 'Failed to update inscription' },
        { status: 500 }
      );
    }

    // Si 0 lignes mises à jour → une autre requête a déjà écrit un intent, réutiliser
    if (!updatedRows || updatedRows.length === 0) {
      const { data: refreshed } = await supabase
        .from('gd_inscriptions')
        .select('stripe_payment_intent_id')
        .eq('id', inscriptionId)
        .single();
      if (refreshed?.stripe_payment_intent_id) {
        const existing = await stripe.paymentIntents.retrieve(refreshed.stripe_payment_intent_id);
        return NextResponse.json({ clientSecret: existing.client_secret, paymentIntentId: existing.id });
      }
      return NextResponse.json({ error: 'Concurrent request conflict' }, { status: 409 });
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error: unknown) {
    console.error('Error creating payment intent:', error);
    console.error('Payment intent error detail:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du paiement.' },
      { status: 500 }
    );
  }
}
