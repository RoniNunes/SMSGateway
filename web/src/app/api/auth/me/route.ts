import { jsonError, jsonOk } from '@/lib/api-response';
import { currentUser } from '@/lib/session';

function maskKey(key: string | null | undefined): string {
  if (!key) return '';
  if (key.length <= 8) return '*'.repeat(key.length);
  return `${key.slice(0, 4)}${'*'.repeat(key.length - 8)}${key.slice(-4)}`;
}

export async function GET() {
  const user = await currentUser();
  if (!user || !user.isActive) return jsonError('Não autenticado.', 401);

  const canWebhook = user.role === 'admin' || user.webhookEnabled;

  return jsonOk({
    status: 'success',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      api_key: user.apiKey,
      role: user.role,
      is_admin: user.role === 'admin',
      can_webhook: canWebhook,
      webhook_enabled: user.webhookEnabled,
      webhook_auto: user.webhookAuto,
      webhook_configured: !!user.webhookUrl,
      webhook_url: user.webhookUrl ?? '',
      webhook_api_key: maskKey(user.webhookApiKey),
    },
  });
}