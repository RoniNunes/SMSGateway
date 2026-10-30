import { jsonError, jsonOk, optionsResponse } from '@/lib/api-response';
import { resolveDeviceAuth, touchDevice } from '@/lib/device-auth';
import { prisma } from '@/lib/db';
import { maybeAutoForwardWebhook } from '@/lib/webhook';
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

  const phone = queryParam(req, 'phone');
  const msg = queryParam(req, 'msg');
  const dateStr = queryParam(req, 'date') || new Date().toISOString().slice(0, 19).replace('T', ' ');
  const dateSentStr = queryParam(req, 'date_sent') || dateStr;

  if (!phone || !msg) return jsonError('phone e msg obrigatórios.', 400);

  const datestamp = new Date(dateStr.replace(' ', 'T'));
  const dateSent = new Date(dateSentStr.replace(' ', 'T'));

  const duplicate = await prisma.smsReceived.findFirst({
    where: {
      userId: device.userId,
      phoneNum: phone,
      message: msg,
      datestamp,
    },
  });

  if (duplicate) {
    return jsonOk({ status: 'duplicate', message: 'SMS já registado.' });
  }

  const row = await prisma.smsReceived.create({
    data: {
      userId: device.userId,
      deviceId: device.id,
      phoneNum: phone,
      message: msg,
      datestamp,
      dateSent,
    },
  });

  await maybeAutoForwardWebhook(device.userId, row.id);

  const { broadcastUser } = await import('@/lib/realtime-hub');
  broadcastUser(device.userId, 'sms', 'received', {
    id: row.id,
    phone_num: phone,
    message: msg,
    record_stamp: row.recordStamp,
  });
  broadcastUser(device.userId, 'stats', 'stats.changed', {});

  return jsonOk({ status: 'success', message: 'SMS salvo.', id: row.id });
}