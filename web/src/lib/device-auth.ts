import { prisma } from '@/lib/db';
import type { Device } from '@prisma/client';
import type { NextRequest } from 'next/server';

export type DeviceAuthCode = 'NO_TOKEN' | 'INVALID_TOKEN' | 'DEVICE_INACTIVE';

export type DeviceAuthResult =
  | { ok: true; device: Device }
  | { ok: false; status: 401; code: DeviceAuthCode; message: string };

function readToken(req: NextRequest): string {
  const header = req.headers.get('x-device-token');
  const url = new URL(req.url);
  return (header ?? url.searchParams.get('device_token') ?? '').trim();
}

export async function resolveDeviceAuth(req: NextRequest): Promise<DeviceAuthResult> {
  const token = readToken(req);
  if (!token) {
    return {
      ok: false,
      status: 401,
      code: 'NO_TOKEN',
      message: 'Token em falta. Registe ou reconecte o dispositivo no painel.',
    };
  }

  const device = await prisma.device.findFirst({
    where: { deviceToken: token },
  });

  if (!device) {
    return {
      ok: false,
      status: 401,
      code: 'INVALID_TOKEN',
      message: 'Token inválido ou revogado. Gere um novo QR em Dispositivos → Reconectar.',
    };
  }

  if (!device.isActive) {
    return {
      ok: false,
      status: 401,
      code: 'DEVICE_INACTIVE',
      message: 'Dispositivo desactivado. Active ou reconecte no painel web.',
    };
  }

  return { ok: true, device };
}

export async function deviceFromRequest(req: NextRequest): Promise<Device | null> {
  const result = await resolveDeviceAuth(req);
  return result.ok ? result.device : null;
}

export async function touchDevice(deviceId: number): Promise<void> {
  await prisma.device.update({
    where: { id: deviceId },
    data: { lastSeen: new Date() },
  });
}

export async function userFromApiKey(key: string) {
  if (!key.trim()) return null;
  return prisma.user.findFirst({
    where: { apiKey: key.trim(), isActive: true },
  });
}