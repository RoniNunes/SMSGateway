import { resolveAppBaseUrl } from '@/lib/app-url';
import { jsonError, jsonOk, optionsResponse } from '@/lib/api-response';
import { resolveDeviceAuth, touchDevice } from '@/lib/device-auth';
import { prisma } from '@/lib/db';
import { queryParam } from '@/lib/params';
import type { NextRequest } from 'next/server';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(req: NextRequest) {
  const auth = await resolveDeviceAuth(req);
  if (!auth.ok) {
    return jsonError(auth.message, auth.status, auth.code);
  }
  const device = auth.device;

  await touchDevice(device.id);

  const action = queryParam(req, 'action') || 'pending';

  switch (action) {
    case 'heartbeat': {
      const phone = queryParam(req, 'phone').trim();
      let current = device;

      if (phone) {
        current = await prisma.device.update({
          where: { id: device.id },
          data: { phoneNumber: phone },
        });
        const { pushDevicesSnapshot } = await import('@/lib/services/device-realtime');
        await pushDevicesSnapshot(device.userId);
      } else {
        const { broadcastUser } = await import('@/lib/realtime-hub');
        broadcastUser(device.userId, 'devices', 'heartbeat', { device_id: device.id });
      }

      const serverUrl = await resolveAppBaseUrl();

      return jsonOk({
        status: 'success',
        message: 'ok',
        user_id: current.userId,
        device_id: current.id,
        device_name: current.deviceName,
        phone_number: current.phoneNumber,
        server_url: serverUrl,
        time: new Date().toISOString().slice(0, 19).replace('T', ' '),
      });
    }

    case 'pending': {
      const limit = Math.min(20, Math.max(1, parseInt(queryParam(req, 'limit') || '10', 10)));
      const pending = await prisma.smsQueue.findMany({
        where: { userId: device.userId, status: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: limit,
        select: { id: true, phone: true, message: true },
      });
      return jsonOk({ status: 'success', data: pending, count: pending.length });
    }

    case 'sent': {
      const id = parseInt(queryParam(req, 'id') || '0', 10);
      if (id > 0) {
        await prisma.smsQueue.updateMany({
          where: { id, userId: device.userId, status: 'pending' },
          data: { status: 'sent', sentAt: new Date(), deviceId: device.id },
        });
        const { broadcastUser } = await import('@/lib/realtime-hub');
        broadcastUser(device.userId, 'queue', 'queue.updated', { id, status: 'sent' });
        broadcastUser(device.userId, 'stats', 'stats.changed', {});
      }
      return jsonOk({ status: 'success', message: `SMS #${id} marcado como enviado` });
    }

    case 'failed': {
      const id = parseInt(queryParam(req, 'id') || '0', 10);
      const err = (queryParam(req, 'error') || 'Erro desconhecido').slice(0, 500);
      if (id > 0) {
        await prisma.smsQueue.updateMany({
          where: { id, userId: device.userId, status: 'pending' },
          data: { status: 'failed', errorMsg: err, deviceId: device.id },
        });
        const { broadcastUser } = await import('@/lib/realtime-hub');
        broadcastUser(device.userId, 'queue', 'queue.updated', { id, status: 'failed' });
        broadcastUser(device.userId, 'stats', 'stats.changed', {});
      }
      return jsonOk({ status: 'success', message: `SMS #${id} marcado como falhado` });
    }

    default:
      return jsonError('Acção inválida', 400);
  }
}