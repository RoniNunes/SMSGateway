import { jsonError, jsonOk } from '@/lib/api-response';
import { optOutWaitlist } from '@/lib/services/privacy';
import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON.', 400);
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
  const result = await optOutWaitlist(String(body.email ?? ''), { ip });

  if (!result.ok) return jsonError(result.error, 400);

  return jsonOk({ status: 'success', message: result.message });
}