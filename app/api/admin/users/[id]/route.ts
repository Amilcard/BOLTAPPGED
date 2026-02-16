import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = verifyAuth(req);
  if (!auth || auth.role !== 'ADMIN') {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'Admin requis' } }, { status: 401 });
  }

  const body = await req.json();
  const { email, password, role } = body;

  const updateData: { email?: string; role?: Role; passwordHash?: string } = {};

  if (email) updateData.email = email;
  if (role && ['ADMIN', 'EDITOR', 'VIEWER'].includes(role)) updateData.role = role as Role;
  if (password) updateData.passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.update({
    where: { id: params.id },
    data: updateData,
    select: { id: true, email: true, role: true, createdAt: true },
  });

  return NextResponse.json(user);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = verifyAuth(req);
  if (!auth || auth.role !== 'ADMIN') {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'Admin requis' } }, { status: 401 });
  }

  // Empêcher de supprimer son propre compte
  if (auth.userId === params.id) {
    return NextResponse.json({ error: { code: 'validation_error', message: 'Impossible de supprimer votre propre compte' } }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
