import { prisma } from '@/lib/db';
import { hashIp } from '@/lib/legal-config';
import { getLegalVersion } from '@/lib/legal-settings';
import { verifyUserPassword } from '@/lib/services/users';

export async function logConsent(params: {
  subjectType: string;
  subjectId?: number;
  email?: string;
  consentType: string;
  version?: string;
  granted?: boolean;
  ip?: string;
  userAgent?: string;
}) {
  await prisma.consentRecord.create({
    data: {
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      email: params.email?.trim().toLowerCase(),
      consentType: params.consentType,
      version: params.version ?? (await getLegalVersion()),
      granted: params.granted ?? true,
      ipHash: params.ip ? hashIp(params.ip) : null,
      userAgent: params.userAgent?.slice(0, 500),
    },
  });
}

export async function logDataRequest(params: {
  type: string;
  email?: string;
  userId?: number;
  ip?: string;
}) {
  await prisma.dataRequest.create({
    data: {
      type: params.type,
      email: params.email?.trim().toLowerCase(),
      userId: params.userId,
      status: 'completed',
      ipHash: params.ip ? hashIp(params.ip) : null,
      completedAt: new Date(),
    },
  });
}

async function currentLegalVersion() {
  return getLegalVersion();
}

export async function exportUserData(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      devices: {
        select: {
          id: true,
          deviceName: true,
          deviceHash: true,
          phoneNumber: true,
          lastSeen: true,
          isActive: true,
          createdAt: true,
        },
      },
      smsReceived: {
        orderBy: { recordStamp: 'desc' },
        take: 500,
        select: {
          id: true,
          phoneNum: true,
          message: true,
          datestamp: true,
          recordStamp: true,
        },
      },
      smsQueue: {
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          phone: true,
          message: true,
          status: true,
          createdAt: true,
          sentAt: true,
        },
      },
    },
  });

  if (!user) return { ok: false as const, error: 'User not found.' };

  return {
    ok: true as const,
    data: {
      exported_at: new Date().toISOString(),
      legal_version: await currentLegalVersion(),
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_active: user.isActive,
        webhook_enabled: user.webhookEnabled,
        webhook_url: user.webhookUrl,
        created_at: user.createdAt,
        privacy_consent_at: user.privacyConsentAt,
        privacy_consent_version: user.privacyConsentVersion,
      },
      devices: user.devices,
      sms_received: user.smsReceived,
      sms_queue: user.smsQueue,
      note: 'This export contains personal data processed by SMS Gateway. SMS content may include third-party personal data.',
    },
  };
}

export async function purgeUserData(userId: number) {
  await prisma.$transaction([
    prisma.smsReceived.deleteMany({ where: { userId } }),
    prisma.smsQueue.deleteMany({ where: { userId } }),
    prisma.device.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}

export async function deleteOwnAccount(
  userId: number,
  params: { password: string; confirm: string },
  meta?: { ip?: string; userAgent?: string },
) {
  if (params.confirm !== 'DELETE') {
    return { ok: false as const, error: 'Type DELETE to confirm account deletion.' };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false as const, error: 'User not found.' };

  if (!params.password) {
    return { ok: false as const, error: 'Password required.' };
  }

  const valid = await verifyUserPassword(user, params.password);
  if (!valid) return { ok: false as const, error: 'Incorrect password.' };

  await logConsent({
    subjectType: 'user',
    subjectId: userId,
    email: user.email,
    consentType: 'account_deletion',
    granted: false,
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  await logDataRequest({ type: 'account_deletion', email: user.email, userId, ip: meta?.ip });
  await purgeUserData(userId);

  return { ok: true as const, message: 'Account and associated data deleted.' };
}

export async function deleteUserAccountFull(
  actorId: number,
  targetId: number,
  meta?: { ip?: string },
) {
  if (targetId <= 0) return { ok: false as const, error: 'Invalid ID.' };

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return { ok: false as const, error: 'User not found.' };

  if (actorId === targetId) {
    return { ok: false as const, error: 'Use the privacy panel to delete your own account.' };
  }

  await logDataRequest({ type: 'admin_account_deletion', email: target.email, userId: targetId, ip: meta?.ip });
  await purgeUserData(targetId);

  return { ok: true as const, message: `Account "${target.name}" and all data deleted.` };
}

export async function optOutWaitlist(email: string, meta?: { ip?: string }) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { ok: false as const, error: 'Email required.' };

  const entry = await prisma.waitlistEntry.findUnique({ where: { email: normalized } });
  if (!entry) {
    return { ok: true as const, message: 'If your email was registered, it has been removed.' };
  }

  await logDataRequest({ type: 'waitlist_opt_out', email: normalized, ip: meta?.ip });
  await prisma.waitlistEntry.delete({ where: { email: normalized } });

  return { ok: true as const, message: 'Your waitlist registration has been removed.' };
}

export async function deleteWaitlistEntry(entryId: number, meta?: { ip?: string }) {
  const entry = await prisma.waitlistEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { ok: false as const, error: 'Entry not found.' };

  await logDataRequest({ type: 'admin_waitlist_deletion', email: entry.email, ip: meta?.ip });
  await prisma.waitlistEntry.delete({ where: { id: entryId } });

  return { ok: true as const, message: 'Waitlist entry deleted.' };
}

export async function recordLoginConsent(userId: number, meta?: { ip?: string; userAgent?: string }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const version = await currentLegalVersion();
  if (user.privacyConsentVersion === version) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      privacyConsentAt: new Date(),
      privacyConsentVersion: version,
      termsConsentAt: new Date(),
      termsConsentVersion: version,
    },
  });

  await logConsent({
    subjectType: 'user',
    subjectId: userId,
    email: user.email,
    consentType: 'terms_and_privacy',
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
}