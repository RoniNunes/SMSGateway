import { resolveAppBaseUrl } from '@/lib/app-url';
import { prisma } from '@/lib/db';
import type { LegalEntity } from '@/lib/legal-config';

const SETTINGS_ID = 1;

const DEFAULT_JURISDICTION = 'União Europeia, Brasil e jurisdições aplicáveis';

/** Detecta texto corrompido por encoding incorreto no .env (ex.: UniÃ£o). */
function looksLikeMojibake(value: string): boolean {
  return /Ã.|Â.|â€|ï¿½|ƒ/.test(value);
}

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function resolveJurisdiction(value?: string): string {
  const trimmed = value?.trim();
  if (!trimmed || looksLikeMojibake(trimmed)) return DEFAULT_JURISDICTION;
  if (stripAccents(trimmed) === stripAccents(DEFAULT_JURISDICTION)) return DEFAULT_JURISDICTION;
  return trimmed;
}

export type LegalSettings = LegalEntity & {
  country: string;
  taxId: string;
  legalRepresentative: string;
  jurisdiction: string;
  privacyPhone: string;
  legalVersion: string;
  legalLastUpdated: string;
  source: 'database' | 'env';
};

function envDefaults(): Omit<LegalSettings, 'website' | 'source'> {
  return {
    company: process.env.LEGAL_COMPANY_NAME?.trim() || 'Evo Go SMS Gateway',
    dpoEmail: process.env.LEGAL_DPO_EMAIL?.trim() || 'privacy@evo-go.com',
    address: process.env.LEGAL_ADDRESS?.trim() || '',
    country: process.env.LEGAL_COUNTRY?.trim() || 'Portugal',
    taxId: process.env.LEGAL_TAX_ID?.trim() || '',
    legalRepresentative: process.env.LEGAL_REPRESENTATIVE?.trim() || '',
    jurisdiction: resolveJurisdiction(process.env.LEGAL_JURISDICTION),
    privacyPhone: process.env.LEGAL_PRIVACY_PHONE?.trim() || '',
    legalVersion: process.env.LEGAL_VERSION?.trim() || '1.0',
    legalLastUpdated: process.env.LEGAL_LAST_UPDATED?.trim() || '2026-06-30',
  };
}

async function ensureSettingsRow() {
  const defaults = envDefaults();
  return prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      publicUrl: '',
      companyName: defaults.company,
      dpoEmail: defaults.dpoEmail,
      address: defaults.address,
      country: defaults.country,
      taxId: defaults.taxId,
      legalRepresentative: defaults.legalRepresentative,
      jurisdiction: defaults.jurisdiction,
      privacyPhone: defaults.privacyPhone,
      legalVersion: defaults.legalVersion,
      legalLastUpdated: defaults.legalLastUpdated,
    },
    update: {},
  });
}

function pick(row: Awaited<ReturnType<typeof ensureSettingsRow>>, website: string): LegalSettings {
  const env = envDefaults();
  const hasDb = Boolean(row.companyName?.trim() || row.dpoEmail?.trim());

  const company = row.companyName?.trim() || env.company;
  const dpoEmail = row.dpoEmail?.trim() || env.dpoEmail;

  return {
    company,
    dpoEmail,
    address: row.address?.trim() || env.address,
    website,
    country: row.country?.trim() || env.country,
    taxId: row.taxId?.trim() || env.taxId,
    legalRepresentative: row.legalRepresentative?.trim() || env.legalRepresentative,
    jurisdiction: resolveJurisdiction(row.jurisdiction?.trim() || env.jurisdiction),
    privacyPhone: row.privacyPhone?.trim() || env.privacyPhone,
    legalVersion: row.legalVersion?.trim() || env.legalVersion,
    legalLastUpdated: row.legalLastUpdated?.trim() || env.legalLastUpdated,
    source: hasDb ? 'database' : 'env',
  };
}

export async function getLegalSettings(): Promise<LegalSettings> {
  const [row, website] = await Promise.all([ensureSettingsRow(), resolveAppBaseUrl()]);
  return pick(row, website);
}

export async function getLegalVersion(): Promise<string> {
  const settings = await getLegalSettings();
  return settings.legalVersion;
}

export function legalVars(settings: LegalSettings): Record<string, string> {
  return {
    company: settings.company,
    dpoEmail: settings.dpoEmail,
    website: settings.website,
    address: settings.address || '—',
    country: settings.country || '—',
    taxId: settings.taxId || '—',
    legalRepresentative: settings.legalRepresentative || '—',
    jurisdiction: settings.jurisdiction || '—',
    privacyPhone: settings.privacyPhone ? ` · Tel: ${settings.privacyPhone}` : '',
    version: settings.legalVersion,
    lastUpdated: settings.legalLastUpdated,
  };
}

export async function saveLegalSettings(input: {
  companyName: string;
  dpoEmail: string;
  address?: string;
  country?: string;
  taxId?: string;
  legalRepresentative?: string;
  jurisdiction?: string;
  privacyPhone?: string;
  bumpVersion?: boolean;
}) {
  const companyName = input.companyName.trim();
  const dpoEmail = input.dpoEmail.trim().toLowerCase();

  if (!companyName) return { ok: false as const, error: 'Nome da empresa obrigatório.' };
  if (!dpoEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dpoEmail)) {
    return { ok: false as const, error: 'Email de privacidade/DPO inválido.' };
  }

  const row = await ensureSettingsRow();
  const today = new Date().toISOString().slice(0, 10);
  let nextVersion = row.legalVersion?.trim() || '1.0';

  if (input.bumpVersion) {
    const parts = nextVersion.split('.');
    const minor = parseInt(parts[1] ?? '0', 10);
    const major = parseInt(parts[0] ?? '1', 10);
    nextVersion = Number.isFinite(minor) ? `${major}.${minor + 1}` : `${nextVersion}.1`;
  }

  await prisma.systemSettings.update({
    where: { id: SETTINGS_ID },
    data: {
      companyName,
      dpoEmail,
      address: (input.address ?? '').trim(),
      country: (input.country ?? '').trim(),
      taxId: (input.taxId ?? '').trim(),
      legalRepresentative: (input.legalRepresentative ?? '').trim(),
      jurisdiction: (input.jurisdiction ?? '').trim(),
      privacyPhone: (input.privacyPhone ?? '').trim(),
      legalVersion: nextVersion,
      legalLastUpdated: today,
    },
  });

  const settings = await getLegalSettings();
  return { ok: true as const, settings };
}