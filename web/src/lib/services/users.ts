import { prisma } from '@/lib/db';
import { generateToken } from '@/lib/crypto';
import bcrypt from 'bcryptjs';
import type { User, UserRole } from '@prisma/client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function verifyUserPassword(user: Pick<User, 'password'>, password: string): Promise<boolean> {
  if (user.password.startsWith('$2')) {
    return bcrypt.compare(password, user.password);
  }
  return user.password === password;
}

export function validateEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return 'Email obrigatório.';
  if (!EMAIL_RE.test(trimmed)) return 'Email inválido.';
  return null;
}

export async function listUsersWithStats() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });

  return Promise.all(
    users.map(async (u) => {
      const [devices, smsCount] = await Promise.all([
        prisma.device.count({ where: { userId: u.id, isActive: true } }),
        prisma.smsReceived.count({ where: { userId: u.id } }),
      ]);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        is_active: u.isActive ? 1 : 0,
        webhook_enabled: u.webhookEnabled ? 1 : 0,
        created_at: u.createdAt,
        devices,
        sms_count: smsCount,
      };
    }),
  );
}

export async function createUser(params: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}) {
  const existing = await prisma.user.findUnique({ where: { email: params.email } });
  if (existing) throw new Error('Este email já está registado.');

  const hash = await bcrypt.hash(params.password, 10);
  const user = await prisma.user.create({
    data: {
      name: params.name,
      email: params.email,
      password: hash,
      apiKey: generateToken(32),
      role: params.role,
      isActive: false,
    },
  });
  return user;
}

export async function updateOwnProfile(
  userId: number,
  params: { name: string; email: string },
) {
  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();

  if (!name) return { ok: false as const, error: 'Nome obrigatório.' };
  const emailError = validateEmail(email);
  if (emailError) return { ok: false as const, error: emailError };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== userId) {
    return { ok: false as const, error: 'Este email já está registado.' };
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { name, email },
  });

  return { ok: true as const, user: updated };
}

export async function changeOwnPassword(
  userId: number,
  params: { currentPassword: string; newPassword: string },
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false as const, error: 'Utilizador não encontrado.' };

  if (!params.currentPassword) {
    return { ok: false as const, error: 'Indique a palavra-passe actual.' };
  }
  if (params.newPassword.length < 6) {
    return { ok: false as const, error: 'A nova palavra-passe deve ter pelo menos 6 caracteres.' };
  }

  const valid = await verifyUserPassword(user, params.currentPassword);
  if (!valid) return { ok: false as const, error: 'Palavra-passe actual incorrecta.' };

  const hash = await bcrypt.hash(params.newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { password: hash } });

  return { ok: true as const };
}

export async function deleteUserAccount(actorId: number, targetId: number) {
  if (targetId <= 0) return { ok: false as const, error: 'ID inválido.' };
  if (actorId === targetId) {
    return { ok: false as const, error: 'Não pode eliminar a sua própria conta.' };
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return { ok: false as const, error: 'Utilizador não encontrado.' };

  await prisma.user.delete({ where: { id: targetId } });

  return { ok: true as const, message: `Conta "${target.name}" eliminada.` };
}