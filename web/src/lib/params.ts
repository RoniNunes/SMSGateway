import type { NextRequest } from 'next/server';

export function queryParam(req: NextRequest, key: string): string {
  return new URL(req.url).searchParams.get(key)?.trim() ?? '';
}

export async function bodyParam(req: NextRequest, key: string): Promise<string> {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const json = (await req.json()) as Record<string, unknown>;
      const v = json[key];
      return typeof v === 'string' ? v.trim() : v != null ? String(v).trim() : '';
    }
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      const v = form.get(key);
      return typeof v === 'string' ? v.trim() : '';
    }
  } catch {
    /* GET-only legacy endpoints */
  }
  return queryParam(req, key);
}