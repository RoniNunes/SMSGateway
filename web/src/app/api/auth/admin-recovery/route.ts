import { jsonError, jsonOk } from '@/lib/api-response';
import { isAdminRecoveryEnabled, resetAdminPasswordWithRecovery } from '@/lib/admin-recovery';
import type { NextRequest } from 'next/server';

export async function GET() {
  return jsonOk({ enabled: isAdminRecoveryEnabled() });
}

export async function POST(req: NextRequest) {
  let email = '';
  let recoverySecret = '';
  let newPassword = '';
  let confirmPassword = '';

  try {
    const body = await req.json();
    email = String(body.email ?? '');
    recoverySecret = String(body.recovery_secret ?? body.recoverySecret ?? '');
    newPassword = String(body.new_password ?? body.newPassword ?? '');
    confirmPassword = String(body.confirm_password ?? body.confirmPassword ?? '');
  } catch {
    return jsonError('JSON inválido.', 400);
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;

  const result = await resetAdminPasswordWithRecovery({
    email,
    recoverySecret,
    newPassword,
    confirmPassword,
    ip,
  });

  if (!result.ok) {
    return jsonError(result.error, result.status ?? 400);
  }

  return jsonOk({
    status: 'success',
    message: 'Palavra-passe de administrador actualizada. Pode iniciar sessão.',
    email: result.email,
  });
}