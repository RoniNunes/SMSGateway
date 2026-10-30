import { jsonError, jsonOk } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { recordLoginConsent } from '@/lib/services/privacy';
import { setSession } from '@/lib/session';
import bcrypt from 'bcryptjs';
import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  let email = '';
  let password = '';

  try {
    const body = await req.json();
    email = String(body.email ?? '').trim().toLowerCase();
    password = String(body.password ?? '');
  } catch {
    return jsonError('JSON inválido.', 400);
  }

  if (!email || !password) return jsonError('Email e palavra-passe obrigatórios.', 400);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return jsonError('Credenciais inválidas.', 401);

  const valid =
    (await bcrypt.compare(password, user.password)) ||
    user.password === password;

  if (!valid) return jsonError('Credenciais inválidas.', 401);
  if (!user.isActive) return jsonError('Conta desactivada. Contacte o administrador.', 403);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
  await recordLoginConsent(user.id, { ip, userAgent: req.headers.get('user-agent') ?? undefined });
  await setSession(user.id);

  return jsonOk({
    status: 'success',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_admin: user.role === 'admin',
    },
  });
}