import { jsonOk } from '@/lib/api-response';
import { clearSession } from '@/lib/session';

export async function POST() {
  await clearSession();
  return jsonOk({ status: 'success' });
}