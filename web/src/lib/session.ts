import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import type { User } from '@prisma/client';

const COOKIE = 'smsgw_session';
const MAX_AGE = 60 * 60 * 24 * 7;

function secret(): string {
  return process.env.SESSION_SECRET || process.env.MIGRATE_KEY || 'dev-session-secret-change-me';
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

function encodeSession(userId: number): string {
  const exp = Date.now() + MAX_AGE * 1000;
  const body = `${userId}.${exp}`;
  return `${body}.${sign(body)}`;
}

function decodeSession(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [idStr, expStr, sig] = parts;
  const body = `${idStr}.${expStr}`;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  if (Date.now() > parseInt(expStr, 10)) return null;
  const id = parseInt(idStr, 10);
  return Number.isFinite(id) ? id : null;
}

export async function setSession(userId: number) {
  const jar = await cookies();
  jar.set(COOKIE, encodeSession(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE,
    path: '/',
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const userId = decodeSession(token);
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user || !user.isActive) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}