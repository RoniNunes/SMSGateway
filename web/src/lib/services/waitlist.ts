import { prisma } from '@/lib/db';
import { hashIp } from '@/lib/legal-config';
import { getLegalVersion } from '@/lib/legal-settings';
import { logConsent } from '@/lib/services/privacy';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function joinWaitlist(input: {
  email: string;
  name?: string;
  company?: string;
  useCase?: string;
  consent?: boolean;
  ip?: string;
  userAgent?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const name = (input.name ?? '').trim().slice(0, 120);
  const company = (input.company ?? '').trim().slice(0, 120);
  const useCase = (input.useCase ?? '').trim().slice(0, 500);

  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false as const, error: 'Email inválido.' };
  }

  if (!input.consent) {
    return { ok: false as const, error: 'Consent required.' };
  }

  const existing = await prisma.waitlistEntry.findUnique({ where: { email } });
  if (existing) {
    return {
      ok: true as const,
      alreadyRegistered: true,
      message: 'Já está na lista de espera. Entraremos em contacto em breve.',
    };
  }

  const legalVersion = await getLegalVersion();
  const entry = await prisma.waitlistEntry.create({
    data: {
      email,
      name,
      company,
      useCase,
      consentAt: new Date(),
      consentVersion: legalVersion,
      ipHash: input.ip ? hashIp(input.ip) : null,
    },
  });

  await logConsent({
    subjectType: 'waitlist',
    subjectId: entry.id,
    email,
    consentType: 'waitlist_privacy',
    ip: input.ip,
    userAgent: input.userAgent,
  });

  return {
    ok: true as const,
    alreadyRegistered: false,
    message: 'Obrigado! Foi adicionado à lista de espera.',
  };
}

export async function listWaitlist() {
  const [total, entries] = await Promise.all([
    prisma.waitlistEntry.count(),
    prisma.waitlistEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
  ]);

  return {
    total,
    entries: entries.map((e) => ({
      id: e.id,
      email: e.email,
      name: e.name,
      company: e.company,
      use_case: e.useCase,
      created_at: e.createdAt,
    })),
  };
}