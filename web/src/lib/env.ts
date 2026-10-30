/** Porta HTTP do servidor Next.js (única fonte de verdade para dev/prod web). */
const DEFAULT_PORT = 3005;

export function serverPort(): number {
  const raw = process.env.PORT ?? String(DEFAULT_PORT);
  const port = parseInt(raw, 10);
  return Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT;
}

/** Interface de bind (0.0.0.0 = todas as interfaces). */
export function serverHostname(): string {
  return process.env.HOSTNAME ?? '0.0.0.0';
}

/**
 * URL pública para QR, deep links, APK e callbacks Android.
 * Prioridade: APP_URL → http(s)://APP_HOST:PORT
 */
export function appBaseUrl(): string {
  const explicit = (process.env.APP_URL ?? '').trim().replace(/\/$/, '');
  if (explicit) return explicit;

  const host = (process.env.APP_HOST ?? 'localhost').trim();
  const port = serverPort();
  if (port === 80) return `http://${host}`;
  if (port === 443) return `https://${host}`;
  return `http://${host}:${port}`;
}

export function pairingSecret(): string {
  return process.env.PAIRING_SECRET || process.env.MIGRATE_KEY || 'setup2026';
}

/** Aviso se APP_URL explícito não coincide com PORT (evita QR na porta errada). */
export function validateAppUrlPort(): string | null {
  const explicit = (process.env.APP_URL ?? '').trim();
  if (!explicit) return null;
  try {
    const parsed = new URL(explicit);
    const urlPort = parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === 'https:' ? 443 : 80;
    const server = serverPort();
    // EasyPanel: HTTPS público + container na porta 80 (proxy termina TLS)
    if (!parsed.port && server === 80) return null;
    if (urlPort !== server) {
      return `APP_URL usa porta ${urlPort} mas PORT=${server}. Alinhe as variáveis no .env.`;
    }
  } catch {
    return 'APP_URL inválido no .env';
  }
  return null;
}