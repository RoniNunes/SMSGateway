import { isValidLocale } from '@/i18n/locales';
import { jsonError, jsonOk } from '@/lib/api-response';
import type { NextRequest } from 'next/server';

const COOKIE = 'locale';
const MAX_AGE = 60 * 60 * 24 * 365;

export async function POST(req: NextRequest) {
  let body: { locale?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError('JSON inválido.', 400);
  }

  const locale = body.locale ?? '';
  if (!isValidLocale(locale)) {
    return jsonError('Idioma inválido.', 400);
  }

  const res = jsonOk({ status: 'success', locale });
  res.cookies.set(COOKIE, locale, {
    path: '/',
    maxAge: MAX_AGE,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}