import { resolveAppBaseUrl } from '@/lib/app-url';
import { ensureDeviceHash } from '@/lib/device-hash';
import { prisma } from '@/lib/db';
import { notifyDeviceRevoked } from '@/lib/device-notify';
import { pushDevicesSnapshot } from '@/lib/services/device-realtime';
import { generatePairingCode, pairingSignature } from '@/lib/crypto';
import {
  pairingBuildUrl,
  pairingDeepLink,
  PAIRING_TTL_MINUTES,
} from '@/lib/pairing';

const ONLINE_THRESHOLD_MS = 30_000;

export type DeviceAccountStatus = 'pending' | 'active' | 'inactive';

function mapDeviceRow(d: {
  id: number;
  deviceName: string;
  deviceHash: string | null;
  phoneNumber: string;
  deviceToken: string | null;
  lastSeen: Date | null;
  isActive: boolean;
  createdAt: Date;
}) {
  const now = Date.now();
  const paired = !!d.deviceToken;
  const online = !!(d.lastSeen && now - d.lastSeen.getTime() <= ONLINE_THRESHOLD_MS);

  let accountStatus: DeviceAccountStatus = 'pending';
  if (paired) {
    accountStatus = d.isActive ? 'active' : 'inactive';
  }

  return {
    id: d.id,
    device_hash: d.deviceHash ?? '',
    device_name: d.deviceName,
    phone_number: d.phoneNumber,
    last_seen: d.lastSeen,
    is_active: d.isActive ? 1 : 0,
    paired: paired ? 1 : 0,
    account_status: accountStatus,
    connection_status: paired && d.isActive ? (online ? 'online' : 'offline') : null,
    online: paired && d.isActive && online ? 1 : 0,
    created_at: d.createdAt,
  };
}

export async function listDevices(userId: number) {
  const devices = await prisma.device.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      deviceName: true,
      deviceHash: true,
      phoneNumber: true,
      deviceToken: true,
      lastSeen: true,
      isActive: true,
      createdAt: true,
    },
  });

  const withHashes = await Promise.all(
    devices.map(async (d) => ({
      ...d,
      deviceHash: await ensureDeviceHash(d.id, d.deviceHash),
    })),
  );

  return withHashes.map(mapDeviceRow);
}

export async function updateDevicePhone(userId: number, deviceId: number, phoneNumber: string) {
  const device = await getDeviceForUser(userId, deviceId);
  if (!device) return { ok: false as const, error: 'Dispositivo não encontrado.' };

  const phone = phoneNumber.trim();
  if (!phone) return { ok: false as const, error: 'Número de telefone em falta.' };
  if (phone.length < 8) return { ok: false as const, error: 'Número inválido (mín. 8 caracteres).' };

  const updated = await prisma.device.update({
    where: { id: deviceId },
    data: { phoneNumber: phone },
  });

  await pushDevicesSnapshot(userId);

  return {
    ok: true as const,
    message: `Número actualizado para "${phone}".`,
    phone_number: updated.phoneNumber,
  };
}

export async function renameDevice(userId: number, deviceId: number, deviceName: string) {
  const device = await getDeviceForUser(userId, deviceId);
  if (!device) return { ok: false as const, error: 'Dispositivo não encontrado.' };
  if (!device.deviceToken) {
    return { ok: false as const, error: 'Dispositivo ainda não emparelhado.' };
  }

  const name = deviceName.trim();
  if (!name) return { ok: false as const, error: 'Nome do dispositivo em falta.' };
  if (name.length > 64) return { ok: false as const, error: 'Nome demasiado longo (máx. 64 caracteres).' };

  const updated = await prisma.device.update({
    where: { id: deviceId },
    data: { deviceName: name },
  });

  await pushDevicesSnapshot(userId);

  return {
    ok: true as const,
    message: `Dispositivo renomeado para "${name}".`,
    device_name: updated.deviceName,
    device_hash: updated.deviceHash ?? '',
  };
}

export async function getDeviceForUser(userId: number, deviceId: number) {
  return prisma.device.findFirst({
    where: { id: deviceId, userId },
  });
}

export async function toggleDevice(userId: number, deviceId: number, active: boolean) {
  const device = await getDeviceForUser(userId, deviceId);
  if (!device) return { ok: false as const, error: 'Dispositivo não encontrado.' };
  if (!device.deviceToken && active) {
    return { ok: false as const, error: 'Dispositivo ainda não emparelhado. Use o QR de pareamento.' };
  }

  await prisma.device.update({
    where: { id: deviceId },
    data: { isActive: active },
  });

  if (!active && device.deviceToken) {
    notifyDeviceRevoked(device.userId, device.id, 'DEVICE_INACTIVE');
  }

  return { ok: true as const, message: active ? 'Dispositivo activado.' : 'Dispositivo desactivado.' };
}

export async function reconnectDevice(userId: number, deviceId: number) {
  const device = await getDeviceForUser(userId, deviceId);
  if (!device) return { ok: false as const, error: 'Dispositivo não encontrado.' };

  const code = generatePairingCode();
  const expires = new Date(Date.now() + PAIRING_TTL_MINUTES * 60 * 1000);

  if (device.deviceToken) {
    notifyDeviceRevoked(device.userId, device.id, 'TOKEN_REVOKED');
  }

  await prisma.device.update({
    where: { id: deviceId },
    data: {
      deviceToken: null,
      pairingCode: code,
      pairingExpires: expires,
      isActive: true,
    },
  });

  const name = device.deviceName;
  const phone = device.phoneNumber;
  const base = await resolveAppBaseUrl();

  return {
    ok: true as const,
    message: 'Novo código de reconexão gerado. Leia o QR no telefone.',
    pairingCode: code,
    expiresIn: PAIRING_TTL_MINUTES * 60,
    pairingUrl: await pairingBuildUrl(code, name, phone),
    deepLink: await pairingDeepLink(code, name, phone),
    signature: pairingSignature(code),
    apkUrl: `${base}/pair_download.php?${new URLSearchParams({
      code,
      sig: pairingSignature(code),
    }).toString()}`,
  };
}

export async function deleteDevice(userId: number, deviceId: number) {
  const device = await getDeviceForUser(userId, deviceId);
  if (!device) return { ok: false as const, error: 'Dispositivo não encontrado.' };

  if (device.deviceToken) {
    notifyDeviceRevoked(device.userId, device.id, 'DEVICE_DELETED');
  }

  await prisma.device.delete({ where: { id: deviceId } });

  const wasPaired = !!device.deviceToken;
  return {
    ok: true as const,
    message: wasPaired ? 'Dispositivo eliminado.' : 'Pareamento pendente eliminado.',
  };
}

/** @deprecated Use toggleDevice(userId, deviceId, false) */
export async function deactivateDevice(userId: number, deviceId: number) {
  await toggleDevice(userId, deviceId, false);
}