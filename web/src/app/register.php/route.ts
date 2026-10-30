import { resolveAppBaseUrl } from '@/lib/app-url';
import { jsonError, jsonOk, optionsResponse } from '@/lib/api-response';
import { pairingVerifySig } from '@/lib/crypto';
import { registerDeviceFromPairing } from '@/lib/pairing';
import { notifyDeviceRegistered } from '@/lib/services/device-realtime';
import { queryParam } from '@/lib/params';
import type { NextRequest } from 'next/server';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(req: NextRequest) {
  return handleRegister(req);
}

export async function POST(req: NextRequest) {
  return handleRegister(req);
}

async function handleRegister(req: NextRequest) {
  const code = queryParam(req, 'code').toUpperCase();
  const sig = queryParam(req, 'sig');
  const name = queryParam(req, 'name') || 'Android';
  const phone = queryParam(req, 'phone');

  if (!code) return jsonError('Código de pareamento obrigatório.', 400);
  if (code.length !== 8 || !/^[A-Z0-9]+$/.test(code)) {
    return jsonError('Código de pareamento inválido.', 400);
  }
  if (sig && !pairingVerifySig(code, sig)) {
    return jsonError('Assinatura de pareamento inválida.', 403);
  }

  const result = await registerDeviceFromPairing({ code, name, phone });
  if (!result.ok) return jsonError(result.error, result.error.includes('já utilizado') ? 409 : 404);

  await notifyDeviceRegistered(result.userId, {
    id: result.deviceId,
    deviceName: result.deviceName,
    phoneNumber: result.phoneNumber,
    deviceHash: result.deviceHash,
  });

  const serverUrl = await resolveAppBaseUrl();

  return jsonOk({
    status: 'success',
    device_token: result.deviceToken,
    device_id: result.deviceId,
    device_hash: result.deviceHash,
    device_name: result.deviceName,
    phone_number: result.phoneNumber,
    server_url: serverUrl,
    message: 'Dispositivo registado com sucesso.',
  });
}