import { resolveAppBaseUrl } from '@/lib/app-url';
import { generateUniqueDeviceHash } from '@/lib/device-hash';
import { prisma } from '@/lib/db';
import { generatePairingCode, generateToken, pairingSignature, pairingVerifySig } from '@/lib/crypto';

export const PAIRING_TTL_MINUTES = 30;

export async function pairingBuildUrl(code: string, name?: string, phone?: string): Promise<string> {
  const base = await resolveAppBaseUrl();
  const params = new URLSearchParams({
    code: code.toUpperCase(),
    sig: pairingSignature(code),
  });
  if (name) params.set('name', name);
  if (phone) params.set('phone', phone);
  return `${base}/pair.php?${params.toString()}`;
}

export async function pairingDeepLink(code: string, name?: string, phone?: string): Promise<string> {
  const base = await resolveAppBaseUrl();
  const params = new URLSearchParams({
    server: base,
    code: code.toUpperCase(),
    sig: pairingSignature(code),
  });
  if (name) params.set('name', name);
  if (phone) params.set('phone', phone);
  return `smsgateway://pair?${params.toString()}`;
}

export async function createPairing(userId: number, deviceName: string, phoneNumber: string) {
  const code = generatePairingCode();
  const expires = new Date(Date.now() + PAIRING_TTL_MINUTES * 60 * 1000);
  const base = await resolveAppBaseUrl();

  const deviceHash = await generateUniqueDeviceHash();

  const device = await prisma.device.create({
    data: {
      userId,
      pairingCode: code,
      pairingExpires: expires,
      deviceName: deviceName || 'Android',
      deviceHash,
      phoneNumber: phoneNumber || '',
    },
  });

  const pairingUrl = await pairingBuildUrl(code, deviceName, phoneNumber);
  const deepLink = await pairingDeepLink(code, deviceName, phoneNumber);

  return {
    device,
    pairingCode: code,
    expiresIn: PAIRING_TTL_MINUTES * 60,
    pairingUrl,
    deepLink,
    signature: pairingSignature(code),
    apkUrl: `${base}/pair_download.php?${new URLSearchParams({
      code,
      sig: pairingSignature(code),
    }).toString()}`,
  };
}

export async function validatePublicPairing(code: string, sig: string) {
  if (!pairingVerifySig(code, sig)) return null;
  return lookupPendingPairing(code);
}

export async function lookupPendingPairing(code: string) {
  const normalized = code.trim().toUpperCase();
  if (normalized.length !== 8) return null;

  return prisma.device.findFirst({
    where: {
      pairingCode: normalized,
      deviceToken: null,
      isActive: true,
      pairingExpires: { gt: new Date() },
    },
  });
}

export async function registerDeviceFromPairing(params: {
  code: string;
  name?: string;
  phone?: string;
}) {
  const normalized = params.code.trim().toUpperCase();
  const pending = await lookupPendingPairing(normalized);
  if (!pending) return { ok: false as const, error: 'Código inválido ou expirado. Gere um novo no painel.' };

  const token = generateToken(32);
  const name =
    params.name && params.name !== 'Android' ? params.name : pending.deviceName;
  const phone = params.phone || pending.phoneNumber;
  const deviceHash = pending.deviceHash ?? (await generateUniqueDeviceHash());

  const updated = await prisma.device.updateMany({
    where: {
      id: pending.id,
      pairingCode: normalized,
      deviceToken: null,
    },
    data: {
      deviceToken: token,
      pairingCode: null,
      pairingExpires: null,
      deviceName: name,
      phoneNumber: phone,
      deviceHash,
    },
  });

  if (updated.count < 1) {
    return { ok: false as const, error: 'Código já utilizado ou expirado. Gere um novo no painel.' };
  }

  return {
    ok: true as const,
    deviceToken: token,
    deviceId: pending.id,
    userId: pending.userId,
    deviceName: name,
    phoneNumber: phone,
    deviceHash,
  };
}