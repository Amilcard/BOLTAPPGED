// DEPRECATED: Ce route utilise Prisma (ancien circuit).
// Le parcours officiel passe par /api/inscriptions (Supabase gd_inscriptions).
// Ce route reste actif pour rétrocompatibilité mais sera supprimé.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bookingSchema = z.object({
  staySlug: z.string().min(1),
  sessionStartDate: z.string().min(1), // Format YYYY-MM-DD
  sessionEndDate: z.string().min(1),   // Format YYYY-MM-DD
  organisation: z.string().min(1),
  socialWorkerName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  childFirstName: z.string().min(1),
  childLastName: z.string().optional().default(''),
  childBirthDate: z.string().min(1),
  notes: z.string().optional(),
  childNotes: z.string().optional(),
  consent: z.boolean().refine(v => v === true, { message: 'Consentement requis' }),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📥 Booking payload received:', JSON.stringify(body, null, 2));

    const parsed = bookingSchema.safeParse(body);

    if (!parsed.success) {
      console.error('❌ Validation error:', JSON.stringify(parsed.error.issues, null, 2));
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Données invalides' } },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Transaction: check seats and create inscription
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.gd_stay_sessions.findUnique({
        where: {
          stay_slug_start_date_end_date: {
            stay_slug: data.staySlug,
            start_date: new Date(data.sessionStartDate),
            end_date: new Date(data.sessionEndDate),
          },
        },
      });

      if (!session) {
        throw new Error('SESSION_NOT_FOUND');
      }

      if ((session.seats_left ?? 0) <= 0) {
        throw new Error('SESSION_FULL');
      }

      // Decrement seats
      await tx.gd_stay_sessions.update({
        where: {
          stay_slug_start_date_end_date: {
            stay_slug: data.staySlug,
            start_date: new Date(data.sessionStartDate),
            end_date: new Date(data.sessionEndDate),
          },
        },
        data: { seats_left: { decrement: 1 } },
      });

      // Create inscription
      const inscription = await tx.gd_inscriptions.create({
        data: {
          sejour_slug: data.staySlug,
          session_date: new Date(data.sessionStartDate),
          referent_nom: data.socialWorkerName,
          referent_email: data.email,
          referent_tel: data.phone,
          jeune_prenom: data.childFirstName,
          jeune_nom: data.childLastName,
          jeune_date_naissance: new Date(data.childBirthDate),
          jeune_besoins: data.childNotes,
          remarques: data.notes,
          status: 'en_attente',
        },
      });

      return { inscription, seatsLeft: (session.seats_left ?? 1) - 1 };
    });

    return NextResponse.json({
      id: result.inscription.id,
      status: result.inscription.status,
      seatsLeftUpdated: result.seatsLeft,
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('POST /api/bookings error:', error);
    const message = error instanceof Error ? error.message : 'Erreur';

    if (message === 'SESSION_NOT_FOUND') {
      return NextResponse.json(
        { error: { code: 'SESSION_NOT_FOUND', message: 'Session non trouvée' } },
        { status: 404 }
      );
    }
    if (message === 'SESSION_FULL') {
      return NextResponse.json(
        { error: { code: 'SESSION_FULL', message: 'Cette session est complète' } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
