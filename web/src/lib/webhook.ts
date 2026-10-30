import { prisma } from '@/lib/db';
import { WebhookDeliveryStatus, type User } from '@prisma/client';

export function maskWebhookKey(key: string | null | undefined): string {
  if (!key) return '';
  if (key.length <= 8) return '*'.repeat(key.length);
  return `${key.slice(0, 4)}${'*'.repeat(key.length - 8)}${key.slice(-4)}`;
}

export function userWebhookAllowed(user: Pick<User, 'role' | 'webhookEnabled'>): boolean {
  if (user.role === 'admin') return true;
  return user.webhookEnabled;
}

export function buildWebhookPayload(
  sms: {
    id?: number;
    phoneNum: string;
    message: string;
    datestamp?: Date;
    recordStamp?: Date;
    deviceId?: number | null;
  },
  event = 'sms_received',
) {
  return {
    event,
    sms_id: sms.id ?? null,
    phone: sms.phoneNum,
    message: sms.message,
    datestamp: sms.datestamp?.toISOString() ?? null,
    record_stamp: sms.recordStamp?.toISOString() ?? null,
    device_id: sms.deviceId ?? null,
    forwarded_at: new Date().toISOString(),
  };
}

export async function sendSmsWebhook(
  config: Pick<User, 'webhookUrl' | 'webhookApiKey'>,
  sms: Parameters<typeof buildWebhookPayload>[0],
  event = 'sms_received',
): Promise<{ ok: boolean; httpCode?: number; body?: string; error?: string }> {
  const url = (config.webhookUrl ?? '').trim();
  if (!url) return { ok: false, error: 'Webhook URL não configurado' };

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = (config.webhookApiKey ?? '').trim();
    if (apiKey) headers['X-Api-Key'] = apiKey;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildWebhookPayload(sms, event)),
      signal: AbortSignal.timeout(15_000),
    });

    const body = await res.text();
    return { ok: res.ok, httpCode: res.status, body };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro de rede' };
  }
}

export async function maybeAutoForwardWebhook(userId: number, smsId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !userWebhookAllowed(user) || !user.webhookAuto) return;

  const sms = await prisma.smsReceived.findUnique({ where: { id: smsId } });
  if (!sms) return;

  const result = await sendSmsWebhook(user, sms);
  await prisma.smsReceived.update({
    where: { id: smsId },
    data: {
      webhookLastSent: new Date(),
      webhookLastStatus: result.ok ? WebhookDeliveryStatus.sent : WebhookDeliveryStatus.failed,
      webhookLastError: result.ok ? null : (result.error ?? `HTTP ${result.httpCode ?? '?'}`),
    },
  });
}