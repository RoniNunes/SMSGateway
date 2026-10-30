/**
 * Restabelece a palavra-passe de um administrador via ADMIN_RECOVERY_SECRET.
 *
 * Uso (no servidor ou local com .env):
 *   ADMIN_RECOVERY_SECRET=... npx tsx scripts/reset-admin-password.ts --email admin@smsgateway.local --password "NovaSenhaSegura123"
 */
import {
  isAdminRecoveryEnabled,
  MIN_RECOVERY_PASSWORD_LENGTH,
  MIN_RECOVERY_SECRET_LENGTH,
  resetAdminPasswordWithRecovery,
} from '../src/lib/admin-recovery';

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  if (!isAdminRecoveryEnabled()) {
    console.error(
      `[erro] Defina ADMIN_RECOVERY_SECRET no ambiente (mínimo ${MIN_RECOVERY_SECRET_LENGTH} caracteres).`,
    );
    process.exit(1);
  }

  const email = readArg('--email') ?? readArg('-e');
  const password = readArg('--password') ?? readArg('-p');
  const secret = process.env.ADMIN_RECOVERY_SECRET!.trim();

  if (!email || !password) {
    console.error('Uso: tsx scripts/reset-admin-password.ts --email EMAIL --password "NOVA_SENHA"');
    process.exit(1);
  }

  if (password.length < MIN_RECOVERY_PASSWORD_LENGTH) {
    console.error(`[erro] A palavra-passe deve ter pelo menos ${MIN_RECOVERY_PASSWORD_LENGTH} caracteres.`);
    process.exit(1);
  }

  const result = await resetAdminPasswordWithRecovery({
    email,
    recoverySecret: secret,
    newPassword: password,
    confirmPassword: password,
  });

  if (!result.ok) {
    console.error(`[erro] ${result.error}`);
    process.exit(1);
  }

  console.log(`[ok] Palavra-passe de administrador actualizada: ${result.email}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});