/** Rotas públicas da API (Next.js). Aliases .php mantidos só para compatibilidade Android legado. */
export const API_PATHS = {
  v1: '/api/v1',
  health: '/health',
  download: '/download',
  pair: '/pair',
  register: '/api/device/register',
} as const;

export function apiV1Url(base: string, params?: Record<string, string>): string {
  const url = new URL(API_PATHS.v1, base.endsWith('/') ? base : `${base}/`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return url.toString();
}