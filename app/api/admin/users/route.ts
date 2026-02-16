import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth || auth.role !== 'ADMIN') {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'Admin requis' } }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth || auth.role !== 'ADMIN') {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'Admin requis' } }, { status: 401 });
  }

  const body = await req.json();
  const { email, password, role } = body;

  if (!email || !password || !role) {
    return NextResponse.json({ error: { code: 'validation_error', message: 'Champs requis manquants' } }, { status: 400 });
  }

  if (!['ADMIN', 'EDITOR', 'VIEWER'].includes(role)) {
    return NextResponse.json({ error: { code: 'validation_error', message: 'Rôle invalide' } }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: { code: 'validation_error', message: 'Email déjà utilisé' } }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { email, passwordHash, role },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  return NextResponse.json(user);
}
