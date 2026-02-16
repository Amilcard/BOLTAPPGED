import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { inscriptionId } = await req.json();

    if (!inscriptionId) {
      return NextResponse.json(
        { error: 'Missing inscriptionId' },
        { status: 400 }
      );
    }

    // Récupérer l'inscription ET son price_total vérifié en DB
    const { data: inscription, error: fetchError } = await supabase
      .from('gd_inscriptions')
      .select('*')
      .eq('id', inscriptionId)
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

    // Créer Payment Intent Stripe avec le montant vérifié
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(verifiedAmount * 100), // Convertir en centimes
      currency: 'eur',
      metadata: {
        inscriptionId,
        jeune_prenom: inscription.jeune_prenom,
        sejour_slug: inscription.sejour_slug,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Sauvegarder Payment Intent ID en DB
    const { error: updateError } = await supabase
      .from('gd_inscriptions')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        payment_method: 'stripe',
        payment_status: 'pending_payment',
      })
      .eq('id', inscriptionId);

    if (updateError) {
      console.error('Error updating inscription:', updateError);
      return NextResponse.json(
        { error: 'Failed to update inscription' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
