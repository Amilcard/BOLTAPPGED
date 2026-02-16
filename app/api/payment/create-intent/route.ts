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
    const { inscriptionId, amount } = await req.json();

    if (!inscriptionId || !amount) {
      return NextResponse.json(
        { error: 'Missing inscriptionId or amount' },
        { status: 400 }
      );
    }

    // Vérifier que l'inscription existe
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

    // Créer Payment Intent Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convertir en centimes
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
