import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bookingSchema = z.object({
  stayId: z.string().min(1),
  sessionId: z.string().min(1),
  organisation: z.string().min(1),
  socialWorkerName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  childFirstName: z.string().min(1),
  childLastName: z.string().optional().default(''), // Minimisation données
  childBirthDate: z.string().min(1), // Format YYYY-MM-DD (année uniquement côté UI)
  notes: z.string().optional(),
  childNotes: z.string().optional(),
  consent: z.boolean().refine(v => v === true, { message: 'Consentement requis' }),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Données invalides' } },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Transaction: check seats and create booking
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.staySession.findUnique({
        where: { id: data.sessionId },
      });

      if (!session) {
        throw new Error('SESSION_NOT_FOUND');
      }

      if (session.seatsLeft <= 0) {
        throw new Error('SESSION_FULL');
      }

      // Decrement seats
      await tx.staySession.update({
        where: { id: data.sessionId },
        data: { seatsLeft: { decrement: 1 } },
      });

      // Create booking
      const booking = await tx.booking.create({
        data: {
          stayId: data.stayId,
          sessionId: data.sessionId,
          organisation: data.organisation,
          socialWorkerName: data.socialWorkerName,
          email: data.email,
          phone: data.phone,
          childFirstName: data.childFirstName,
          childLastName: data.childLastName,
          childBirthDate: new Date(data.childBirthDate),
          notes: data.notes,
          childNotes: data.childNotes,
          status: 'new',
        },
      });

      return { booking, seatsLeft: session.seatsLeft - 1 };
    });

    return NextResponse.json({
      id: result.booking.id,
      status: result.booking.status,
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
