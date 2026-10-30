import { jsonError, jsonOk } from '@/lib/api-response';
import { joinWaitlist } from '@/lib/services/waitlist';
import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError('JSON inválido.', 400);
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
  const result = await joinWaitlist({
    email: String(body.email ?? ''),
    name: body.name ? String(body.name) : undefined,
    company: body.company ? String(body.company) : undefined,
    useCase: body.use_case ? String(body.use_case) : body.useCase ? String(body.useCase) : undefined,
    consent: body.consent === true || body.consent === 'true' || body.consent === 1,
    ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });

  if (!result.ok) return jsonError(result.error, 400);

  return jsonOk({
    status: 'success',
    message: result.message,
    already_registered: result.alreadyRegistered,
  });
}