import { jsonError, jsonOk } from '@/lib/api-response';
import { userFromApiKey } from '@/lib/device-auth';
import { notifyUserDevices } from '@/lib/device-notify';
import { prisma } from '@/lib/db';
import { queryParam } from '@/lib/params';
import type { NextRequest } from 'next/server';

export async function handleApiV1(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key') || queryParam(req, 'api_key');

  const user = await userFromApiKey(apiKey);
  if (!user) return jsonError('API key inválida.', 401);

  const action = queryParam(req, 'action') || 'send';

  if (action === 'send') {
    const phone = queryParam(req, 'phone');
    const msg = queryParam(req, 'msg');
    if (!phone || !msg) return jsonError('Parâmetros phone e msg obrigatórios.', 400);

    const row = await prisma.smsQueue.create({
      data: { userId: user.id, phone, message: msg },
    });

    notifyUserDevices(user.id, 'queue.pending', { id: row.id, phone, message: msg });

    return jsonOk({
      status: 'queued',
      id: row.id,
      message: 'SMS adicionado à fila de envio.',
    });
  }

  if (action === 'status') {
    const id = parseInt(queryParam(req, 'id') || '0', 10);
    if (id <= 0) return jsonError('ID inválido.', 400);

    const row = await prisma.smsQueue.findFirst({
      where: { id, userId: user.id },
    });
    if (!row) return jsonError('SMS não encontrado.', 404);

    return jsonOk({
      status: 'success',
      id: row.id,
      phone: row.phone,
      message: row.message,
      delivery: row.status,
      created_at: row.createdAt,
      sent_at: row.sentAt,
      error: row.errorMsg,
      delivered: row.status === 'sent',
    });
  }

  return jsonError('Acção inválida. Use send ou status.', 400);
}