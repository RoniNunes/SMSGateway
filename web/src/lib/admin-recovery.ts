import { prisma } from '@/lib/db';
import { logDataRequest } from '@/lib/services/privacy';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash, timingSafeEqual } from 'crypto';

export const MIN_RECOVERY_SECRET_LENGTH = 24;
export const MIN_RECOVERY_PASSWORD_LENGTH = 8;

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const rateLimit = new Map<string, { count: number; resetAt: number }>();

export function adminRecoverySecret(): string | null {
  const raw = (process.env.ADMIN_RECOVERY_SECRET ?? '').trim();
  if (raw.length < MIN_RECOVERY_SECRET_LENGTH) return null;
  return raw;
}

export function isAdminRecoveryEnabled(): boolean {
  return adminRecoverySecret() !== null;
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function safeEqual(a: string, b: string): boolean {
  const ha = digest(a);
  const hb = digest(b);
  return timingSafeEqual(ha, hb);
}

export function verifyRecoverySecret(provided: string): boolean {
  const expected = adminRecoverySecret();
  if (!expected || !provided.trim()) return false;
  return safeEqual(provided.trim(), expected);
}

export function checkRecoveryRateLimit(ip: string): boolean {
  const now = Date.now();
  const key = ip || 'unknown';
  const entry = rateLimit.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count += 1;
  return true;
}

export async function resetAdminPasswordWithRecovery(params: {
  email: string;
  recoverySecret: string;
  newPassword: string;
  confirmPassword: string;
  ip?: string;
}): Promise<{ ok: true; email: string } | { ok: false; error: string; status?: number }> {
  if (!isAdminRecoveryEnabled()) {
    return { ok: false, error: 'Recuperação de administrador não configurada.', status: 503 };
  }

  if (params.ip && !checkRecoveryRateLimit(params.ip)) {
    return { ok: false, error: 'Demasiadas tentativas. Aguarde 15 minutos.', status: 429 };
  }

  const email = params.email.trim().toLowerCase();
  const recoverySecret = params.recoverySecret.trim();
  const newPassword = params.newPassword;
  const confirmPassword = params.confirmPassword;

  if (!email || !recoverySecret || !newPassword) {
    return { ok: false, error: 'Todos os campos são obrigatórios.' };
  }

  if (newPassword.length < MIN_RECOVERY_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `A nova palavra-passe deve ter pelo menos ${MIN_RECOVERY_PASSWORD_LENGTH} caracteres.`,
    };
  }

  if (newPassword !== confirmPassword) {
    return { ok: false, error: 'As palavras-passe não coincidem.' };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const invalidMsg = 'Credenciais de recuperação inválidas.';

  if (!verifyRecoverySecret(recoverySecret) || !user || user.role !== UserRole.admin) {
    return { ok: false, error: invalidMsg, status: 401 };
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hash, isActive: true },
  });

  await logDataRequest({
    type: 'admin_password_recovery',
    email: user.email,
    userId: user.id,
    ip: params.ip,
  });

  return { ok: true, email: user.email };
}