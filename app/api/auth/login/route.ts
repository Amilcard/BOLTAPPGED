import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Email ou mot de passe invalide' } },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Identifiants incorrects' } },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Identifiants incorrects' } },
        { status: 401 }
      );
    }

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error('CRITICAL: NEXTAUTH_SECRET is not set');
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Erreur de configuration serveur' } },
        { status: 500 }
      );
    }
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      secret,
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      token,
      user: { id: user.id, email: user.email, role: user.role },
    });

  } catch (error) {
    console.error('POST /api/auth/login error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
