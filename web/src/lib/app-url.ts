import { appBaseUrl as envAppBaseUrl } from '@/lib/env';
import { prisma } from '@/lib/db';

const SETTINGS_ID = 1;

export type AppUrlSource = 'database' | 'env' | 'default';

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function validatePublicUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return 'URL do servidor em falta.';
  if (!/^https?:\/\//i.test(trimmed)) {
    return 'URL deve começar por http:// ou https://';
  }
  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname) return 'Hostname inválido.';
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return 'Use o domínio ou IP público acessível pelo telefone, não localhost.';
    }
  } catch {
    return 'URL inválida.';
  }
  return null;
}

async function ensureSettingsRow() {
  return prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, publicUrl: '' },
    update: {},
  });
}

/** URL efectiva para QR, APK e deep links (prioridade: painel admin → .env). */
export async function resolveAppBaseUrl(): Promise<string> {
  const row = await ensureSettingsRow();
  const fromDb = row.publicUrl?.trim();
  if (fromDb) return normalizeUrl(fromDb);
  return envAppBaseUrl();
}

export async function getServerUrlSettings() {
  const row = await ensureSettingsRow();
  const envFallback = envAppBaseUrl();
  const fromDb = row.publicUrl?.trim() ?? '';

  let source: AppUrlSource = 'env';
  let effective = envFallback;

  if (fromDb) {
    source = 'database';
    effective = normalizeUrl(fromDb);
  } else if (process.env.APP_URL?.trim()) {
    source = 'env';
  } else {
    source = 'default';
  }

  return {
    public_url: fromDb,
    effective_url: effective,
    source,
    env_fallback: envFallback,
    updated_at: row.updatedAt,
  };
}

export async function savePublicServerUrl(url: string) {
  const error = validatePublicUrl(url);
  if (error) return { ok: false as const, error };

  const normalized = normalizeUrl(url);
  await prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, publicUrl: normalized },
    update: { publicUrl: normalized },
  });

  return { ok: true as const, public_url: normalized, effective_url: normalized };
}